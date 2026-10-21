//! Desktop Executable Entry Point (`src/main.rs`)
//!
//! Keeps `main.rs` minimal by delegating directly to `cellular_automata::run()`.
//! The `windows_subsystem = "windows"` attribute prevents an extra terminal console
//! window from popping up alongside the GUI in production release builds on Windows.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cellular_automata::run();
}
