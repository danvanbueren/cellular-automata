//! Cellular Automata Library Root (`src/lib.rs`)
//!
//! Following Rust and Tauri v2 community conventions ("Thin `main.rs`, Fat `lib.rs`"),
//! all modules and application builder wiring live here inside `lib.rs`.
//! This guarantees that `universe.rs` is compiled only once across both unit tests
//! and the desktop executable.

pub mod commands;
pub mod universe;

use commands::SimulationState;
pub use universe::Universe;

/// Initializes managed simulation state, registers Tauri IPC command handlers,
/// and launches the native OS WebView window.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SimulationState::new(256, 160))
        .invoke_handler(tauri::generate_handler![
            commands::init_universe,
            commands::tick_universe,
            commands::resize_universe,
            commands::populate_random,
            commands::clear_universe,
            commands::set_cell,
            commands::spawn_glider,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
