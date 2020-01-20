const fs = require('fs');
const chalk = require('chalk');

// https://stackoverflow.com/a/36949791
const TextEncoderClass = require('text-encoding').TextEncoder;
const encoder = new TextEncoderClass("utf-8");

module.exports.parseDirectory = parseDirectory;
module.exports.parseFiles = parseFiles;
module.exports.pairFiles = pairFiles;
module.exports.collect = collect;
module.exports.recursivelyGetFilesIterable = recursivelyGetFilesIterable;
module.exports.build = build;

function removeDir(path, options) {
	return fs.promises.rmdir(path, { recursive: true });
}

async function build(directory, files) {
	const buildDir = directory + '/build';

	await removeDir(buildDir);
	await fs.promises.mkdir(buildDir);

	for (const {file, name} of files) {
		const handle = await fs.promises.open(directory + '/build/' + name, "w");
		await handle.write(encoder.encode(file));
	}
}

/**
 * @template T1
 * @template T2
 * @param {string} directory 
 * @param {{html: (data: string) => T1, css: (data: string) => T2}} options 
 * @returns {Promise<{name: string, path: string, html: T1, css: T2}[]>}
 */
function parseDirectory(directory, options) {
	return collect(parseFiles(pairFiles(recursivelyGetFilesIterable(directory)), options));
}

/**
 * @template T1
 * @template T2
 * @param {AsyncIterable<{name: string, path: string, html: string, css: string}>} files 
 * @param {{html: (data: string) => T1, css: (data: string) => T2}} options 
 * @returns {AsyncIterable<{name: string, path: string, html: T1, css: T2}>}
 */
async function *parseFiles(files, options) {
	for await (const entry of files) {
		yield {
			name: entry.name,
			path: entry.path,
			html: options.html(entry.html || ''),
			css: options.css(entry.css || '')
		};
	}
}

/**
 * @param {AsyncIterable<{path: string, entry: fs.Dirent}>} files 
 * @returns {AsyncIterable<{name: string, path: string, html: string, css: string}>}
 */
async function *pairFiles(files) {
	let maps = {};

	for await (const {path, entry} of files) {
		const fullPath = path + '/' + entry.name;
		const dotSplit = entry.name.split('.')
		const extension = dotSplit.slice(1).reduce((a, b) => `${a}.${b}`);
		const baseName = dotSplit[0];
		const key = path + '/' + baseName;

		// gives maps[key] a new object if none exists
		let object = maps[key] = (maps[key] || { name: baseName });

		object[extension] = fullPath;
	}

	// now that we have them all mapped, time to turn them into the right return type

	let results = [];

	// TODO: more concurrent or something, dunno if it even matters
	for (const entry in maps) {
		const object = maps[entry];
		let objectRead = {};

		for (const key in object) {
			if (key === 'name') {
				objectRead[key] = object[key];
				continue;
			}

			objectRead[key] = (await fs.promises.readFile(object[key])).toString();
		}

		// @ts-ignore
		yield {
			path: entry,
			...objectRead
		};
	}

	return results;
}

/**
 * @template T
 * @param {AsyncIterable<T>} asyncIterable 
 * @returns {Promise<T[]>}
 */
async function collect(asyncIterable) {
	let results = [];

	for await (const entry of asyncIterable) {
		results.push(entry);
	}

	return results;
}

/**
 * @param {string} directory
 * @returns {AsyncIterable<{entry: fs.Dirent, path: string}>}
 * */
async function *recursivelyGetFilesIterable(directory) {
	const entries = await fs.promises.opendir(directory);
	let otherFiles = [];

	for await (const entry of entries) {
		if (entry.isDirectory()) {
			
			otherFiles.push(recursivelyGetFilesIterable(directory + '/' + entry.name));
			continue;
		}

		if (!entry.isFile()) {
			console.log(chalk.red('found non-file, non-directory: ' + entry.name));
			continue;
		}

		yield {entry: entry, path: directory};
	}

	for (const filesPromise of otherFiles) {
		for await (const entry of filesPromise) {
			yield entry;
		}
	}
}