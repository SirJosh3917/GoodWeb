extern crate handlebars;
extern crate roxmltree;
extern crate walkdir;

mod templating;
mod page_builder;
mod website_parser;

fn main() {
    match main_option() {
        Some(_) => return,
        None => println!("Exited on error."),
    };
}

fn main_option() -> Option<()> {
    println!("good-web compiler {}", env!("CARGO_PKG_VERSION"));
    std::env::set_current_dir(std::path::Path::new("website")).unwrap();
    println!("building in current directory ('{}')", std::env::current_dir().unwrap().display());

    let component_store = website_parser::compute_components(std::path::Path::new("components"))?;
    println!("pars comps:");
    println!("parsed components: Page is {:#?}", component_store.find_component("Page")?);

    let pages = website_parser::compute_components(std::path::Path::new("pages"))?;
    println!(":pars pages");
    println!("pag index.xhtml i: {:#?}", pages.find_component("index")?);

    println!("BUILDING:");
    let result = page_builder::build_page(pages.find_component("index")?, &component_store)?;

    println!("BUILT:
{}", result.xml());

    for cmp in result.components_used() {
        println!("used: {}", cmp);
    }

    Some(())
}