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
		html: data => PseudoHTML.parse(data, data),
		css: data => ({ raw: data, parsed: CSSOM.parse(data) })
	};

	const [components, pages] = await Promise.all([
		parseDirectory(directory + '/components', parseOptions),
		parseDirectory(directory + '/pages', parseOptions),
	]);

	console.log(chalk.greenBright(`parsed ${directory}!`));

	// @ts-ignore
	const websiteRender = render(pages, new ComponentStore(components));
	const globalCss = genCss(websiteRender.componentsUsedOnEveryPage);

	let additionalCss = [];

	let files = websiteRender.pages.map(renderResult => ({
		name: renderResult.page.name + ".html",
		file: writePage(websiteRender, renderResult, globalCss, additionalCss)
	}));

	files.push(globalCss);

	for (const cssFile of additionalCss) {
		files.push(cssFile);
	}

	// don't feel like figuring out why undefined items are being added, lmao
	build(directory, files.filter(x => x !== undefined));
}

function genCss(components) {
	if (components.length === 0) {
		return undefined;
	}

	let cssContent = components
		.map(component => component.css.raw)
		.reduce((a, b) => `${a}\n${b}`);

	const cssResult = {
		name: `global.${md5(cssContent)}.css`,
		file: cssContent
	};
	
	return cssResult;
}

/**
 * @param {import("./page-rendering").RenderResult} websiteRender
 * @param {import("./page-rendering").PageRender} render
 * @param {{ name: string; file: any; }} globalCss
 */
function writePage(websiteRender, render, globalCss, additionalCss) {
	let currentPage = render.page.document;

	if (globalCss !== undefined) {
		currentPage = attachCss(currentPage, globalCss);
	}

	const componentsNotInGlobal = render.componentsUsed
		.filter(x => websiteRender.componentsUsedOnEveryPage.find(y => y.name === x.name) === undefined);

	if (componentsNotInGlobal.length > 0) {
		// have to attach a custom css file just for the components that are used
		const pageCss = genCss(componentsNotInGlobal);
		additionalCss.push(pageCss);

		currentPage = attachCss(currentPage, pageCss);
	}

	const result = PseudoHTML.stringify(currentPage);
	return result;
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