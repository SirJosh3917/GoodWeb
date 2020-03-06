# GoodWeb
GoodWeb is a *pure* static website generator **(no JS)** that aims to have a react-esque feel to it. It uses a mixture of XML and the Handlebars templating engine to brew websites.

*Disclaimer: GoodWeb is my first Rust project.*

## Information
GoodWeb uses XML and Handlebars to conjure up HTML, and outputs HTML. GoodWeb uses "Components" to allow for reuse of similar XML, and "Pages" as the entrypoints for rendering.

In GoodWeb, a Component starts with an Uppercase Letter, and regular HTML starts with a lowercase letter.

See the following example for a simple example website:
```xml
<!-- /website/components/Page.xml -->
<html>
    <head>
        <title>Hello, {{ location }}!</title>
    </head>
    <body>
        <GoodWeb-Inner/>
    </body>
</html>

<!-- /website/pages/index.xml -->
<Page location="World" >
    <h1>Welcome to my {{ location }}!</h1>
</Page>

<!-- will compile into /website/build/index.html -->
<html><head><title>Hello, World!</title></head><body><h1>Welcome to my World!</h1></body></html>
```

GoodWeb uses Handlebars as the system for reusing similar pieces of text. Attributes on components modify the engine, whereas attributes on html get written. Both text, attributes on html, and attributes on components are all computed by the Handlebars engine.

**Note: After this point are hypoheticals which are planned, but not yet completed nor worked on.**

GoodWeb components will have localized CSS, so you don't have to worry about colliding names. Let GoodWeb handle it all for you.

One of the primary advantages of using GoodWeb over other static website generators, is that itwill compute your CSS styles at compile time, deleting unused CSS and minifying rule sets down into the bare minimum that is necessary. In addition, after the CSS minification, it would rename each CSS element to a very short name to save even more precious bytes. Including Bootstrap has never felt so light.

Another advantage is that GoodWeb will have packages to include components, so you could include GoodWeb Bootstrap components, and not have to worry about making the components yourself.

GoodWeb will have the ability to watch a directory, detect changes, and rebuild the project on the fly and act as a static webserver. This would allow easy modification of deployed websites.

## Usage
*Disclaimer: GoodWeb isn't ready for production yet. Use at your own risk.*

Run `goodweb` from any folder. GoodWeb expects a single directory called `website` with the following structure:
```
/website
- /components
  - ComponentName.xml
  - ComponentName.css
- /pages
  - PageName.xml
```

# Features To Be Done
- [x] Reading in XML & CSS
- [x] Generating output given a page
- [x] Outputting pages to disk
- [ ] Nested directories for pages
- [ ] Basic CSS minification
- [ ] Localized CSS styling per component
- [ ] Computed CSS minification
- [ ] HTTP server to serve pages dynamically