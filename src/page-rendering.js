/// <reference path="page-rendering.d.ts"/>

import PseudoHTML from './pseudo-html-parser';
import { NodeVisitor } from './nodevisitor';

// handles where pages are rendered

/** @type {import('./page-rendering').ComponentStore} */
export class ComponentStore {
	/** @param {import("./page-rendering").Component[]} components */
	constructor(components) {
		this.components = components;
	}

	findComponents(name) {
		const result = this.components.find(x => x.name.toUpperCase() === name.toUpperCase());
		return result;
	}

	/** @param {string} name */
	findComponent(name) {
		const result = this.findComponents(name);

		if (result === undefined) {
			throw `couldn't find component '${name}'.`;
		}

		return result;
	}
};

/**
 * given a node and the component that represents it,
 * this computes all computable attributes for the node, returning the computed attributes
 * and returns new state if the component isn't undefined
 * @param {any} currentState 
 * @param {import("./pseudo-html-parser").PseudoHTMLNode} node
 * @param {(import("./page-rendering").Component | undefined)?} component
 * @returns {{state: any, attributes: import("./pseudo-html-parser").PseudoHTMLNodeAttribute[]}}
 */
export function computeState(currentState, node, component) {
	const { computed, state } = computeAttributes(currentState, node.nodeAttributes)

	const result = {
		state: component === undefined ? currentState : state,
		attributes: computed
	};

	return result;
}

// https://stackoverflow.com/a/770533
function addslashes( str ) {
    return (str + '').replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
}

/**
 * 
 * @param {any} state
 * @param {import("./pseudo-html-parser").PseudoHTMLNodeAttribute[]} attributes 
 */
function computeAttributes(state, attributes) {
	let newState = { ...state };
	let computed = [];

	for (let i = 0; i < attributes.length; i++) {
		const attribute = attributes[i];

		if (attribute.value.startsWith("{") && attribute.value.endsWith("}")) {
			const computing = attribute.value.substring(1, attribute.value.length - 1);

			let computeEnvironment = "";

			for (let key in state) {
				computeEnvironment += `const ${key} = JSON.parse("${addslashes(JSON.stringify(state[key]))}");\n`
			}

			computeEnvironment += `return (${computing});`;
			computed.push({
				name: attribute.name,
				value: new Function(computeEnvironment)()
			});
		} else {
			// not an attribute to be compued
			computed.push({ ...attribute });
			newState[attribute.name] = attribute.value;
		}
	}

	return {
		computed: computed,
		state: newState
	};
}

/**
 * @param {import("./page-rendering").Component[]} pages
 * @param {import("./page-rendering").ComponentStore} componentStore
 * @returns {import('./page-rendering').RenderResult}
 */
export function render(pages, componentStore) {

	// TODO: it may be worthwhile to clean this up later (we have a componentStore for a reason)

	// we have every component and page available
	// first, we need to turn every page into an assortment of components

	// this node visitor will be used for the document

	let visitedPages = [];

	for (const page of pages) {
		const document = page.html;

		/** @type {import('./page-rendering').Component[]} */
		let componentsUsed = [];

		const visitor = new NodeVisitor((node, options) => {
			let { goodwebInnerNode, state } = options || { goodwebInnerNode: undefined, state: undefined };

			if (node.nodeName.toUpperCase() === "GOODWEB-INNER") {
				// if we have reached a GOODWEB-INNER node, we will take out 'innerNode'
				// stored in goodwebInnerNode and begin traversing the nodes there.

				// this will effectively compute a structure where the contents of the component node
				// will be substituted in
				return visitor.traverse(goodwebInnerNode, {
					goodwebInnerNode: undefined,
					state: state
				});
			}

			// for HTML, we may stumble across components
			// the only way we know if it's a component is if it's in the component store
			const component = componentStore.findComponents(node.nodeName);
			if (component === undefined || component === null) {
				if (node.nodeAttributes.length === 0) return node;

				let computedNode = { ...node };
				const result = computeState(state, computedNode, undefined);
				computedNode.nodeAttributes = result.attributes;
				return visitor.traverseInner(computedNode, { goodwebInnerNode: goodwebInnerNode, state: result.state });
			}

			// keep a running total of used components
			if (componentsUsed.find(x => x.name === component.name) === undefined) {
				componentsUsed.push(component);
			}

			// we are guarenteed to have a component at this point
			// anything inside of the current node we're on (the component)
			// will go in the <GoodWeb-Inner/> part of the node
			// so we will traverse the source of the component
			// and replace all <GoodWeb-Inner/>s with the current node (it will search
			// for the current node's child nodes.)
			const innerNode = { ...node };
			innerNode.nodeName = "#document"; // prevent recursion from looking up the component

			const result = computeState(state, node, component);

			// going to traverse the component
			const traverseNode = { ...component.html };

			return visitor.traverse(traverseNode, {
				goodwebInnerNode: innerNode,
				state: result.state
			});
		});

		/** @type {import('./pseudo-html-parser').PseudoHTMLNode} */
		const transformed = visitor.traverse(document, {
			goodwebInnerNode: undefined,
			state: {}
		});

		visitedPages.push({
			name: page.name,
			path: page.path,
			document: transformed,
			html: page.html,
			css: page.css,
			components: componentsUsed
		});
	}
	
	// use the first page to create a list of components, and then remove all the components that other pages don't have
	// that way, we will have a list of components guarenteed to be used on ALL pages.
	let minimumComponentsUsedEverywhere = visitedPages[0].components.map(component => component.name);

	for (let i = 1; i < visitedPages.length; i++) {
		const componentsList = visitedPages[i].components.map(x => x.name);

		for (let j = 0; j < minimumComponentsUsedEverywhere.length; j++) {
			if (componentsList.find(x => x === minimumComponentsUsedEverywhere[j]) === undefined) {
				minimumComponentsUsedEverywhere.splice(j, 1);
				j--;
			}
		}
	}

	/** @type {import('./page-rendering').PageRender[]} */
	let pageRenders = [];

	for (const page of visitedPages) {
		pageRenders.push({
			render: PseudoHTML.stringify(page.document),
			page: page,
			componentsUsed: page.components
		});
	}

	return { pages: pageRenders, componentsUsedOnEveryPage: minimumComponentsUsedEverywhere.map(x => componentStore.findComponent(x)) };
}