use std::alloc::System;

#[global_allocator]
static A: System = System;

extern crate handlebars;
extern crate roxmltree;
extern crate walkdir;

mod templating;

use std::fs;
use std::env;
use std::process::exit;
use std::ops::Range;

use handlebars::Handlebars;
use templating::TemplateEngine;

use walkdir::WalkDir;

pub struct Component {
    name: String,
    html_data: Vec<u8>,
    css_data: Vec<u8>,
}

#[derive(Debug)]
pub struct Page {
    name: String,
    data: Vec<u8>,
}

fn main() {
    println!("good-web compiler {}", env!("CARGO_PKG_VERSION"));
    println!("building in current directory ('{}')", std::env::current_dir().unwrap().display());

    std::env::set_current_dir(std::path::Path::new("example-website"));

    // wipe the last build
    {
        let build_dir = fs::read_dir("build");
        if build_dir.is_ok() {
            let mut attempts = 0;
            loop {
                if let Ok(_) = fs::remove_dir_all("build") {
                    break;
                }

                attempts += 1;
                println!("Trying to delete 'build' directory {}/{}", attempts, 3);
            }
        }
    }
    fs::create_dir("build").unwrap();

    // try to read all pages and components
    let pages = fs::read_dir("pages");
    let components = fs::read_dir("components");

    if !pages.is_ok() {
        println!("Cannot find pages.");
        exit(1);
    }

    if !components.is_ok() {
        println!("Cannot find components.");
        exit(2);
    }

    // we guarentee pages and components exist
    // let's grab every component
    let mut componentsMap: std::collections::HashMap<String, Component> = std::collections::HashMap::new();

    for entry in WalkDir::new("components").into_iter().skip(1) {
        let entry = entry.unwrap();
        let path: &std::path::Path = entry.path();

        let extension = match path.extension() {
            None => continue,
            Some(extension) => extension
        };

        let name: String = path.file_stem().unwrap().to_string_lossy().to_owned().to_string();
        let extension: String = extension.to_string_lossy().to_owned().to_string();
        let data: Vec<u8> = std::fs::read(path).unwrap();

        let entry = componentsMap.entry(name.clone()).or_insert(Component {
            name: name,
            html_data: Vec::new(),
            css_data: Vec::new()
        });

        if extension == "css" {
            entry.css_data = data;
        }
        else if extension == "html" {
            entry.html_data = data;
        }
        else {
            panic!("Expected file to end in css or html {:?}", path.display());
        }
    }

    // now, we need to read in every page
    let mut pages: Vec<Page> = Vec::new();

    for entry in WalkDir::new("pages").into_iter().skip(1) {
        let entry = entry.unwrap();
        let path: &std::path::Path = entry.path();
        let name: String = path.file_stem().unwrap().to_string_lossy().to_owned().to_string();
        let data: Vec<u8> = std::fs::read(path).unwrap();

        pages.push(Page {
            name: name,
            data: data
        });
    }

    // since we have everything we need in memory, we can process each page in parallel
    for component_built_page in pages.iter().map(|p| build_page(p, &componentsMap)) {
        println!("Built page '{}'!", component_built_page.name);
        let formatted = format!("build/{}.html", component_built_page.name);
        let file_str: &str = formatted.as_ref();
        let file_path: &std::ffi::OsStr = std::ffi::OsStr::new(file_str);

        let mut times = 0;
        loop {
            let wrote = std::fs::write(std::path::Path::new(file_path), &component_built_page.html_data);

            match wrote {
                Ok(..) => { break; },
                Err(..) => {
                    times += 1;
                    println!("Failed writing {}/{}", times, 3);
                    continue;
                }
            }
        }
    }
}

fn build_page(page: &Page, components: &std::collections::HashMap<String, Component>) -> Component {
    let registry = handlebars::Handlebars::new();
    let state = TemplateEngine::new(&registry);
    let computed = consume_children_precursor(&state, &[], &Vec::new(), &page.data, components);

    Component {
        name: page.name.clone(),
        html_data: computed,
        css_data: Vec::new()
    }
}

fn consume_children_precursor(state: &TemplateEngine, attributes: &'_ [roxmltree::Attribute<'_>], insert: &'_ Vec<u8>, raw_document: &'_ Vec<u8>, components: &std::collections::HashMap<String, Component>) -> Vec<u8> {
    // the precursor replaces GoodWeb-Inner with the actual raw inner xml data
    // first, find GoodWeb-Inner
    // then, create a new Vec<u8> with the replaced components
    // parse the document tree and pass it to consume_children

    let new_state = state.compute_state(attributes).unwrap();
    
    let document: roxmltree::Document = roxmltree::Document::parse(std::str::from_utf8(raw_document.as_ref()).unwrap()).unwrap();

    // records a list of places to directly substitute in the inner data 
    let mut modify_places: Vec<std::ops::Range<usize>> = Vec::new();

    for modification_zone in document.descendants().filter(|e| e.tag_name().name() == "GoodWeb-Inner") {
        modify_places.push(modification_zone.range());
    }

    // we can expect modify_places to be in order of each goodweb-inner
    // we'll use that to our advantage and find the "negative" areas of the
    // vector and push those in

    let mut negative_areas: Vec<std::ops::Range<usize>> = Vec::new();

    for i in 0..(modify_places.len()) {
        let current: &std::ops::Range<usize> = modify_places.get(i).unwrap();

        if i == 0 {
            negative_areas.push(0..(current.start));

            // if we also happen to be at the end, push the end as a negative area
            if i == modify_places.len() - 1 {
                negative_areas.push((current.end)..(raw_document.len()));
            }
        }
        else if i == modify_places.len() - 1 {
            negative_areas.push((current.end)..(raw_document.len()));
        }
        else {
            let previous: &std::ops::Range<usize> = negative_areas.get(i - 1).unwrap();
            negative_areas.push((previous.end)..(current.start));
        }
    }

    if modify_places.len() == 0 {
        // we would've never insert anything, so we need to insert the entire document as a negative area
        negative_areas.push(0..(raw_document.len()));
    }

    // with the negative areas in place, we know what parts of the document to include

    let mut computed_document: Vec<u8> = Vec::new();
    let mut insert_doc = false;

    for area in negative_areas {
        if insert_doc {
            computed_document.extend_from_slice(insert);
        }

        computed_document.extend_from_slice(&raw_document[area]);

        insert_doc = true;
    }
    
    let document: roxmltree::Document = roxmltree::Document::parse(std::str::from_utf8(computed_document.as_ref()).unwrap()).unwrap();

    consume_children(&new_state, &computed_document, document.root().children(), components)
}

fn consume_children(state: &TemplateEngine, data: &'_ Vec<u8>, children: roxmltree::Children<'_, '_>, components: &std::collections::HashMap<String, Component>) -> Vec<u8> {
    let mut new_page: Vec<u8> = Vec::new();

    for descendant in children {
        let child: roxmltree::Node<'_, '_> = descendant;

        if child.is_element() {
            let tag_name: &str = child.tag_name().name();

            // idk if this will ever execute
            if tag_name.len() == 0 {
                panic!("expected length of tag to be at least 1");
            }

            // if the first letter is uppercase, we will treat it as a component
            let first_char: char = tag_name.chars().next().unwrap();

            if first_char >= 'A' && first_char <= 'Z' {
                let range = child.value_range();
                let component_as_slice = &data.as_slice()[range];

                // to compute the component, we pass on the handlebars state
                // adding the attributes of the component to the state.
                //
                // then, we build the individual component replacing GoodWeb:Inner
                // with the inner component values - then compute the component.
                //
                // very recursive, very beautiful.

                let component = find_component(tag_name, &components);

                let component = match component {
                    Option::None => {
                        println!("[WARN] component without definition found - {}", tag_name);
                        continue;
                    },
                    Option::Some(x) => x
                };

                new_page.append(&mut Vec::from(consume_children_precursor(&state, child.attributes(), &Vec::from(component_as_slice), &component.html_data, &components)));
            }
            else {
                // not a computed component, include the component start/stop tags
                // but compute the body of it
                
                let range: std::ops::Range<usize> = child.value_range();

                let mut w = xmlwriter::XmlWriter::new(xmlwriter::Options {
                    use_single_quote: false,
                    ..xmlwriter::Options::default()
                });

                w.start_element(child.tag_name().name());
                for attribute in child.attributes() {
                    let attribute: &roxmltree::Attribute<'_> = attribute;
                    let solved: String = state.solve(attribute.value()).unwrap();
                    let value: &str = solved.as_ref();
                    w.write_attribute(attribute.name(), value);
                }
                w.end_element();
                let result = w.end_document();

                if range.len() == 0 {
                    // if there's no body, we don't need to compute the inner - just write out the computed tag
                    // (tag needs computing for potentially computed attributes)

                    new_page.append(&mut Vec::from(result));
                } else {
                    // there is a body - find where the node tags start and stop, write out the start tag,
                    // and then compute the inner component, and write out the end tag

                    // remove the `/` at the end of the serialized xml
                    let mut start_tag_vec = Vec::from(result);
                    remove_forward_slash(&mut start_tag_vec);

                    // serialize a single end tag
                    let mut w = xmlwriter::XmlWriter::new(xmlwriter::Options {
                        use_single_quote: false,
                        ..xmlwriter::Options::default()
                    });

                    w.start_element(child.tag_name().name());
                    let mut end_tag_vec = Vec::from(w.end_document());
                    remove_forward_slash(&mut end_tag_vec);
                    add_forward_slash(&mut end_tag_vec);

                    // stick on the tag start, compute the child elements, and stick on the tag end
                    new_page.append(&mut start_tag_vec);
                    new_page.append(&mut consume_children(&state, &data, child.children(), components));
                    new_page.append(&mut end_tag_vec);
                }
            }
        }
        else {
            // not an element, probably text or something - just include it into the final buffer
            let page_as_slice = &data.as_slice()[child.range()];
            new_page.append(&mut Vec::from(page_as_slice));
        }
    }

    new_page
}

fn remove_forward_slash(vector: &mut Vec<u8>) {
    for i in (0..vector.len()).rev() {
        if vector[i] == b"/"[0] {
            vector.remove(i);
            break;
        }
    }
}

fn add_forward_slash(vector: &mut Vec<u8>) {
    for i in 0..vector.len() {
        if vector[i] == b"<"[0] {
            vector.insert(i + 1, b"/"[0]);
            break;
        }
    }
}

fn find_component<'a>(name: &'_ str, components: &'a std::collections::HashMap<String, Component>) -> Option<&'a Component> {
    components.get(name)
}

pub trait ValueRange {
    fn value_range(&self) -> Range<usize>;
}

impl<'a, 'b> ValueRange for roxmltree::Node<'a, 'b> {
    fn value_range(&self) -> Range<usize> {
        // since .range() includes the component and we only want inner text,
        // we go through all the child nodes and find the smallest values
        // for the start of the range and the biggest values for the end of it
        let ranges = self.descendants().skip(1).map(|d| d.range());

        if ranges.clone().count() == 0 {
            Range {
                start: 0usize,
                end: 0usize
            }
        } else {
            let ranges_smallest = ranges.clone().min_by(|a, b| to_ordering(a.start, b.start)).unwrap().start;
            let ranges_biggest = ranges.clone().max_by(|a, b| to_ordering(a.start, b.start)).unwrap().end;
            let range = ranges_smallest..ranges_biggest;

            range
        }
    }
}

fn to_ordering(a: usize, b: usize) -> std::cmp::Ordering {
    if a < b {
        std::cmp::Ordering::Less
    } else if a > b {
        std::cmp::Ordering::Greater
    } else {
        std::cmp::Ordering::Equal
    }
}

pub trait TagHelpers {
    fn tag_start_length(&self, document_text: &'_ str) -> usize;
    fn tag_end_length(&self, document_text: &'_ str) -> usize;
}

impl<'a, 'b> TagHelpers for roxmltree::Node<'a, 'b> {
    fn tag_start_length(&self, document_text: &'_ str) -> usize {
        let text = &document_text[self.range()];
        let mut has_value = false;
        let mut ret_val: usize = 0;

        for token in xmlparser::Tokenizer::from(text) {
            let token: xmlparser::Token = token.unwrap();
            let size = match token {
                xmlparser::Token::ElementEnd {
                    end: xmlparser::ElementEnd::Open,
                    span
                } => {
                    let span: xmlparser::StrSpan<'_> = span;
                    let end = span.start() + span.len();
                    end
                },
                _ => continue
            };

            has_value = true;
            ret_val = size;
            break;
        }

        if !has_value {
            panic!("couldn't parse token end");
        }

        ret_val
    }
    
    fn tag_end_length(&self, document_text: &'_ str) -> usize {
        let text = &document_text[self.range()];
        let mut has_value = false;
        let mut ret_val: usize = 0;

        let iter: Vec<xmlparser::Token> = xmlparser::Tokenizer::from(text).map(|token| token.unwrap()).collect();

        for token in iter.iter().rev() {
            let token: xmlparser::Token = *token;
            let size = match token {
                xmlparser::Token::ElementEnd {
                    end: xmlparser::ElementEnd::Close(..),
                    span,
                } => {
                    let span: xmlparser::StrSpan<'_> = span;
                    let start = text.len() - span.start();
                    start
                },
                _ => continue
            };

            has_value = true;
            ret_val = size;
            break;
        }

        if !has_value {
            panic!("couldn't parse token end in txt for node {:?}:
{}
doc:
{}", &self, std::str::from_utf8(text.as_bytes()).unwrap(), std::str::from_utf8(document_text.as_bytes()).unwrap());
        }

        ret_val
    }
}