use crate::page_builder::{Component, ComponentStore};
use std::ffi::OsStr;
use std::path::Path;
use walkdir::WalkDir;

pub fn compute_components(components_directory: &Path) -> Option<ComponentStore> {
    let mut component_store: ComponentStore = ComponentStore::new();
    let walker = WalkDir::new(components_directory);

    for file in walker.into_iter() {
        let file: walkdir::DirEntry = match file {
            Ok(file) => file,
            Err(error) => {
                println!("Unable to walk file '{}'", error);
                continue;
            }
        };

        let file_path = file.path();
        let file_type = file.file_type();

        // can't parse directories
        if file_type.is_dir() {
            continue;
        }

        // otherwise, it's a file. we can parse it.

        let extension = match file_path.extension() {
            // no extension - can't do anything
            None => continue,
            Some(extension) => get_component_extension(extension),
        };

        let name = file_path.file_stem()?.to_str()?.to_owned();
        let data = match std::fs::read_to_string(file_path) {
            Ok(data) => data,
            Err(_) => {
                println!("[WARN] couldn't read file '{}'", file_path.display());
                continue;
            }
        };

        match extension {
            ComponentExtension::Xml => match component_store.store_xml(name, data) {
                Ok(_) => continue,
                Err(_) => {
                    println!(
                        "[WARN] couldn't parse XML of component '{}'",
                        file_path.display()
                    );
                    continue;
                }
            },
            ComponentExtension::Css => match component_store.store_css(name, data) {
                Ok(_) => continue,
                Err(_) => {
                    println!(
                        "[WARN] couldn't parse CSS of component '{}'",
                        file_path.display()
                    );
                    continue;
                }
            },
            ComponentExtension::Invalid => {
                println!(
                    "[WARN] found invalid extension type for component: '{}'",
                    file.path().display()
                );
                continue;
            }
        }
    }

    Some(component_store)
}

enum ComponentExtension {
    Xml,
    Css,
    Invalid,
}

#[inline]
fn get_component_extension(extension: &OsStr) -> ComponentExtension {
    let extension = match extension.to_str() {
        Some(string_slice) => string_slice,
        None => return ComponentExtension::Invalid,
    };

    match extension {
        "html" => ComponentExtension::Xml,
        "xml" => ComponentExtension::Xml,
        "css" => ComponentExtension::Css,
        _ => ComponentExtension::Invalid,
    }
}
