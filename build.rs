//! Cargo Build Script (`build.rs`)
//!
//! In Rust, a `build.rs` file at the root of a package is compiled and executed
//! by Cargo *before* compiling the rest of the crate.
//! `tauri_build::build()` validates `tauri.conf.json`, processes ACL capabilities,
//! and embeds desktop application metadata/icons for the target OS.

fn main() {
    tauri_build::build();
}
