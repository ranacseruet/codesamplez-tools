// @ts-check

const fs = require('fs');
const path = require('path');

const MAIN_BUNDLE_FILENAME = 'bundle.main.js';
// Webpack names code-split + worker chunks `<id>.bundle.main.js` (e.g.
// text-analyzer's lazy worker-runner + the worker itself), emitted alongside
// the entry `bundle.main.js` in the tool's build dir.
const ASYNC_CHUNK_PATTERN = /\.bundle\.main\.js$/;

/**
 * Lists async/worker JS chunks emitted alongside the main bundle in a tool's
 * build directory. Returns absolute paths, sorted by filename. The entry
 * `bundle.main.js` is excluded.
 * @param {string} toolDir
 * @returns {string[]}
 */
function listAsyncChunkPaths(toolDir) {
    if (!fs.existsSync(toolDir)) {
        return [];
    }

    return fs.readdirSync(toolDir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => name !== MAIN_BUNDLE_FILENAME && ASYNC_CHUNK_PATTERN.test(name))
        .sort()
        .map((name) => path.join(toolDir, name));
}

/**
 * Sums the raw bytes of every async/worker chunk in a tool's build directory.
 * @param {string} toolDir
 * @returns {number}
 */
function sumAsyncChunkRawBytes(toolDir) {
    return listAsyncChunkPaths(toolDir).reduce((total, chunkPath) => {
        return total + fs.statSync(chunkPath).size;
    }, 0);
}

module.exports = {
    MAIN_BUNDLE_FILENAME,
    ASYNC_CHUNK_PATTERN,
    listAsyncChunkPaths,
    sumAsyncChunkRawBytes
};
