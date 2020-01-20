export interface PseudoHTMLNode {
	nodeName: string,
	nodeAttributes: PseudoHTMLNodeAttribute[],
	childNodes: PseudoHTMLNode[],
	nodeValue: string?,
}

export interface PseudoHTMLNodeAttribute {
	name: string,
	value: string,
}

export function parse(input: string): PseudoHTMLNode;
export function stringify(input: PseudoHTMLNode): string;
export function querySelector(node: PseudoHTMLNode, selector: string): PseudoHTMLNode;