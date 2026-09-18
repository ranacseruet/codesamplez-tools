const fs = require('fs');
const os = require('os');
const path = require('path');

const { listAsyncChunkPaths, sumAsyncChunkRawBytes } = require('./bundle-chunk-utils');

/**
 * @param {Record<string, string>} files
 * @returns {string}
 */
function createToolDir(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-chunk-utils-'));
    Object.entries(files).forEach(([name, content]) => {
        fs.writeFileSync(path.join(dir, name), content);
    });
    return dir;
}

describe('listAsyncChunkPaths', () => {
    it('returns async/worker chunks sorted, excluding the entry bundle', () => {
        const dir = createToolDir({
            'bundle.main.js': 'entry',
            '377.bundle.main.js': 'worker',
            '118.bundle.main.js': 'runner',
            'styles.main.css': 'css',
            'index.html': '<html>'
        });

        expect(listAsyncChunkPaths(dir)).toEqual([
            path.join(dir, '118.bundle.main.js'),
            path.join(dir, '377.bundle.main.js')
        ]);
    });

    it('returns an empty array when only the entry bundle is present', () => {
        const dir = createToolDir({
            'bundle.main.js': 'entry',
            'styles.main.css': 'css'
        });

        expect(listAsyncChunkPaths(dir)).toEqual([]);
    });

    it('returns an empty array for a missing directory', () => {
        expect(listAsyncChunkPaths(path.join(os.tmpdir(), 'does-not-exist-xyz'))).toEqual([]);
    });

    it('ignores nested directories that match the chunk pattern', () => {
        const dir = createToolDir({ 'bundle.main.js': 'entry' });
        fs.mkdirSync(path.join(dir, 'nested.bundle.main.js'));

        expect(listAsyncChunkPaths(dir)).toEqual([]);
    });
});

describe('sumAsyncChunkRawBytes', () => {
    it('sums raw bytes across every async chunk, excluding the entry bundle', () => {
        const dir = createToolDir({
            'bundle.main.js': 'x'.repeat(1000),
            '118.bundle.main.js': 'a'.repeat(300),
            '377.bundle.main.js': 'b'.repeat(700)
        });

        expect(sumAsyncChunkRawBytes(dir)).toBe(1000);
    });

    it('returns 0 when there are no async chunks', () => {
        const dir = createToolDir({ 'bundle.main.js': 'entry' });

        expect(sumAsyncChunkRawBytes(dir)).toBe(0);
    });
});
