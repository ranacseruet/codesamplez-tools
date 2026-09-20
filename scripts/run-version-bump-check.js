// @ts-check

const { findMissingBumps, SKIP_LABEL } = require('./check-version-bumps');

/**
 * CI entry point: fails when changed tool runtime files ship without a version
 * bump. Usage:
 *   node scripts/run-version-bump-check.js <base-revision> [changed-file...]
 * Changed files default to `git diff --name-only <base>..HEAD`.
 */
function main() {
    const [baseRevision, ...explicitFiles] = process.argv.slice(2);

    if (!baseRevision) {
        console.error('Usage: node scripts/run-version-bump-check.js <base-revision> [changed-file...]');
        process.exit(1);
    }

    let changedFiles = explicitFiles.filter(Boolean);

    if (changedFiles.length === 0) {
        changedFiles = require('child_process')
            .execFileSync('git', ['diff', '--name-only', `${baseRevision}..HEAD`], {
                cwd: process.cwd(),
                encoding: 'utf8'
            })
            .split(/\r?\n/u)
            .map((line) => line.trim())
            .filter(Boolean);
    }

    const missingBumps = findMissingBumps(changedFiles, baseRevision);

    if (missingBumps.length === 0) {
        console.log('Version bump check passed: every changed tool has a bumped version (or no tool runtime changed).');
        return;
    }

    console.error([
        'The following tools changed without a version bump:',
        ...missingBumps.map((toolId) => `  - ${toolId}`),
        '',
        'Bump with: npm run tool:version:bump -- --tool <id> --release <patch|minor|major>',
        'Document with: npm run tool:version:note -- --tool <id> --version <x.y.z> --note "<summary>"',
        '',
        `PRs that cannot bump versions (docs-only, CI-only) may add the "${SKIP_LABEL}" label to skip this check.`
    ].join('\n'));
    process.exit(1);
}

if (require.main === module) {
    main();
}

module.exports = { main };