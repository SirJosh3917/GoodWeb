extern crate serde;
extern crate serde_json;

use handlebars::Handlebars;
use roxmltree::Attribute;
use serde_json::{Map, Number, Value};

/// Represents an engine used for computing
pub struct TemplateEngine<'a, 'b> {
    handlebars_instance: &'a Handlebars<'b>,
    data: Map<String, Value>,
}

impl<'a, 'b> TemplateEngine<'a, 'b> {
    #[inline]
    pub fn new(engine: &'a Handlebars<'b>) -> TemplateEngine<'a, 'b> {
        TemplateEngine {
            handlebars_instance: engine,
            data: Map::new(),
        }
    }

    pub fn compute_state(&self, attributes: &'a [Attribute<'b>]) -> Option<TemplateEngine<'a, 'b>> {
        let mut new_state = self.data.clone();

        // compute new state using all of the attributes of the old
        for attribute in attributes {
            let result = self.solve(attribute.value())?;
            new_state.insert(attribute.name().to_owned(), str_to_json(result));
        }

        // new state computed
        Some(TemplateEngine {
            handlebars_instance: self.handlebars_instance,
            data: new_state,
        })
    }

    #[inline]
    pub fn data(&self) -> Value {
        Value::Object(self.data.clone())
    }

    #[inline]
    pub fn solve(&self, needs_computation: &str) -> Option<String> {
        match self
            .handlebars_instance
            .render_template(needs_computation, &self.data())
        {
            Ok(result) => Some(result),
            Err(_) => None,
        }
    }
}

#[inline]
fn str_to_json(string: String) -> Value {
    match string.parse::<f64>() {
        Ok(parsed) => f64_to_json(parsed, string),
        Err(_) => Value::String(string),
    }
}

#[inline]
fn f64_to_json(value: f64, default: String) -> Value {
    match Number::from_f64(value) {
        Some(number) => Value::Number(number),
        None => Value::String(default),
    }
}
