//! Tauri IPC Commands & Managed Application State
//!
//! This module bridges our pure Rust [`Universe`] engine to the frontend WebView.
//!
//! ### Key Rust & Tauri Concepts Used Here
//! - **`std::sync::Mutex` (Thread-Safe Interior Mutability)**:
//!   Tauri IPC commands can be invoked asynchronously across worker threads.
//!   Because Rust's borrow checker forbids shared mutable globals, we wrap [`Universe`]
//!   inside a `Mutex`. Calling `.lock()` grants exclusive `&mut Universe` access for the
//!   duration of the command and automatically releases the lock when the variable goes
//!   out of scope (RAII: Resource Acquisition Is Initialization).
//! - **`tauri::ipc::Response` (Zero-JSON Binary Transfer)**:
//!   Returning `Response::new(Vec<u8>)` streams raw binary bytes directly into a
//!   JavaScript `ArrayBuffer` without slow JSON array serialization.

use std::sync::{Mutex, MutexGuard};
use tauri::ipc::Response;
use tauri::State;

use crate::universe::Universe;

/// Managed application state shared across all Tauri IPC command invocations.
pub struct SimulationState {
    pub universe: Mutex<Universe>,
}

impl SimulationState {
    /// Creates a new [`SimulationState`] initialized with default grid dimensions.
    pub fn new(width: usize, height: usize) -> Self {
        Self {
            universe: Mutex::new(Universe::new(width, height)),
        }
    }

    /// Acquires exclusive mutable access to the [`Universe`], recovering gracefully
    /// if a lock was ever poisoned instead of panicking with `.unwrap()`.
    fn lock_universe(&self) -> MutexGuard<'_, Universe> {
        self.universe
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

/// Initializes (or re-initializes) the universe to `width × height`, populates it
/// with a multi-species primordial soup, and returns the raw `[r, g, b, age]` frame buffer.
#[tauri::command]
pub fn init_universe(
    state: State<'_, SimulationState>,
    width: usize,
    height: usize,
    seed: u64,
    density: f32,
) -> Response {
    let mut universe = state.lock_universe();
    *universe = Universe::new(width.max(1), height.max(1));
    universe.populate_random(seed, density);
    Response::new(universe.to_bytes())
}

/// Advances the simulation by one generation and returns the updated binary frame buffer.
#[tauri::command]
pub fn tick_universe(
    state: State<'_, SimulationState>,
    max_age: u8,
    enable_genesis: bool,
) -> Response {
    let mut universe = state.lock_universe();
    universe.tick(max_age, enable_genesis);
    Response::new(universe.to_bytes())
}

/// Dynamically resizes the universe grid while preserving existing cells,
/// returning the resized binary frame buffer.
#[tauri::command]
pub fn resize_universe(
    state: State<'_, SimulationState>,
    width: usize,
    height: usize,
) -> Response {
    let mut universe = state.lock_universe();
    universe.resize(width.max(1), height.max(1));
    Response::new(universe.to_bytes())
}

/// Re-seeds the current universe with a fresh primordial soup and returns the binary frame buffer.
#[tauri::command]
pub fn populate_random(
    state: State<'_, SimulationState>,
    seed: u64,
    density: f32,
) -> Response {
    let mut universe = state.lock_universe();
    universe.populate_random(seed, density);
    Response::new(universe.to_bytes())
}

/// Clears all cells to dead void and returns the empty binary frame buffer.
#[tauri::command]
pub fn clear_universe(state: State<'_, SimulationState>) -> Response {
    let mut universe = state.lock_universe();
    universe.clear();
    Response::new(universe.to_bytes())
}

/// Paints a single living cell with the specified RGB genetic color.
///
/// Does not return the full frame buffer because the frontend applies an immediate
/// optimistic update to its local `Uint8Array` for zero-latency mouse dragging.
#[tauri::command]
pub fn set_cell(
    state: State<'_, SimulationState>,
    col: usize,
    row: usize,
    r: u8,
    g: u8,
    b: u8,
) {
    let mut universe = state.lock_universe();
    universe.set_cell(col, row, r, g, b);
}

/// Spawns a glider pattern at `(col, row)` with the given RGB lineage and returns the binary frame buffer.
#[tauri::command]
pub fn spawn_glider(
    state: State<'_, SimulationState>,
    col: usize,
    row: usize,
    r: u8,
    g: u8,
    b: u8,
) -> Response {
    let mut universe = state.lock_universe();
    universe.spawn_glider(col, row, r, g, b);
    Response::new(universe.to_bytes())
}
