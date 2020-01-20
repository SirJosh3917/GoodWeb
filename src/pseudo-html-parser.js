/// <reference path="./pseudo-html-parser.d.ts"/>
// I've tried frick tons of libraries. None of them work nicely. Rolling my own.

class PseudoHTML {

	/**
	 * @param {string} html
	 */
	parse(html) {
		const root = {
			nodeName: '#document',
			nodeAttributes: [],
			childNodes: []
		};

		for (const node of domize(tokenize(html))) {
			root.childNodes.push(node);
		}

		return root;
	}

	stringify(node) {
		if (node.nodeName === "#document") {
			return this.stringifyNodes(node);
		}

		if (node.nodeName === "#text") {
			return node.nodeValue;
		}

		let result = "<";
		result += node.nodeName;
		
		for (let i = 0; i < node.nodeAttributes.length; i++) {
			const attribute = node.nodeAttributes[i];

			result += " ";
			result += attribute.name;
			result += "=";
			result += "\"";
			result += attribute.value;
			result += "\"";
		}

		if (node.childNodes.length === 0) {
			result += "/>";
			return result;
		}

		result += ">";
		result += this.stringifyNodes(node);
		result += "</" + node.nodeName + ">";
		return result;
	}

	stringifyNodes(node) {
		let result = "";

		for (let i = 0; i < node.childNodes.length; i++) {
			result += this.stringify(node.childNodes[i]);
		}

		return result;
	}

	querySelector(node, selector) {
		// TODO: actually support a query by selector
		if (node.nodeName === selector) return node;

		for (let i = 0; i < node.childNodes.length; i++) {
			const result = this.querySelector(node.childNodes[i], selector);

			if (result !== undefined) {
				return result;
			}
		}

		return undefined;
	}
}

const tokenTypes = {
	TagOpen: 0,
	TagClose: 1,
	TagSlash: 2,
	Text: 3,
	Equals: 4,
};

/**
 * @param {Iterable<{type: number, data?: string}>} tokens 
 */
function *domize(tokens) {
	let node = blankNode();
	let inNode = false;
	let gaveName = false;
	let attributeName = "";
	let wasSlash = false;

	let iterator = tokens[Symbol.iterator]();
	let iteratorResult = iterator.next();

	while (!iteratorResult.done) {
		const token = iteratorResult.value;

		if (!inNode) {
			if (token.type === tokenTypes.Text) {
				node.nodeName = '#text';
				node.nodeValue = token.data;
				yield node;

				node = blankNode();
				inNode = false;
				gaveName = false;
				attributeName = "";
				wasSlash = false;
			}
			else if (token.type === tokenTypes.TagOpen) {
				inNode = true;
			}
			else {
				throw 'unexpected token ' + token;
			}
		}
		else {
			if (token.type === tokenTypes.Text) {
				if (!gaveName) {
					node.nodeName = token.data;
					gaveName = true;
				}
				else {
					// otherwise on attribute
					if (attributeName.length === 0) {
						attributeName = token.data;
					}
					else {
						node.nodeAttributes.push({
							name: attributeName,
							value: token.data
						});
					}
				}
			}
			else if (token.type === tokenTypes.Equals) {
				// don't care about validating structure
			}
			else if (token.type === tokenTypes.TagSlash) {
				if (!gaveName) {
					// this means a '</'
					// we're going to skip until a >, and then return a 'closing' node.

					while (!iteratorResult.done) {
						iteratorResult = iterator.next();

						if (iteratorResult.value.type === tokenTypes.TagClose) {
							iterator.next();

							yield {
								closing: 'yep'
							};

							return;
						}
					}
				}

				wasSlash = true;
			}
			else if (token.type === tokenTypes.TagClose) {
				if (wasSlash) {
					yield node;
					node = blankNode();
					inNode = false;
					gaveName = false;
					attributeName = "";
					wasSlash = false;
				}
				else {
					// we are now going to be processing html tags inside of this html tag thing
					for (const innerNode of domize({
						[Symbol.iterator]: () => iterator
					})) {
						if (innerNode.closing !== undefined) {
							// if it has 'closing', it's a closing node.
							// that means it's directed at us that this node is finally finished!
							break;
						} else {
							node.childNodes.push(innerNode);
						}
					}

					yield node;
					node = blankNode();
					inNode = false;
					gaveName = false;
					attributeName = "";
					wasSlash = false;
				}
			}
		}
		
		iteratorResult = iterator.next();
	}
}

function blankNode() {
	return {
		nodeName: '#UNKNOWN',
		nodeAttributes: [],
		childNodes: []
	};
}

/**
 * @param {string} data 
 */
function *tokenize(data) {
	let state = 0;
	let stringBuild = "";

	for (let i = 0; i < data.length; i++) {
		const c = data.charAt(i);

		switch (state) {
			// 0: text without the scope of a tag
			case 0: {
				if (c === '<') {
					if (stringBuild.length > 0) {
						yield {
							type: tokenTypes.Text,
							data: stringBuild
						};

						stringBuild = "";
					}

					state = 1;
					yield {
						type: tokenTypes.TagOpen
					}
				} else {
					stringBuild += c;
				}
			} break;

			// 1: inside of a <
			case 1: {
				if (isWhitespace(c)) {
					if (stringBuild.length > 0) {
						yield {
							type: tokenTypes.Text,
							data: stringBuild
						};

						stringBuild = "";
					}

					continue;
				}
				else if (c === '=') {
					if (stringBuild.length > 0) {
						yield {
							type: tokenTypes.Text,
							data: stringBuild
						};

						stringBuild = "";
					}

					yield {
						type: tokenTypes.Equals
					};
				}
				else if (c === '"') {
					state = 2;
				}
				else if (c === '>') {
					if (stringBuild.length > 0) {
						yield {
							type: tokenTypes.Text,
							data: stringBuild
						};

						stringBuild = "";
					}

					yield {
						type: tokenTypes.TagClose
					};

					state = 0;
				}
				else if (c === '/') {
					if (stringBuild.length > 0) {
						yield {
							type: tokenTypes.Text,
							data: stringBuild
						};

						stringBuild = "";
					}

					yield {
						type: tokenTypes.TagSlash
					};
				}
				else {
					stringBuild += c;
				}
			} break;

			// inside of a "" (string, inside of quotes)
			case 2: {
				// for now we just parse until another "
				// TODO: get fancy
				if (c === '"') {
					yield {
						type: tokenTypes.Text,
						data: stringBuild
					};

					stringBuild = "";
					state = 1;
				}
				else {
					stringBuild += c;
				}
			} break;
		}
	}

	if (stringBuild.length > 0) {
		yield {
			type: tokenTypes.Text,
			data: stringBuild
		};

		stringBuild = "";
	}
}

function isWhitespace(character) {
	return character === ' ' || character === '\t' || character === '\n' || character === '\r';
}

const instance = new PseudoHTML();
module.exports.parse = instance.parse;
module.exports.stringify = instance.stringify;
module.exports.stringifyNodes = instance.stringifyNodes;
module.exports.querySelector = instance.querySelector;