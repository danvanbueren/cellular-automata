# Emergent Life: Cellular Automata in Rust

A high-performance desktop cellular automata simulation exploring emergent artificial life, multi-species genetic inheritance, and biological aging. Built with a native Rust simulation engine and rendered through a lightweight **Tauri v2** desktop frontend.

---

## Table of Contents
- [1. Overview](#1-overview)
- [2. Build Requirements](#2-build-requirements)
- [3. Quick Start](#3-quick-start)
- [4. Additional Commands](#4-additional-commands)
- [5. Architecture & Technical Design](#5-architecture--technical-design)
- [6. Features & Controls](#6-features--controls)
- [7. Project Structure](#7-project-structure)

---

## 1. Overview

This project implements Conway's Game of Life extended with evolutionary artificial life mechanics inspired by *Artificial Life* by Emergent Garden:

- **Multi-Species Genetics**: Cells belong to distinct genetic species (differentiated by color). When new cells are born through reproduction, they inherit the blended RGB genes of their parent neighbors, creating shifting, competing colonies.
- **Aging & Decay**: Cells age with every generation. As they near their maximum lifespan, their visual opacity decays smoothly until they perish of old age.
- **Native Desktop Architecture (Tauri v2)**:
  - **Rust Simulation Engine**: Executes grid evaluation, genetic color blending, and spontaneous void genesis in native compiled Rust.
  - **Lightweight Native WebView**: Uses the operating system's built-in WebView (WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux) via Tauri v2—avoiding standalone browser memory overhead while requiring zero frontend bundlers or `node_modules`.

---

## 2. Build Requirements

1. **Rust Toolchain**:
   - **macOS / Linux**:
     ```sh
     curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
     ```
   - **Windows**: Install via `winget install Rustlang.Rustup` or [rustup.rs](https://rustup.rs).
   - Ensure `rustc` and `cargo` are available in your `PATH`.

2. **OS WebView Dependencies**:
   - **macOS**: Included natively with macOS (`WKWebView`) and Xcode Command Line Tools (`xcode-select --install`).
   - **Windows**: Included natively on Windows 10/11 (`WebView2`).
   - **Linux**: Standard Tauri system libraries (`libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`).

---

## 3. Quick Start

Compile the Rust backend and launch the native Tauri desktop application directly from the repository root:

```sh
cargo run
```

---

## 4. Additional Commands

### Verification & Testing
Check syntax and types without generating build binaries (fast feedback):
```sh
cargo check
```

Execute built-in unit tests for the pure Rust simulation engine:
```sh
cargo test
```

### Production Release Builds
Build an optimized native desktop executable (placed in `target/release/cellular-desktop`):
```sh
cargo build --release
```

*(Optional)* If you install the Tauri CLI (`cargo install tauri-cli`), you can also package native OS installers (`.dmg` / `.app` on macOS, `.msi` / `.exe` on Windows):
```sh
cargo tauri build
```

### Multi-Platform GitHub Releases (CI/CD)
Pushing a version tag matching `v*` triggers `.github/workflows/release.yml`, which automatically builds native installers for **macOS (Apple Silicon & Intel)**, **Windows (`.msi` & `-setup.exe`)**, and **Linux (`.deb`, `.rpm`, & `.AppImage`)** and publishes them to GitHub Releases:
```sh
git tag v0.1.0
git push origin v0.1.0
```

---

## 5. Architecture & Technical Design

### Hexagonal Domain Isolation (`universe.rs` vs. `commands.rs`)
The codebase strictly separates pure simulation logic from the Tauri framework:
- **`src/universe.rs`**: 100% standard-library Rust with zero UI or Tauri dependencies.
- **`src/commands.rs`**: Wraps `Universe` inside thread-safe managed state (`std::sync::Mutex<Universe>`) and exposes `#[tauri::command]` handlers.
- **`src/lib.rs` & `src/main.rs`**: Follows the Rust and Tauri v2 *"Thin `main.rs`, Fat `lib.rs`"* convention (`cellular_automata::run()`) so modules are compiled once across unit tests and the desktop binary.

### 1D Flattened Grid Buffer
The 2D grid is stored as a continuous 1D vector (`Vec<Cell>`) rather than nested arrays. This guarantees CPU cache locality and matches linear frame buffer layouts. Coordinates are converted via:
$$\text{index} = \text{row} \times \text{width} + \text{col}$$

### Packed 4-Byte Struct & Genetic Color Blending
Each cell occupies 4 bytes aligned to 32-bit boundaries:
```rust
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Cell {
    pub r: u8,   // Red genetic component
    pub g: u8,   // Green genetic component
    pub b: u8,   // Blue genetic component
    pub age: u8, // 0 = Dead/Empty; 1..=max_age = Alive
}
```

When 3 parent cells reproduce, the child cell inherits the averaged RGB color of all three parents:
$$\text{child.R} = \frac{p_1.R + p_2.R + p_3.R}{3}, \quad \text{child.G} = \frac{p_1.G + p_2.G + p_3.G}{3}, \quad \text{child.B} = \frac{p_1.B + p_2.B + p_3.B}{3}$$

When diverse species collide at colony borders, hybrid hues emerge (e.g. Cyan + Magenta produces violet/lavender), creating an evolving living spectrum.

### Zero-JSON Binary IPC Streaming (`tauri::ipc::Response`)
Instead of serializing cell grids as JSON arrays, frame-producing commands return `tauri::ipc::Response::new(universe.to_bytes())`. This streams the raw `[r, g, b, age]` byte buffer directly across the Tauri v2 IPC bridge into a JavaScript `ArrayBuffer` / `Uint8Array`.

### Spontaneous Void Genesis
When massive areas of empty space form (verified by inspecting a colossal $17 \times 17$ window of pure void, radius 8, 288 dead cells), the simulation has a rare 1-in-250 chance per tick (~once every 10–15 seconds) to spontaneously ignite a new seedling glider colony with a vibrant, newly synthesized genetic color.

### Toroidal Boundary Wrapping
Coordinates wrap across edges using unsigned modular arithmetic (`(coord + dimension - 1) % dimension`), preventing negative underflow on `usize`.

---

## 6. Features & Controls

### Desktop Interface Features
- **Dynamic Viewport Resizing**: Resizing the desktop OS window dynamically adjusts canvas dimensions and resizes the underlying Rust simulation buffer while preserving existing colonies.
- **Edge-to-Edge Fullscreen Canvas**: The simulation dynamically scales to fill the window with seamless, flush cells.
- **Dual-Layer Phosphor Glow**: Combines razor-sharp foreground pixels (`image-rendering: pixelated`) with a wide 48px ambient bloom layer featuring temporal phosphor decay, producing a flicker-free neon aura.
- **Unified Bottom HUD & Telemetry**: Floating glassmorphic dock overlay containing uniform icon buttons and in-line fixed-width telemetry on the far right.
- **Minimal Icon Controls**:
  - Play / Pause icon toggle (`Space` hotkey)
  - Skip Ahead (Step 1 generation, clickable strictly when paused)
  - Restart / Primordial Soup icon (`R` hotkey)
  - Clear / Trash Can icon (`C` hotkey)
  - Void Genesis cosmic spark toggle (electric blue active glow)
  - 3-State Animal Speed Toggle: Cycles Tortoise (Slow / 10 Hz), Hare (Medium / 25 Hz), and Cheetah (Fast / 60 Hz)
  - 3-State Biological Lifespan Toggle: Cycles Sprout (Short / 15 GEN), Leaf (Medium / 35 GEN), and Infinity (Long / 80 GEN)
- **Centered Dynamic Action Helper**: Displays `danvanbueren/cellular-automata` by default and dynamically shows active action hints and hotkeys when hovering controls.
- **Zero-Wiggle Telemetry**: Generation and Population values are padded with dark-gray leading placeholder zeroes (e.g. `000142`) inside fixed-width containers.
- **Zero-Latency Click-to-Paint Genetics**: Every fresh mouse-down picks a new vibrant random color gene; dragging paints continuous colonies with an immediate optimistic buffer update synced asynchronously to Rust.

### Keyboard Shortcuts
- `Space`: Pause or resume simulation
- `R`: Re-randomize grid with multi-species primordial soup
- `C`: Clear board
- `G`: Spawn a vibrant Glider colony at the center of the window

---

## 7. Project Structure

```
cellular-automata/
├── .github/
│   └── workflows/
│       └── release.yml     # Automated macOS, Windows, and Linux release pipeline
├── Cargo.toml              # Rust package configuration and Tauri v2 dependencies
├── build.rs                # Cargo build script invoking tauri_build
├── tauri.conf.json         # Tauri v2 window, bundle, and frontend configuration
├── AGENTS.md               # Agent memory, coding rules, and technical constraints
├── README.md               # Documentation, guide, and command reference
├── capabilities/
│   └── default.json        # Tauri v2 security permissions for the main window
├── icons/
│   ├── 32x32.png           # Standard 32x32 RGBA PNG icon
│   ├── 128x128.png         # Standard 128x128 RGBA PNG icon
│   ├── 128x128@2x.png      # High-DPI 256x256 RGBA PNG icon
│   ├── icon.icns           # macOS application bundle icon
│   ├── icon.ico            # Windows application executable icon
│   └── icon.png            # Master 512x512 RGBA PNG icon
├── src/
│   ├── main.rs             # Thin desktop binary entry point
│   ├── lib.rs              # Library root and Tauri Builder setup (run)
│   ├── commands.rs         # Tauri IPC commands and Mutex<Universe> state
│   └── universe.rs         # Pure Rust simulation engine, genetics, and unit tests
└── www/
    ├── index.html          # Desktop WebView HTML shell
    ├── style.css           # Interface styling and glassmorphic HUD
    └── index.js            # Canvas drawing loop and Tauri binary IPC integration
```
