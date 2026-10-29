// @ts-check

const {
    findMissingBumps,
    isDependabotManifestOnlyChange,
    isDependabotWorkflowOnlyChange,
    SKIP_LABEL
} = require('./check-version-bumps');
const { getChangedFilesFromGit } = require('./detect-affected-tools');

/**
 * CI entry point: fails when changed tool runtime files ship without a version
 * bump. Usage:
 *   node scripts/run-version-bump-check.js <base-revision> [changed-file...]
 * Changed files default to the hardened base..HEAD diff used by
 * detect-affected-tools.js (all-zero / non-ancestor bases fall back to the
 * full tracked-file list instead of throwing or under-diffing).
 */
function main() {
    const [baseRevision, ...explicitFiles] = process.argv.slice(2);

    if (!baseRevision) {
        console.error('Usage: node scripts/run-version-bump-check.js <base-revision> [changed-file...]');
        process.exit(1);
    }

    const changedFiles = explicitFiles.filter(Boolean).length > 0
        ? explicitFiles.filter(Boolean)
        : getChangedFilesFromGit(baseRevision, 'HEAD');
    const pullRequestAuthor = process.env.PR_AUTHOR || '';

    if (isDependabotManifestOnlyChange(changedFiles, pullRequestAuthor)) {
        console.log('Dependabot manifest-only change (package.json / package-lock.json); skipping version bump enforcement.');
        return;
    }

    if (isDependabotWorkflowOnlyChange(changedFiles, pullRequestAuthor)) {
        console.log('Dependabot workflow-only change (.github/workflows); skipping version bump enforcement.');
        return;
    }

    const missingBumps = findMissingBumps(changedFiles, baseRevision, { pullRequestAuthor });

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
        `PRs that cannot bump versions (docs-only, CI-only) may add the "${SKIP_LABEL}" label to skip this check.`,
        'Dependabot updates that change only package.json and package-lock.json, or only workflow files under .github/workflows/, are skipped automatically.'
    ].join('\n'));
    process.exit(1);
}

if (require.main === module) {
    main();
}

module.exports = { main };