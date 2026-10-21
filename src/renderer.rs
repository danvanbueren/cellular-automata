//! Renderer Module: Desktop Window & Pixel Buffer
//!
//! Translates the simulation's genetic RGB cells directly into 32-bit pixel colors
//! for the OS window using `minifb`.

use minifb::{Scale, Window, WindowOptions};
use crate::universe::Universe;

const COLOR_DEAD: u32 = 0x0006080D; // Deep dark slate void

pub struct GuiRenderer {
    window: Window,
    pixel_buffer: Vec<u32>,
    width: usize,
    height: usize,
}

impl GuiRenderer {
    pub fn new(title: &str, width: usize, height: usize) -> Result<Self, minifb::Error> {
        let mut window_options = WindowOptions::default();
        window_options.scale = Scale::X4;
        window_options.resize = true; // Enable native OS window resizing

        let window = Window::new(title, width, height, window_options)?;
        let pixel_buffer = vec![COLOR_DEAD; width * height];

        Ok(GuiRenderer {
            window,
            pixel_buffer,
            width,
            height,
        })
    }

    /// Resizes the frame buffer to match new window pixel dimensions.
    pub fn resize(&mut self, width: usize, height: usize) {
        self.width = width;
        self.height = height;
        self.pixel_buffer = vec![COLOR_DEAD; width * height];
    }

    pub fn render(&mut self, universe: &Universe) -> Result<(), minifb::Error> {
        for row in 0..self.height {
            for col in 0..self.width {
                let idx = row * self.width + col;
                let cell = universe.cell_at(col, row);

                let color = if cell.is_alive() {
                    ((cell.r as u32) << 16) | ((cell.g as u32) << 8) | (cell.b as u32)
                } else {
                    COLOR_DEAD
                };
                self.pixel_buffer[idx] = color;
            }
        }

        self.window.update_with_buffer(&self.pixel_buffer, self.width, self.height)
    }

    pub fn window(&self) -> &Window {
        &self.window
    }

    pub fn window_mut(&mut self) -> &mut Window {
        &mut self.window
    }
}
