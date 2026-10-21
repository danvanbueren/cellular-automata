// Tauri v2 IPC Bridge (injected globally via `app.withGlobalTauri: true` in tauri.conf.json)
const { invoke } = window.__TAURI__.core;

// =============================================================================
// Centralized Tooltips & Helper Text Configuration
// =============================================================================
// All hover text and status messages are centralized here for easy editing:
export const TOOLTIPS = {
  // Idle default message when not hovering any control
  DEFAULT: "danvanbueren/cellular-automata",

  // Play / Pause toggle
  PLAY: "AUTOPLAY (SPACE)",
  PAUSE: "PAUSE (SPACE)",

  // Step / Skip ahead
  STEP_ENABLED: "STEP AHEAD",
  STEP_DISABLED: "DISABLED DURING AUTOPLAY",

  // Reset and Clear
  RESTART: "RE-SEED (R)",
  CLEAR: "CLEAR (C)",

  // Void Genesis toggle
  GENESIS_ON: "VOID GENESIS - ENABLED",
  GENESIS_OFF: "VOID GENESIS - DISABLED",

  // Speed 3-State Animal Profiles
  SPEED_SLOW: "SIMULATION SPEED - 10 HZ",
  SPEED_MED: "SIMULATION SPEED - 25 HZ",
  SPEED_FAST: "SIMULATION SPEED - 60 HZ",

  // Lifespan 3-State Biological Profiles
  LIFESPAN_SHORT: "ENTITY LIFESPAN - 15 GENERATIONS",
  LIFESPAN_MED: "ENTITY LIFESPAN - 35 GENERATIONS",
  LIFESPAN_LONG: "ENTITY LIFESPAN - 80 GENERATIONS",

  // Telemetry indicators
  GENERATION: "CURRENT GENERATION COUNTER",
  POPULATION: "CURRENT ENTITY POPULATION",
};

const CELL_SIZE = 5; // Resolution of each cell in pixels

// Normalizes a Tauri binary IPC response (ArrayBuffer, TypedArray, or Array) into a Uint8Array view
function toUint8Array(buffer) {
  if (buffer instanceof Uint8Array) return buffer;
  if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  if (ArrayBuffer.isView(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  return new Uint8Array(buffer);
}

// Generates a vibrant, high-saturation random RGB species color
function getRandomVibrantColor() {
  const hue = Math.floor(Math.random() * 360);
  const s = 0.95;
  const l = 0.58;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; }
  else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; }
  else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; }
  else { r = c; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

// Formats a number with dark-gray leading zeroes to hold space and prevent wiggling
function formatFixedDigits(num, totalDigits = 6) {
  const clamped = Math.min(Math.max(num, 0), 999999);
  const str = clamped.toString();
  const zerosNeeded = Math.max(0, totalDigits - str.length);
  const leadingZeros = "0".repeat(zerosNeeded);
  return `<span class="lead-zero">${leadingZeros}</span><span class="active-digits">${str}</span>`;
}

async function main() {
  // Setup Fullscreen Dual Canvases (Foreground Crisp + Background Atmospheric Bloom)
  const canvas = document.getElementById("life-canvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const bloomCanvas = document.getElementById("bloom-canvas");
  const bloomCtx = bloomCanvas.getContext("2d");

  const initWinW = Math.max(CELL_SIZE, window.innerWidth);
  const initWinH = Math.max(CELL_SIZE, window.innerHeight);

  canvas.width = initWinW;
  canvas.height = initWinH;
  bloomCanvas.width = Math.ceil(initWinW / 2);
  bloomCanvas.height = Math.ceil(initWinH / 2);

  let width = Math.max(1, Math.ceil(initWinW / CELL_SIZE));
  let height = Math.max(1, Math.ceil(initWinH / CELL_SIZE));

  // UI Elements
  const playPauseBtn = document.getElementById("play-pause");
  const playIcon = document.getElementById("play-icon");
  const pauseIcon = document.getElementById("pause-icon");
  const stepBtn = document.getElementById("step-btn");
  const randomBtn = document.getElementById("random-btn");
  const clearBtn = document.getElementById("clear-btn");
  const genesisBtn = document.getElementById("genesis-btn");
  const speedBtn = document.getElementById("speed-btn");
  const lifespanBtn = document.getElementById("lifespan-btn");
  const genBox = document.getElementById("gen-box");
  const popBox = document.getElementById("pop-box");
  const genCount = document.getElementById("gen-count");
  const aliveCount = document.getElementById("alive-count");
  const hudHelper = document.getElementById("hud-helper");

  // Speed 3-State Animal Profiles (Tortoise, Hare, Cheetah)
  const speedProfiles = [
    { fps: 10, titleKey: "SPEED_SLOW", iconId: "speed-icon-slow" },
    { fps: 25, titleKey: "SPEED_MED", iconId: "speed-icon-med" },
    { fps: 60, titleKey: "SPEED_FAST", iconId: "speed-icon-fast" },
  ];
  let speedIdx = 1; // Default: Medium (Hare)

  // Lifespan 3-State Biological Profiles (Sprout, Leaf, Infinity)
  const lifeProfiles = [
    { age: 15, titleKey: "LIFESPAN_SHORT", iconId: "life-icon-short" },
    { age: 35, titleKey: "LIFESPAN_MED", iconId: "life-icon-med" },
    { age: 80, titleKey: "LIFESPAN_LONG", iconId: "life-icon-long" },
  ];
  let lifeIdx = 1; // Default: Medium (35 GEN)

  // State & Async Synchronization Guards
  let isPlaying = true;
  let isTickInFlight = false;
  let stateEpoch = 0; // Incremented on reset, clear, glider spawn, or resize to discard stale in-flight ticks
  let generation = 0;
  let enableGenesis = true;
  let activeColor = getRandomVibrantColor();
  let maxAge = lifeProfiles[lifeIdx].age;
  let targetFps = speedProfiles[speedIdx].fps;
  let lastFrameTime = performance.now();

  // Initialize native Rust universe and fetch initial binary cell buffer
  let cellBytes = toUint8Array(
    await invoke("init_universe", {
      width,
      height,
      seed: Math.floor(Date.now()),
      density: 0.20,
    })
  );

  // --- Render Function: Direct Binary Frame Buffer Read ---
  const render = () => {
    // 4 bytes per cell: [r, g, b, age, r, g, b, age, ...]
    let livingCount = 0;

    // Clear to transparent so the background radiant bloom shines through
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const byteLen = cellBytes.length;
    for (let row = 0; row < height; row++) {
      const rowOffset = row * width;
      for (let col = 0; col < width; col++) {
        const byteOffset = (rowOffset + col) * 4;
        if (byteOffset + 3 >= byteLen) break;

        const age = cellBytes[byteOffset + 3];

        if (age > 0) {
          livingCount++;

          const r = cellBytes[byteOffset];
          const g = cellBytes[byteOffset + 1];
          const b = cellBytes[byteOffset + 2];

          // Dynamic biological opacity curve based on age
          const lifeRatio = Math.min(age / maxAge, 1.0);
          const opacity = Math.max(0.18, 1.0 - Math.pow(lifeRatio, 0.75));

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;

          ctx.fillRect(
            col * CELL_SIZE,
            row * CELL_SIZE,
            CELL_SIZE,
            CELL_SIZE
          );
        }
      }
    }

    // Soft temporal decay: fades previous glow smoothly across frames (eliminates strobing/flicker)
    bloomCtx.globalCompositeOperation = "destination-out";
    bloomCtx.fillStyle = "rgba(0, 0, 0, 0.28)";
    bloomCtx.fillRect(0, 0, bloomCanvas.width, bloomCanvas.height);
    bloomCtx.globalCompositeOperation = "source-over";
    bloomCtx.drawImage(canvas, 0, 0, bloomCanvas.width, bloomCanvas.height);

    // Update fixed-width telemetry with dark-gray leading zeroes
    genCount.innerHTML = formatFixedDigits(generation);
    aliveCount.innerHTML = formatFixedDigits(livingCount);
  };

  // Advances a single generation on the Rust backend and renders the resulting buffer
  const stepGeneration = async () => {
    if (isTickInFlight) return;
    isTickInFlight = true;
    const tickEpoch = stateEpoch;
    try {
      const buffer = await invoke("tick_universe", {
        maxAge,
        enableGenesis,
      });
      // Only apply frame if no reset/clear/resize occurred while this tick was in flight
      if (tickEpoch === stateEpoch) {
        cellBytes = toUint8Array(buffer);
        generation++;
        render();
      }
    } catch (err) {
      console.error("Failed to tick universe:", err);
    } finally {
      isTickInFlight = false;
    }
  };

  // --- Animation Loop ---
  const loop = (currentTime) => {
    const elapsed = currentTime - lastFrameTime;
    const interval = 1000 / targetFps;

    if (isPlaying && !isTickInFlight && elapsed >= interval) {
      lastFrameTime = currentTime - (elapsed % interval);
      stepGeneration();
    }

    requestAnimationFrame(loop);
  };

  // --- Centralized Dynamic Helper Bar Controller ---
  const setHelper = (text) => {
    if (text) {
      hudHelper.textContent = text;
      hudHelper.classList.add("active-hint");
    } else {
      hudHelper.textContent = TOOLTIPS.DEFAULT;
      hudHelper.classList.remove("active-hint");
    }
  };

  const getDynamicHelper = (el) => {
    if (el === playPauseBtn) return isPlaying ? TOOLTIPS.PAUSE : TOOLTIPS.PLAY;
    if (el === stepBtn) return isPlaying ? TOOLTIPS.STEP_DISABLED : TOOLTIPS.STEP_ENABLED;
    if (el === randomBtn) return TOOLTIPS.RESTART;
    if (el === clearBtn) return TOOLTIPS.CLEAR;
    if (el === genesisBtn) return enableGenesis ? TOOLTIPS.GENESIS_ON : TOOLTIPS.GENESIS_OFF;
    if (el === speedBtn) return TOOLTIPS[speedProfiles[speedIdx].titleKey];
    if (el === lifespanBtn) return TOOLTIPS[lifeProfiles[lifeIdx].titleKey];
    if (el === genBox) return TOOLTIPS.GENERATION;
    if (el === popBox) return TOOLTIPS.POPULATION;
    return null;
  };

  // Wire hover listeners across all interactive buttons and telemetry boxes
  [playPauseBtn, stepBtn, randomBtn, clearBtn, genesisBtn, speedBtn, lifespanBtn, genBox, popBox].forEach((el) => {
    if (!el) return;
    el.addEventListener("mouseenter", () => {
      setHelper(getDynamicHelper(el));
    });
    el.addEventListener("mouseleave", () => {
      setHelper(null);
    });
  });

  // --- Play/Pause State Controller ---
  const setPlaybackState = (play) => {
    isPlaying = play;
    playIcon.style.display = isPlaying ? "none" : "block";
    pauseIcon.style.display = isPlaying ? "block" : "none";
    playPauseBtn.classList.toggle("btn-primary", isPlaying);
    // Step button is strictly clickable when paused
    stepBtn.disabled = isPlaying;
  };

  const reseedUniverse = async () => {
    const myEpoch = ++stateEpoch;
    const seed = Math.floor(Math.random() * 1_000_000_000) + 1;
    const buffer = await invoke("populate_random", { seed, density: 0.20 });
    if (myEpoch === stateEpoch) {
      cellBytes = toUint8Array(buffer);
      generation = 0;
      render();
    }
  };

  const clearUniverse = async () => {
    const myEpoch = ++stateEpoch;
    const buffer = await invoke("clear_universe");
    if (myEpoch === stateEpoch) {
      cellBytes = toUint8Array(buffer);
      generation = 0;
      render();
    }
  };

  playPauseBtn.addEventListener("click", () => {
    setPlaybackState(!isPlaying);
    setHelper(getDynamicHelper(playPauseBtn));
  });

  window.addEventListener("keydown", async (e) => {
    // Ignore shortcuts when modifier keys are held (e.g. Cmd+R, Ctrl+C) or key-repeat is firing
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.target instanceof Element && e.target.matches("input, textarea, select, [contenteditable]")) {
      return;
    }

    if (e.code === "Space") {
      e.preventDefault(); // Prevent focused HUD button from also firing a click event
      setPlaybackState(!isPlaying);
      setHelper(getDynamicHelper(playPauseBtn));
    } else if (e.code === "KeyR") {
      await reseedUniverse();
    } else if (e.code === "KeyC") {
      await clearUniverse();
    } else if (e.code === "KeyG") {
      const myEpoch = ++stateEpoch;
      const color = getRandomVibrantColor();
      const buffer = await invoke("spawn_glider", {
        col: Math.floor(width / 2),
        row: Math.floor(height / 2),
        r: color.r,
        g: color.g,
        b: color.b,
      });
      if (myEpoch === stateEpoch) {
        cellBytes = toUint8Array(buffer);
        render();
      }
    }
  });

  stepBtn.addEventListener("click", () => {
    if (!isPlaying) {
      stepGeneration();
    }
  });

  randomBtn.addEventListener("click", reseedUniverse);
  clearBtn.addEventListener("click", clearUniverse);

  // Void Genesis Toggle
  genesisBtn.addEventListener("click", () => {
    enableGenesis = !enableGenesis;
    genesisBtn.classList.toggle("active", enableGenesis);
    setHelper(getDynamicHelper(genesisBtn));
  });

  // Speed 3-State Toggle (Tortoise, Hare, Cheetah)
  const updateSpeedUI = () => {
    const profile = speedProfiles[speedIdx];
    targetFps = profile.fps;
    ["speed-icon-slow", "speed-icon-med", "speed-icon-fast"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = id === profile.iconId ? "block" : "none";
    });
  };

  speedBtn.addEventListener("click", () => {
    speedIdx = (speedIdx + 1) % speedProfiles.length;
    updateSpeedUI();
    setHelper(getDynamicHelper(speedBtn));
  });

  // Lifespan 3-State Toggle (Sprout, Leaf, Infinity)
  const updateLifespanUI = () => {
    const profile = lifeProfiles[lifeIdx];
    maxAge = profile.age;
    ["life-icon-short", "life-icon-med", "life-icon-long"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = id === profile.iconId ? "block" : "none";
    });
  };

  lifespanBtn.addEventListener("click", () => {
    lifeIdx = (lifeIdx + 1) % lifeProfiles.length;
    updateLifespanUI();
    setHelper(getDynamicHelper(lifespanBtn));
  });

  // Canvas Mouse Painting (Optimistic Local Buffer Update + Async Rust Sync)
  let isPainting = false;

  const paintCellAtMouse = (e) => {
    const col = Math.min(Math.max(Math.floor(e.clientX / CELL_SIZE), 0), width - 1);
    const row = Math.min(Math.max(Math.floor(e.clientY / CELL_SIZE), 0), height - 1);

    // Optimistic local frame buffer update for 0ms visual feedback
    const byteOffset = (row * width + col) * 4;
    if (byteOffset + 3 < cellBytes.length) {
      cellBytes[byteOffset] = activeColor.r;
      cellBytes[byteOffset + 1] = activeColor.g;
      cellBytes[byteOffset + 2] = activeColor.b;
      cellBytes[byteOffset + 3] = 1;
      render();
    }

    // Sync cell mutation to authoritative Rust Universe state
    invoke("set_cell", {
      col,
      row,
      r: activeColor.r,
      g: activeColor.g,
      b: activeColor.b,
    }).catch(console.error);
  };

  window.addEventListener("mousedown", (e) => {
    if (e.button === 0 && !e.target.closest(".hud-panel")) {
      isPainting = true;
      activeColor = getRandomVibrantColor();
      paintCellAtMouse(e);
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (isPainting) {
      paintCellAtMouse(e);
    }
  });

  window.addEventListener("mouseup", () => {
    isPainting = false;
  });

  window.addEventListener("blur", () => {
    isPainting = false;
  });

  // Dynamic Window Resize Handling (with Minimized-Window & Stale-Epoch Guards)
  window.addEventListener("resize", async () => {
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // Guard against minimized window events (where innerWidth/innerHeight drop to 0)
    if (winW < CELL_SIZE || winH < CELL_SIZE) return;

    const nextWidth = Math.max(1, Math.ceil(winW / CELL_SIZE));
    const nextHeight = Math.max(1, Math.ceil(winH / CELL_SIZE));

    const myEpoch = ++stateEpoch;
    const buffer = await invoke("resize_universe", {
      width: nextWidth,
      height: nextHeight,
    });

    // Apply new canvas dimensions and buffer atomically only if this is the latest state
    if (myEpoch === stateEpoch) {
      width = nextWidth;
      height = nextHeight;
      canvas.width = winW;
      canvas.height = winH;
      bloomCanvas.width = Math.ceil(winW / 2);
      bloomCanvas.height = Math.ceil(winH / 2);
      ctx.imageSmoothingEnabled = false;
      cellBytes = toUint8Array(buffer);
      render();
    }
  });

  // Initial draw and kick off animation
  setPlaybackState(true);
  updateSpeedUI();
  updateLifespanUI();
  setHelper(null);
  render();
  requestAnimationFrame(loop);
}

main().catch(console.error);
