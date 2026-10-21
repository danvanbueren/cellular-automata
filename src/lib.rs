//! Cellular Automata Library (Wasm Entry Point)
//!
//! This file is the library root. When compiling for WebAssembly,
//! `wasm-bindgen` exports the items marked `#[wasm_bindgen]` from here.

mod universe;

pub use universe::Universe;
