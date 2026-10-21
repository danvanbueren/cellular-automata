# Emergent Life: Cellular Automata in Rust

A high-performance cellular automata simulation exploring emergent artificial life, multi-species genetic inheritance, and biological aging. Built with Rust and compiled to both WebAssembly and a native desktop window.

---

## Table of Contents
- [1. Overview](#1-overview)
- [2. Build Requirements](#2-build-requirements)
- [3. Quick Start](#3-quick-start)
- [4. Additional Commands](#4-additional-commands)
- [5. Architecture & Technical Design](#5-architecture--technical-design)
- [6. Application Features & Controls](#6-application-features--controls)
- [7. Project Structure](#7-project-structure)

---

## 1. Overview

This project implements Conway's Game of Life extended with evolutionary artificial life mechanics inspired by *Artificial Life* by Emergent Garden:

- **Multi-Species Genetics**: Cells belong to distinct genetic species (differentiated by color). When new cells are born through reproduction, they inherit the majority gene of their parent neighbors, creating shifting, competing colonies.
- **Aging & Decay**: Cells age with every generation. As they near their maximum lifespan, their visual opacity decays smoothly until they perish of old age.
- **Dual Runtime Targets**:
  - **WebAssembly**: Uses `wasm-bindgen` and shared linear memory for zero-copy rendering into an HTML5 `<canvas>` via JavaScript typed arrays (`Uint8Array`).
  - **Native Desktop**: A standalone cross-platform desktop application powered by `minifb`.

---

## 2. Build Requirements

1. **Rust Toolchain**:
   - Install via `winget install Rustlang.Rustup` or [rustup.rs](https://rustup.rs).
   - Ensure `rustc` and `cargo` are available in your PATH.

2. **Wasm Build Tool** (for web builds):
   - Install `wasm-pack`:
     ```powershell
     cargo install wasm-pack
     ```

3. **Local HTTP Server** (for viewing the web application):
   - Python 3 (`python -m http.server`) or Node.js (`npx serve`).

---

## 3. Quick Start

### Option A: Web Application (Browser + WebAssembly)

1. Compile the Rust library to WebAssembly and generate JavaScript bindings:
   ```powershell
   wasm-pack build --target web --out-dir www/pkg
   ```

2. Start the local HTTP server:
   ```powershell
   python -m http.server 8080 --directory www
   ```
   *(Or with Node: `npx serve www`)*

3. Open your browser to:
   ```
   http://localhost:8080
   ```

### Option B: Native Desktop Window

Launch the desktop GUI window directly:
```powershell
cargo run --bin cellular-desktop
```

---

## 4. Additional Commands

### Verification & Testing
Check syntax and types without generating build binaries (fast feedback):
```powershell
cargo check
```

Execute built-in unit tests:
```powershell
cargo test
```

### Production Release Builds
Build an optimized native desktop binary (placed in `target/release/`):
```powershell
cargo build --release --bin cellular-desktop
```

Build an optimized, minified WebAssembly package:
```powershell
wasm-pack build --target web --out-dir www/pkg --release
```

---

## 5. Architecture & Technical Design

### 1D Flattened Grid Buffer
The 2D grid is stored as a continuous 1D vector rather than nested arrays. This guarantees CPU cache locality and matches graphics buffer structures. Coordinates are converted via:
$$\text{index} = \text{row} \times \text{width} + \text{col}$$

### Packed 4-Byte Struct & Genetic Color Blending
To minimize memory overhead and keep WebAssembly transfer costs at zero, each cell occupies exactly 4 bytes (aligned to 32-bit boundaries):
```rust
#[repr(C)]
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

### Spontaneous Void Genesis
When massive areas of empty space form (verified by inspecting a colossal $17 \times 17$ window of pure void, radius 8, 288 dead cells), the simulation has a rare 1-in-250 chance per tick (~once every 10–15 seconds) to spontaneously ignite a new seedling colony with a vibrant, newly synthesized genetic color. This threshold guarantees that colonies emerge only rarely in vast, undisturbed cosmic silence.

### Zero-Copy Shared Memory
The Rust WebAssembly library exposes a raw pointer (`universe.cells_ptr()`) to its internal cell buffer. JavaScript wraps this pointer in a typed array without serialization or copying:
```javascript
const cells = new Uint8Array(memory.buffer, universe.cells_ptr(), width * height * 4);
```

### Dual `impl` Block Pattern
To prevent trait-bound compilation errors (`IntoWasmAbi`):
- `#[wasm_bindgen] impl Universe`: Strictly methods exported across the WebAssembly boundary to JavaScript.
- Standard `impl Universe`: Internal Rust helper methods (`cell_at`, `get_index`) used by native renderers and unit tests.

### Toroidal Boundary Wrapping
Coordinates wrap across edges using unsigned modular arithmetic (`(coord + dimension - 1) % dimension`), preventing negative underflow on `usize`.

---

## 6. Application Features & Controls

### Web Interface Features
- **Dynamic Viewport Resizing**: Resizing the browser window dynamically adjusts canvas dimensions and the simulation buffer without stretching or distorting pixels. Existing colonies are preserved.
- **Edge-to-Edge Fullscreen Canvas**: The simulation dynamically scales to fill the entire browser viewport with seamless, flush cells (no black grid lines).
- **Dual-Layer Phosphor Glow**: Combines razor-sharp foreground pixels (`image-rendering: pixelated`) with a wide 48px ambient bloom layer featuring temporal phosphor decay, producing a completely flicker-free, fluid neon aura.
- **Unified Bottom HUD & Telemetry**: Clean floating dock overlay containing uniform icon buttons and in-line fixed-width telemetry on the far right.
- **Strict Monospaced Typography**: All labels and telemetry use `JetBrains Mono` for a cohesive cybernetic aesthetic.
- **Minimal Icon Controls**:
  - Play / Pause icon toggle (`Space` hotkey)
  - Skip Ahead (Step 1 generation, clickable strictly when paused)
  - Restart / Primordial Soup icon
  - Clear / Trash Can icon
  - Void Genesis cosmic spark toggle (electric blue active glow)
  - 3-State Animal Speed Toggle: Cycles Tortoise (Slow / 10 FPS), Hare (Medium / 25 FPS), and Cheetah (Fast / 60 FPS) with animal vector icons
  - 3-State Biological Lifespan Toggle: Cycles Sprout (Short / 15 GEN), Leaf (Medium / 35 GEN), and Infinity (Long / 80 GEN) with vitality vector icons
- **Centered Dynamic Action Helper**: Replaces browser hover tooltips with an in-dock centered helper line that displays `danvanbueren/cellular-automata` by default and dynamically shows active action hints when hovering controls.
- **Zero-Wiggle Telemetry**: Generation and Population values are padded with dark-gray leading placeholder zeroes (e.g. `000142`) inside fixed-width containers with truncated overflow, eliminating all layout shifting.
- **Dynamic Click-to-Paint Genetics**: Every fresh mouse-down picks a new vibrant random color gene; holding and dragging paints continuous colonies of that color across the canvas.
- **Genetic Color Blending**: Living cells blend parent RGB genes when reproducing, producing evolving gradient borders where colonies meet.

### Desktop Features & Hotkeys
- **Resizable Window**: The desktop OS window can be freely resized, dynamically expanding or cropping simulation cells at a crisp 4x scale.
- `Space`: Pause or resume simulation
- `R`: Re-randomize grid with multi-species primordial soup
- `C`: Clear board
- `G`: Spawn a Glider pattern at the center
- `Esc`: Close window

---

## 7. Project Structure

```
cellular-automata/
├── Cargo.toml          # Rust package configuration and dependencies
├── AGENTS.md           # Agent memory, coding rules, and technical constraints
├── README.md           # Documentation, guide, and command reference
├── src/
│   ├── lib.rs          # Library root and WebAssembly exports
│   ├── main.rs         # Native desktop application entry point
│   ├── universe.rs     # Core simulation engine, genetics, and rules
│   └── renderer.rs     # Desktop pixel buffer window renderer (minifb)
└── www/
    ├── index.html      # Web application shell
    ├── style.css       # Interface styling and glassmorphic HUD
    ├── index.js        # Canvas drawing loop and Wasm memory integration
    └── pkg/            # WebAssembly binaries and bindings (wasm-pack output)
```
