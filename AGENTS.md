# AGENTS.md - Cellular Automata Tutor Guidelines & Project Memory

## Project Mission
We are building a simple, high-performance Cellular Automata simulation (starting with Conway's Game of Life and expanding to emergent life-like patterns) in Rust, rendered as a native desktop application using **Tauri v2** (Desktop first, web second as a future backup).
Inspiration reference: *Artificial Life* by Emergent Garden (YouTube: https://www.youtube.com/watch?v=2g-CrQfYNtE).

---

## User Profile & Preferences
- **Experience**: Extensive in HTML, CSS, JavaScript; familiar with Python and Java. Complete beginner to Rust.
- **Tutor Persona**: Act as an encouraging, pedagogical mentor. Explain *what* each file does, *why* Rust does things differently (borrow checker, ownership, lack of null/classes, `Mutex` interior mutability), and relate concepts to JavaScript/Java/Python where helpful.
- **Hands-on Execution**: 
  - **Code files**: The agent must apply code edits directly to project files (do not force the user to copy/paste large files).
  - **Commands**: The agent should guide the user through commands (e.g. `cargo run`, `cargo test`, `cargo check`), explaining what each command does and letting the user run them unless instructed otherwise.
- **Code Readability & Modularity**:
  - Maximize readability. Avoid monolithic files. Split code into logical, single-responsibility modules (e.g., `universe.rs`, `commands.rs`, `lib.rs`, `main.rs`).
  - Document every struct, enum, and method with beginner-friendly doc comments (`///`) explaining both the concept and the Rust syntax being used.
  - Prevent vestigial code at all times; keep the codebase clean and aligned with Rust and Tauri community standards.
- **Tone & Formatting**:
  - Keep documentation, chat, and markdown clean, functional, and professional.
  - Do not use spammy emojis or fluff. Follow standard GitHub Markdown rules.
  - **README Structure**: Maintain a hyperlinked Table of Contents at the top, followed strictly by:
    1. Overview
    2. Build Requirements
    3. Quick Start
    4. Additional Commands
    5. Architecture & Technical Design
    6. Features & Controls
    7. Project Structure (Tree diagram at the end).

---

## Documentation & Agent Memory Maintenance Rules (Crucial)
- **Always Keep Markdown Synchronized**: Whenever any code is changed, added, or refactored, the agent **must** immediately review and update all relevant markdown files (`README.md`, `AGENTS.md`, and inline doc comments). Documentation must never fall out of date with the codebase.
- **Continuous Memory Growth**: Whenever the user provides new instructions, preferences, corrections, or architectural guidance during conversations, the agent **must** immediately append those learnings to this `AGENTS.md` file. Future agents rely on this document as the living project memory so that preferences and lessons are never forgotten or repeated.

---

## Agent Memory: Lessons Learned & Technical Constraints

### 1. Desktop-First Tauri v2 Architecture (Flat Root Layout)
- **Desktop First, Web Second**: Both the legacy `minifb` OS window renderer and browser-based `wasm-bindgen` / `wasm-pack` pipelines have been retired in favor of a single, unified **Tauri v2** desktop application.
- **Flat Root Crate Layout**: `Cargo.toml`, `build.rs`, `tauri.conf.json`, `capabilities/`, `icons/`, `src/`, and `www/` reside directly at the repository root so `cargo run`, `cargo check`, and `cargo test` work from the root directory without a nested `src-tauri/` subfolder.
- **Thin `main.rs`, Fat `lib.rs` Pattern**: Following Rust Book and Tauri v2 conventions, `src/lib.rs` declares the module tree (`pub mod universe; pub mod commands;`) and exports `pub fn run()`. `src/main.rs` simply calls `cellular_automata::run()`. This prevents Cargo from compiling `universe.rs` twice across library and binary targets.
- **Zero-Bundler Vanilla Frontend**: `tauri.conf.json` sets `"withGlobalTauri": true` and `"frontendDist": "./www"`, injecting `window.__TAURI__.core.invoke` directly into vanilla JavaScript without `npm`, `vite`, or `node_modules`.
- **Browser / WebView Support Policy**: Target native OS WebViews (macOS WKWebView / Safari 17.4+, Windows WebView2, Linux WebKitGTK). Do not add legacy browser polyfills or heavy frontend dependencies.

### 2. Tauri IPC & State Management
- **Hexagonal Domain Isolation**: Keep `src/universe.rs` 100% free of `tauri` imports so core simulation logic remains pure standard-library Rust, fast to unit test, and portable if a web backup target is ever added in the future.
- **Thread-Safe Interior Mutability (`Mutex<Universe>`)**: Manage simulation state via `SimulationState` wrapping `std::sync::Mutex<Universe>`, using poison-resilient locking (`unwrap_or_else(|e| e.into_inner())`) inside `src/commands.rs`.
- **Zero-JSON Binary Frame Streaming (`tauri::ipc::Response`)**: Return `tauri::ipc::Response::new(universe.to_bytes())` from frame-producing Tauri commands so the `[r, g, b, age]` buffer crosses the IPC bridge as a raw binary `ArrayBuffer` rather than a JSON-serialized number array.
- **Windows MSVC Symbol Collision**: Keep the binary named distinctly (`[[bin]] name = "cellular-desktop"` with `default-run = "cellular-desktop"`) alongside `[lib] name = "cellular_automata"` to prevent Windows `.pdb` symbol collisions.

### 3. Simulation & Memory Design
- **1D Vector Flattening**: Grids are always flattened to 1D vectors (`row * width + col`) for CPU cache locality and direct compatibility with pixel/byte buffers.
- **Unsigned Math, Zero-Dimension Clamping & PRNG Safety**:
  - Avoid underflow on `usize` when wrapping coordinates: use `(coord + dimension - 1) % dimension` rather than subtracting from zero.
  - Always clamp grid dimensions to `.max(1)` inside `Universe::new` and `Universe::resize` so `% width` and `width - 1` can never divide by zero or underflow.
  - Guard `XorShift64` state against `0` (`if self.rng_state == 0 { self.rng_state = 88888888; }`) so bitwise shifts never lock the PRNG into a permanent zero output.
- **Async IPC Race-Condition Hardening (`www/index.js`)**:
  - Maintain a monotonic `stateEpoch` counter across async IPC calls so an in-flight `tick_universe` response never overwrites a newer `clear_universe`, `populate_random`, or `resize_universe` state.
  - Guard `window` `resize` events against minimized-window zero dimensions (`innerWidth < CELL_SIZE || innerHeight < CELL_SIZE`) so minimizing the OS window never shrinks and wipes out the simulation grid.
- **Packed 4-Byte Structs**: Keep cell representations compact (`#[repr(C)] pub struct Cell { pub r: u8, pub g: u8, pub b: u8, pub age: u8 }`) aligning to 32-bit boundaries for uniform binary IPC transfer and direct RGB color blending.
- **Borrow Checker with Internal State**: Avoid calling mutable methods on `self` (like `self.next_random()`) while iterating over `&mut self.cells`. Keep a local PRNG variable to satisfy Rust's aliasing rules.
