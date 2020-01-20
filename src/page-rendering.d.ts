import { PsudeoHTMLNode, PseudoHTMLNode } from './pseudo-html-parser';

export interface ComponentCss {
	readonly raw: string;
	readonly css: any;
}

export interface Component {
	readonly name: string;
	readonly path: string;

	readonly document: PseudoHTMLNode;
	readonly html: PseudoHTMLNode;
	readonly css: ComponentCss;
}

export declare class ComponentStore {
	constructor(components: Component[]): ComponentStore;
	readonly components: Component[];

	findComponents(name: string): Component | undefined;
	findComponent(name: string): Component;
}

export interface PageRender {
	readonly render: string;

	readonly page: Component;
	readonly componentsUsed: Component[];
}

export interface RenderResult {
	readonly pages: PageRender[];
	readonly componentsUsedOnEveryPage: Component[];
}

export function render(pages: Component[], componentStore: ComponentStore): RenderResult;