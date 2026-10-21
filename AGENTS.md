# AGENTS.md - Cellular Automata Tutor Guidelines & Project Memory

## Project Mission
We are building a simple, high-performance Cellular Automata simulation (starting with Conway's Game of Life and expanding to emergent life-like patterns) in Rust, rendered both as a native desktop window and via WebAssembly in a browser.
Inspiration reference: *Artificial Life* by Emergent Garden (YouTube: https://www.youtube.com/watch?v=2g-CrQfYNtE).

---

## User Profile & Preferences
- **Experience**: Extensive in HTML, CSS, JavaScript; familiar with Python and Java. Complete beginner to Rust.
- **Tutor Persona**: Act as an encouraging, pedagogical mentor. Explain *what* each file does, *why* Rust does things differently (borrow checker, ownership, lack of null/classes), and relate concepts to JavaScript/Java/Python where helpful.
- **Hands-on Execution**: 
  - **Code files**: The agent must apply code edits directly to project files (do not force the user to copy/paste large files).
  - **Commands**: The agent should guide the user through commands (e.g. `cargo run`, `cargo test`, `wasm-pack build`), explaining what each command does and letting the user run them unless instructed otherwise.
- **Code Readability & Modularity**:
  - Maximize readability. Avoid monolithic files. Split code into logical, single-responsibility modules (e.g., `universe.rs`, `renderer.rs`, etc.).
  - Document every struct, enum, and method with beginner-friendly doc comments (`///`) explaining both the concept and the Rust syntax being used.
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

### 1. WebAssembly & `wasm-bindgen` Boundaries
- **Multiple `impl` Blocks**: Do not put internal Rust helpers inside `#[wasm_bindgen] impl Universe`. Rust allows multiple `impl` blocks for the same struct:
  - Use `#[wasm_bindgen] impl Universe` **only** for methods exported to JavaScript.
  - Use a standard `impl Universe` block for internal Rust helpers (like `cell_at` returning a Rust struct or `get_index`). This prevents `IntoWasmAbi` trait-bound compilation errors.
- **Zero-Copy Memory Access**: Expose raw pointers (`universe.cells_ptr()`) from Rust to linear Wasm memory so JavaScript can wrap them in a `Uint8Array(wasm.memory.buffer, ...)` for maximum rendering speed without serialization.

### 2. Dual Target Architecture (Native Desktop vs. Wasm)
- **Target-Specific Dependencies**: In `Cargo.toml`, desktop crates like `minifb` must be placed under:
  ```toml
  [target.'cfg(not(target_arch = "wasm32"))'.dependencies]
  minifb = "0.29.0"
  ```
  This prevents `wasm32-unknown-unknown` compilation failures.
- **Windows MSVC Symbol Collision**: When a crate has both a `[lib]` and a `[[bin]]`, naming them identically causes Windows `.pdb` filename collision warnings. Always name the binary distinctly:
  ```toml
  [[bin]]
  name = "cellular-desktop"
  path = "src/main.rs"
  ```

### 3. Simulation & Memory Design
- **1D Vector Flattening**: Grids are always flattened to 1D vectors (`row * width + col`) for CPU cache locality and direct compatibility with pixel buffers.
- **Unsigned Math & Wrapping**: Avoid underflow on `usize` when wrapping coordinates. Use `(coord + dimension - 1) % dimension` rather than subtracting from zero.
- **Packed 4-Byte Structs**: Keep cell representations compact (`#[repr(C)] pub struct Cell { pub r: u8, pub g: u8, pub b: u8, pub age: u8 }`) aligning to 32-bit boundaries for uniform Wasm memory and direct RGB color blending.
- **Borrow Checker with Internal State**: Avoid calling mutable methods on `self` (like `self.next_random()`) while iterating over `&mut self.cells`. Keep a local PRNG variable to satisfy Rust's aliasing rules.
