// Import Wasm module and Universe class
import init, { Universe } from "./pkg/cellular_automata.js";

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
  RESTART: "RE-SEED",
  CLEAR: "CLEAR",

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
  const wasm = await init();
  const memory = wasm.memory;

  // Setup Fullscreen Dual Canvases (Foreground Crisp + Background Atmospheric Bloom)
  const canvas = document.getElementById("life-canvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const bloomCanvas = document.getElementById("bloom-canvas");
  const bloomCtx = bloomCanvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  bloomCanvas.width = Math.ceil(window.innerWidth / 2);
  bloomCanvas.height = Math.ceil(window.innerHeight / 2);

  let width = Math.ceil(window.innerWidth / CELL_SIZE);
  let height = Math.ceil(window.innerHeight / CELL_SIZE);
  const universe = new Universe(width, height);

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

  // State
  let isPlaying = true;
  let generation = 0;
  let enableGenesis = true;
  let activeColor = getRandomVibrantColor();
  let maxAge = lifeProfiles[lifeIdx].age;
  let targetFps = speedProfiles[speedIdx].fps;
  let lastFrameTime = performance.now();

  // Populate initial soup with colorful ancestral species
  universe.populate_random(BigInt(Date.now()), 0.20);

  // --- Render Function: Direct Linear Memory Read ---
  const render = () => {
    // 4 bytes per cell: [r, g, b, age, r, g, b, age, ...]
    const cellsPtr = universe.cells_ptr();
    const cellBytes = new Uint8Array(memory.buffer, cellsPtr, width * height * 4);

    let livingCount = 0;

    // Clear to transparent so the background radiant bloom shines through
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const cellIndex = row * width + col;
        const byteOffset = cellIndex * 4;

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

  // --- Animation Loop ---
  const loop = (currentTime) => {
    const elapsed = currentTime - lastFrameTime;
    const interval = 1000 / targetFps;

    if (isPlaying && elapsed >= interval) {
      universe.tick(maxAge, enableGenesis);
      generation++;
      lastFrameTime = currentTime - (elapsed % interval);
      render();
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

  playPauseBtn.addEventListener("click", () => {
    setPlaybackState(!isPlaying);
    setHelper(getDynamicHelper(playPauseBtn));
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target === document.body) {
      e.preventDefault();
      setPlaybackState(!isPlaying);
      setHelper(getDynamicHelper(playPauseBtn));
    }
  });

  stepBtn.addEventListener("click", () => {
    if (!isPlaying) {
      universe.tick(maxAge, enableGenesis);
      generation++;
      render();
    }
  });

  randomBtn.addEventListener("click", () => {
    universe.populate_random(BigInt(Math.floor(Math.random() * 1_000_000)), 0.20);
    generation = 0;
    render();
  });

  clearBtn.addEventListener("click", () => {
    universe.clear();
    generation = 0;
    render();
  });

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

  // Canvas Mouse Painting
  let isPainting = false;

  const paintCellAtMouse = (e) => {
    const col = Math.min(Math.max(Math.floor(e.clientX / CELL_SIZE), 0), width - 1);
    const row = Math.min(Math.max(Math.floor(e.clientY / CELL_SIZE), 0), height - 1);

    universe.set_cell(col, row, activeColor.r, activeColor.g, activeColor.b);
    render();
  };

  window.addEventListener("mousedown", (e) => {
    if (!e.target.closest(".hud-panel")) {
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

  // Dynamic Window Resize Handling
  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    bloomCanvas.width = Math.ceil(window.innerWidth / 2);
    bloomCanvas.height = Math.ceil(window.innerHeight / 2);

    width = Math.ceil(window.innerWidth / CELL_SIZE);
    height = Math.ceil(window.innerHeight / CELL_SIZE);

    universe.resize(width, height);
    ctx.imageSmoothingEnabled = false;
    render();
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
