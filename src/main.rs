// Declare our application modules
mod renderer;
mod universe;

use minifb::{Key, KeyRepeat};
use renderer::GuiRenderer;
use std::time::{Duration, Instant};
use universe::Universe;

fn main() {
    let width = 160;
    let height = 120;

    let mut universe = Universe::new(width, height);

    // Seed initial primordial soup with multi-species genetic colors
    let mut seed = 987654321;
    universe.populate_random(seed, 0.20);

    let mut renderer = match GuiRenderer::new("Cellular Automata - Genetic Blending", width, height) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Failed to create window: {}", e);
            return;
        }
    };

    renderer.window_mut().set_target_fps(60);

    println!("==================================================");
    println!("     CELLULAR AUTOMATA - CONTROLS");
    println!("==================================================");
    println!("  [SPACE] : Pause / Resume simulation");
    println!("  [R]     : Randomize primordial soup");
    println!("  [C]     : Clear universe");
    println!("  [G]     : Spawn a Glider at center");
    println!("  [ESC]   : Exit application");
    println!("==================================================");

    let mut is_paused = false;
    let mut last_tick = Instant::now();
    let tick_interval = Duration::from_millis(50);
    let max_age = 35;
    let enable_genesis = true;

    while renderer.window().is_open() && !renderer.window().is_key_down(Key::Escape) {
        // Dynamically resize grid and buffer when desktop window is resized
        let (win_w, win_h) = renderer.window().get_size();
        let new_cols = (win_w / 4).max(10);
        let new_rows = (win_h / 4).max(10);
        if new_cols != universe.width() || new_rows != universe.height() {
            universe.resize(new_cols, new_rows);
            renderer.resize(new_cols, new_rows);
        }

        if renderer.window().is_key_pressed(Key::Space, KeyRepeat::No) {
            is_paused = !is_paused;
            println!("Paused: {}", is_paused);
        }

        if renderer.window().is_key_pressed(Key::R, KeyRepeat::No) {
            seed = seed.wrapping_add(1337);
            universe.populate_random(seed, 0.20);
            println!("Randomized soup!");
        }

        if renderer.window().is_key_pressed(Key::C, KeyRepeat::No) {
            universe.clear();
            println!("Cleared board.");
        }

        if renderer.window().is_key_pressed(Key::G, KeyRepeat::No) {
            universe.spawn_glider(width / 2, height / 2, 0, 229, 255);
            println!("Spawned Glider at center!");
        }

        if !is_paused && last_tick.elapsed() >= tick_interval {
            universe.tick(max_age, enable_genesis);
            last_tick = Instant::now();
        }

        if let Err(e) = renderer.render(&universe) {
            eprintln!("Render error: {}", e);
            break;
        }
    }

    println!("Simulation exited cleanly.");
}
