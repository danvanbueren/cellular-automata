//! Universe Module: Artificial Life with Genetic Color Blending & Spontaneous Genesis
//!
//! Each cell carries biological RGB genes and an age.
//! When parent cells reproduce, their colors blend together to produce
//! hybrid offspring. In large voids of blank space, spontaneous genesis
//! sparks new colonies with fresh genetic lineages.

use wasm_bindgen::prelude::*;

/// Packed 4-byte Cell representation.
/// `#[repr(C)]` guarantees exact byte ordering in memory:
/// [r, g, b, age] perfectly aligned to 32-bit boundaries.
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Cell {
    pub r: u8,   // Red genetic component
    pub g: u8,   // Green genetic component
    pub b: u8,   // Blue genetic component
    pub age: u8, // 0 = Dead/Empty; 1..=max_age = Alive
}

impl Cell {
    pub const DEAD: Cell = Cell { r: 0, g: 0, b: 0, age: 0 };

    #[inline]
    pub fn is_alive(&self) -> bool {
        self.age > 0
    }
}

#[wasm_bindgen]
pub struct Universe {
    width: usize,
    height: usize,
    // Flattened 2D grid: 4 bytes per cell [r, g, b, age, ...]
    cells: Vec<Cell>,
    // Internal seed for spontaneous genesis and genetic mutations
    rng_state: u64,
}

// =============================================================================
// Internal Rust Helper Methods (Not exported across the Wasm boundary)
// =============================================================================
impl Universe {
    /// Translates (col, row) into a 1D vector index
    #[inline]
    pub fn get_index(&self, col: usize, row: usize) -> usize {
        row * self.width + col
    }

    /// Accesses a cell by value (used by desktop renderer and unit tests)
    #[inline]
    pub fn cell_at(&self, col: usize, row: usize) -> Cell {
        let idx = self.get_index(col, row);
        self.cells[idx]
    }

    /// Fast pseudo-random number generator (XorShift64)
    fn next_random(&mut self) -> u64 {
        self.rng_state ^= self.rng_state << 13;
        self.rng_state ^= self.rng_state >> 7;
        self.rng_state ^= self.rng_state << 17;
        self.rng_state
    }

    /// Checks if a massive 17x17 region centered at (col, row) is completely empty void (radius 8).
    fn is_massive_blank_space(&self, col: usize, row: usize) -> bool {
        let h = self.height as i32;
        let w = self.width as i32;

        for dy in -8i32..=8i32 {
            for dx in -8i32..=8i32 {
                let check_row = ((row as i32 + dy).rem_euclid(h)) as usize;
                let check_col = ((col as i32 + dx).rem_euclid(w)) as usize;
                if self.cells[self.get_index(check_col, check_row)].is_alive() {
                    return false;
                }
            }
        }
        true
    }
}

// =============================================================================
// WebAssembly Exported Methods (Callable from JavaScript)
// =============================================================================
#[wasm_bindgen]
impl Universe {
    #[wasm_bindgen(constructor)]
    pub fn new(width: usize, height: usize) -> Universe {
        let cells = vec![Cell::DEAD; width * height];
        Universe {
            width,
            height,
            cells,
            rng_state: 88888888,
        }
    }

    pub fn width(&self) -> usize {
        self.width
    }

    pub fn height(&self) -> usize {
        self.height
    }

    /// Resizes the universe grid dynamically, preserving existing living cells within bounds.
    pub fn resize(&mut self, new_width: usize, new_height: usize) {
        if new_width == self.width && new_height == self.height {
            return;
        }

        let mut new_cells = vec![Cell::DEAD; new_width * new_height];
        let copy_cols = self.width.min(new_width);
        let copy_rows = self.height.min(new_height);

        for row in 0..copy_rows {
            for col in 0..copy_cols {
                let old_idx = row * self.width + col;
                let new_idx = row * new_width + col;
                new_cells[new_idx] = self.cells[old_idx];
            }
        }

        self.width = new_width;
        self.height = new_height;
        self.cells = new_cells;
    }

    /// Returns a raw pointer to the cell buffer in Wasm linear memory.
    /// Total bytes: `width * height * 4`.
    pub fn cells_ptr(&self) -> *const Cell {
        self.cells.as_ptr()
    }

    /// Sets a cell with a specific RGB color gene and resets its age to 1.
    pub fn set_cell(&mut self, col: usize, row: usize, r: u8, g: u8, b: u8) {
        let idx = self.get_index(col, row);
        self.cells[idx] = Cell { r, g, b, age: 1 };
    }

    /// Clears the entire board to empty void.
    pub fn clear(&mut self) {
        for cell in &mut self.cells {
            *cell = Cell::DEAD;
        }
    }

    /// Populates with a multi-species primordial soup.
    pub fn populate_random(&mut self, seed: u64, density: f32) {
        let mut rng = seed.max(1);
        let threshold = (density.clamp(0.0, 1.0) * 1000.0) as u64;

        // Base ancestral species colors
        let species = [
            (0, 229, 255), // Cyan Nebula
            (0, 255, 157), // Neon Emerald
            (255, 42, 133), // Cyber Magenta
            (255, 183, 0),  // Solar Amber
        ];

        for cell in &mut self.cells {
            rng ^= rng << 13;
            rng ^= rng >> 7;
            rng ^= rng << 17;

            if (rng % 1000) < threshold {
                let choice = ((rng >> 16) % species.len() as u64) as usize;
                let (r, g, b) = species[choice];
                *cell = Cell { r, g, b, age: 1 };
            } else {
                *cell = Cell::DEAD;
            }
        }

        self.rng_state = rng;
    }

    /// Spawns a glider carrying a specific RGB color lineage.
    pub fn spawn_glider(&mut self, start_col: usize, start_row: usize, r: u8, g: u8, b: u8) {
        let glider_coords = [(1, 0), (2, 1), (0, 2), (1, 2), (2, 2)];

        for (dx, dy) in glider_coords {
            let c = (start_col + dx) % self.width;
            let r_coord = (start_row + dy) % self.height;
            self.set_cell(c, r_coord, r, g, b);
        }
    }

    /// Advances the simulation by one generation.
    ///
    /// - Evaluates Conway survival and reproduction.
    /// - Blends RGB genetic colors of the 3 parents when reproducing.
    /// - Checks for large voids and spontaneously ignites new seedling colonies.
    pub fn tick(&mut self, max_age: u8, enable_genesis: bool) {
        let mut next_cells = self.cells.clone();

        for row in 0..self.height {
            for col in 0..self.width {
                let idx = self.get_index(col, row);
                let current_cell = self.cells[idx];

                // Gather living neighbors and their RGB genes
                let mut live_neighbor_count = 0;
                let mut parent_cells = [Cell::DEAD; 8];

                for delta_row in [self.height - 1, 0, 1] {
                    for delta_col in [self.width - 1, 0, 1] {
                        if delta_row == 0 && delta_col == 0 {
                            continue;
                        }

                        let n_row = (row + delta_row) % self.height;
                        let n_col = (col + delta_col) % self.width;
                        let n_idx = self.get_index(n_col, n_row);
                        let n_cell = self.cells[n_idx];

                        if n_cell.is_alive() {
                            parent_cells[live_neighbor_count] = n_cell;
                            live_neighbor_count += 1;
                        }
                    }
                }

                if current_cell.is_alive() {
                    let survives_neighbors = live_neighbor_count == 2 || live_neighbor_count == 3;
                    let survives_age = current_cell.age < max_age;

                    if survives_neighbors && survives_age {
                        // Cell survives and ages by 1 generation
                        next_cells[idx] = Cell {
                            r: current_cell.r,
                            g: current_cell.g,
                            b: current_cell.b,
                            age: current_cell.age + 1,
                        };
                    } else {
                        // Perishes of under/overpopulation or old age
                        next_cells[idx] = Cell::DEAD;
                    }
                } else {
                    // Reproduction: Conway Rule (exactly 3 living neighbors)
                    if live_neighbor_count == 3 {
                        let p1 = parent_cells[0];
                        let p2 = parent_cells[1];
                        let p3 = parent_cells[2];

                        // Genetic Color Blending: Average parent RGB values
                        let blended_r = ((p1.r as u32 + p2.r as u32 + p3.r as u32) / 3) as u8;
                        let blended_g = ((p1.g as u32 + p2.g as u32 + p3.g as u32) / 3) as u8;
                        let blended_b = ((p1.b as u32 + p2.b as u32 + p3.b as u32) / 3) as u8;

                        next_cells[idx] = Cell {
                            r: blended_r,
                            g: blended_g,
                            b: blended_b,
                            age: 1, // Newborn
                        };
                    }
                }
            }
        }

        // Spontaneous Genesis: Rare cosmic event occurring strictly in colossal voids.
        // Sampled once per tick with a 1-in-250 chance (~once every 10-15s at 20fps).
        if enable_genesis && (self.next_random() % 250 == 0) {
            let rnd = self.next_random();
            let c = (rnd % self.width as u64) as usize;
            let r = ((rnd >> 16) % self.height as u64) as usize;

            // Must be surrounded by a massive 17x17 region of complete void (radius 8, 288 dead cells)
            if self.is_massive_blank_space(c, r) {
                let color_rnd = self.next_random();
                let new_r = (120 + (color_rnd % 135)) as u8;
                let new_g = (120 + ((color_rnd >> 8) % 135)) as u8;
                let new_b = (120 + ((color_rnd >> 16) % 135)) as u8;

                // Seed a classic glider that sets off across the empty space
                let cluster_offsets = [(1, 0), (2, 1), (0, 2), (1, 2), (2, 2)];
                for (dx, dy) in cluster_offsets {
                    let target_col = (c + dx) % self.width;
                    let target_row = (r + dy) % self.height;
                    let t_idx = self.get_index(target_col, target_row);
                    next_cells[t_idx] = Cell {
                        r: new_r,
                        g: new_g,
                        b: new_b,
                        age: 1,
                    };
                }
            }
        }

        self.cells = next_cells;
    }
}

// -----------------------------------------------------------------------------
// Unit Tests
// -----------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blinker_oscillator() {
        let mut universe = Universe::new(5, 5);

        // Seed with Cyan (0, 229, 255)
        universe.set_cell(1, 2, 0, 229, 255);
        universe.set_cell(2, 2, 0, 229, 255);
        universe.set_cell(3, 2, 0, 229, 255);

        universe.tick(35, false);

        assert!(universe.cell_at(2, 1).is_alive());
        assert!(universe.cell_at(2, 2).is_alive());
        assert!(universe.cell_at(2, 3).is_alive());

        assert!(!universe.cell_at(1, 2).is_alive());
        assert!(!universe.cell_at(3, 2).is_alive());
    }

    #[test]
    fn test_color_blending() {
        let mut universe = Universe::new(5, 5);

        // 3 Parents with Red, Green, and Blue
        universe.set_cell(1, 2, 255, 0, 0); // Red
        universe.set_cell(2, 2, 0, 255, 0); // Green
        universe.set_cell(3, 2, 0, 0, 255); // Blue

        universe.tick(35, false);

        // The newborn child at (2, 1) should have blended color: (255+0+0)/3 = 85
        let child = universe.cell_at(2, 1);
        assert!(child.is_alive());
        assert_eq!(child.r, 85);
        assert_eq!(child.g, 85);
        assert_eq!(child.b, 85);
    }

    #[test]
    fn test_grid_resize() {
        let mut universe = Universe::new(5, 5);
        universe.set_cell(2, 2, 255, 100, 50);

        // Expand grid to 10x10
        universe.resize(10, 10);
        assert_eq!(universe.width(), 10);
        assert_eq!(universe.height(), 10);

        // Preserved original cell
        let preserved = universe.cell_at(2, 2);
        assert!(preserved.is_alive());
        assert_eq!(preserved.r, 255);

        // Newly added space is dead void
        assert!(!universe.cell_at(8, 8).is_alive());
    }
}
