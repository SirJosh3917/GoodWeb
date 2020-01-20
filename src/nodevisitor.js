/**
 * Class to traverse and produce a tree of nodes.
 */
class NodeVisitor {
	/**
	 * 
	 * @param {(node: import("./pseudo-html-parser").PseudoHTMLNode, options?: any) => import("./pseudo-html-parser").PseudoHTMLNode} mutator 
	 */
	constructor(mutator) {
		this.mutator = (a, b) => {
			const result = mutator(a, b);
			if (result.nodeName === "GoodWeb-Inner") {
				console.log("returned a fudging mother fudging gOODWEBINNER FRICK");
				console.trace();
			}
			return result;
		}
	}

	/**
	 * 
	 * @param {import("./pseudo-html-parser").PseudoHTMLNode} node 
	 * @param {any?} options
	 * @returns {import("./pseudo-html-parser").PseudoHTMLNode}
	 */
	traverse(node, options) {
		if (node == null) {
			console.log('node NULL');
			console.trace();
		}
		if (options.state === undefined) {
			console.log('ERR on node %s', JSON.stringify(node));
		}

		if (node.childNodes == null) return this.mutator(node, options);

		const mutated = this.mutator(node, options);
		if (mutated !== node) {
			return mutated;
		}

		return this.traverseInner(node, options);
	}

	traverseInner(node, options) {
		let traversal = [];
		for (let i = 0; i < node.childNodes.length; i++) {
			traversal.push(this.traverse(node.childNodes[i], options));
		}

		let mutatedNode = { ...node };
		mutatedNode.childNodes = traversal;

		return mutatedNode;
	}
}

module.exports.NodeVisitor = NodeVisitor;