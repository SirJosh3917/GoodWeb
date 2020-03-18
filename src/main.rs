extern crate handlebars;
extern crate roxmltree;
extern crate walkdir;

mod page_builder;
mod templating;
mod website_parser;

use std::fs::File;
use std::io::Write;
use std::path::Path;

fn main() {
    match main_option() {
        Some(_) => return,
        None => println!("Exited on error."),
    };
}

fn main_option() -> Option<()> {
    // for debugging
    std::env::set_current_dir(Path::new("website")).unwrap();

    println!("good-web compiler {}", env!("CARGO_PKG_VERSION"));
    println!(
        "building in current directory ('{}')",
        std::env::current_dir().unwrap().display()
    );

    ensure_build_exists()?;

    println!("parsing components...");
    let component_store = website_parser::compute_components(Path::new("components"))?;

    println!("parsing pages...");
    let pages = website_parser::compute_components(Path::new("pages"))?;

    println!("building pages...");
    for (key, page) in pages.components.iter() {
        println!("building '{}'", key);
        let result = page_builder::build_page(page, &component_store)?;

        let mut html_name = String::from("build/");
        html_name.push_str(key);
        html_name.push_str(".html");

        let component_path = Path::new(&html_name);
        let mut file = match File::create(component_path) {
            Ok(file) => file,
            Err(_) => {
                println!("[ERR] can't open file '{}'", component_path.display());
                continue;
            }
        };

        match file.write(result.xml().as_bytes()) {
            Ok(_) => (),
            Err(_) => {
                println!(
                    "[ERR] couldn't write xml to file '{}'",
                    component_path.display()
                );
            }
        };

        let mut css_name = String::from("build/");
        css_name.push_str(key);
        css_name.push_str(".css");

        let component_path = Path::new(&css_name);
        let mut file = match File::create(component_path) {
            Ok(file) => file,
            Err(_) => {
                println!(
                    "[ERR] couldn't write css to file '{}'",
                    component_path.display()
                );
                continue;
            }
        };

        for component_used in result.components_used() {
            let component = component_store.find_component_by_id(*component_used)?;

            match file.write(component.css_data().as_bytes()) {
                Ok(_) => (),
                Err(_) => {
                    println!(
                        "[ERR] couldn't write css to file '{}'",
                        component_path.display()
                    );
                }
            };
        }
    }

    Some(())
}

fn ensure_build_exists() -> Option<()> {
    delete_build()?;

    let directory = Path::new("build");
    std::fs::create_dir(directory);
    Some(())
}

fn delete_build() -> Option<()> {
    const MAX_TRIES: i32 = 3;
    let mut tries = 0;
    let directory = Path::new("build");

    loop {
        if !directory.exists() {
            return Some(());
        }

        match std::fs::remove_dir_all(directory) {
            Ok(_) => return Some(()),
            Err(_) => {
                tries += 1;
                println!(
                    "failed to cleanup 'build' - attempt {}/{}",
                    tries, MAX_TRIES
                );
            }
        };

        if tries == 3 {
            println!("couldn't cleanup 'build'.");
            return None;
        }
    }
}
