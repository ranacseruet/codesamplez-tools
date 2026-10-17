/** @jest-environment node */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const SKIP_DIRECTORIES = new Set(['.git', 'build', 'coverage', 'node_modules']);
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.json', '.md', '.mjs', '.ts', '.tsx', '.txt']);

// Acceptance criteria for issue #96. Pieces are joined so this file does not
// itself contain the contiguous claims it forbids.
const FORBIDDEN_CLAIMS = [
    ['No ', 'cookies'].join(''),
    ['no ', 'tracking'].join(''),
    ['Zero Data ', 'Collection'].join(''),
    ['no user data is ', 'sent'].join(''),
    ['complete ', 'privacy'].join('')
].map((claim) => claim.toLowerCase());

/**
 * @param {string} directory
 * @param {string[]} hits
 * @returns {void}
 */
function scanDirectory(directory, hits) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
        if (SKIP_DIRECTORIES.has(entry.name)) {
            return;
        }

        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            scanDirectory(fullPath, hits);
            return;
        }

        if (!entry.isFile() || !TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
            return;
        }

        const source = fs.readFileSync(fullPath, 'utf8').toLowerCase();
        FORBIDDEN_CLAIMS.forEach((claim) => {
            if (source.includes(claim)) {
                hits.push(`${path.relative(REPO_ROOT, fullPath)} contains "${claim}"`);
            }
        });
    });
}

describe('site privacy claims', () => {
    it('does not claim the site is free of cookies, tracking, or data collection', () => {
        const hits = [];
        scanDirectory(REPO_ROOT, hits);
        expect(hits).toEqual([]);
    });
});
