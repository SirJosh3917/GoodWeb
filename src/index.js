// this handles the entrypoint

// https://www.sitepoint.com/javascript-command-line-interface-cli-node-js/
"require strict"

console.log('started');

const CSSOM = require('cssom');
const PseudoHTML = require('./pseudo-html-parser');
const chalk = require('chalk');
const clui = require('clui');
const argv = require('minimist')(process.argv.slice(2))._;
const { parseDirectory, build } = require('./parsing');
const { NodeVisitor } = require('./nodevisitor');
import { render, ComponentStore } from './page-rendering';
const md5 = require('md5');
console.log('imported modules');

async function main(directory) {
	console.log(chalk.gray(`parsing ${directory}...`));

	const parseOptions = {
		html: data => PseudoHTML.parse(data),
		css: data => ({ raw: data, parsed: CSSOM.parse(data) })
	};

	const [components, pages] = await Promise.all([
		parseDirectory(directory + '/components', parseOptions),
		parseDirectory(directory + '/pages', parseOptions),
	]);

	console.log(chalk.greenBright(`parsed ${directory}!`));

	// @ts-ignore
	const websiteRender = render(pages, new ComponentStore(components));

	// make a css file for all of the pages
	let globalCssContent = websiteRender.componentsUsedOnEveryPage
		.map(component => component.css.raw)
		.reduce((a, b) => `${a}\r\n${b}`);

	const globalCss = {
		name: `global.${md5(globalCssContent)}.css`,
		file: globalCssContent
	};

	let files = websiteRender.pages.map(x => x.page).map(page => ({
		name: page.name + ".html",
		file: PseudoHTML.stringify(attachCss(page.document, globalCss))}
	));
	files.push(globalCss);

	build(directory, files);
}

function attachCss(document, globalCss) {
	const head = PseudoHTML.querySelector(document, 'head');
	head.childNodes.push({
		nodeName: 'link',
		nodeAttributes: [
			{ name: "rel", value: "stylesheet" },
			{ name: "href", value: globalCss.name }
		],
		childNodes: [],
		nodeValue: undefined
	});

	return document;
}

main(argv[0]).catch(console.error);