const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');
const { detectAffectedTargets } = require('./affected-tools');
const { getChangedFilesFromGit } = require('./detect-affected-tools');
const {
    WORKFLOW_FILE,
    deployedFlagsFromJobs,
    formatGithubNotice,
    mergeDeployedCommits,
    planProductionDeploy,
    resolveDeployBase,
    runNeedsJobInspection
} = require('./plan-production-deploy');

const REPO_ROOT = path.resolve(__dirname, '..');
const PARENT = 'c8a1399f926998ea696e4dfcd39cdc97f03f7b71';
const OLDER = 'a2d9bf2a29eefe7322e83b27355034b35d5ac937';
const NEWER = '3fac9d62824bf0d43c856af1c3c596707b775749';

function gitIsAncestor(ancestor, descendant) {
    const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
        cwd: REPO_ROOT,
        stdio: 'ignore'
    });

    return result.status === 0;
}

function plan(overrides) {
    return planProductionDeploy({
        commitSha: NEWER,
        mainHeadSha: NEWER,
        eventBefore: OLDER,
        changedFiles: [],
        isAncestor: gitIsAncestor,
        deployedCommits: [],
        ...overrides
    });
}

describe('production deploy ordering', () => {
    it('inspects runs that may already have uploaded and ignores ones still queued', () => {
        expect(runNeedsJobInspection('completed')).toBe(true);
        expect(runNeedsJobInspection('in_progress')).toBe(true);
        expect(runNeedsJobInspection('queued')).toBe(false);
        expect(runNeedsJobInspection('pending')).toBe(false);
        expect(runNeedsJobInspection('waiting')).toBe(false);
    });

    it('counts an upload only when that deploy step succeeded', () => {
        expect(deployedFlagsFromJobs([
            {
                name: 'test-and-build',
                steps: [{ name: 'Build', conclusion: 'success' }]
            },
            {
                name: 'deploy',
                steps: [
                    { name: 'Deploy CloudFront Function', conclusion: 'skipped' },
                    { name: 'Deploy affected assets', conclusion: 'success' }
                ]
            }
        ])).toEqual({ uploadedAssets: true, uploadedFunction: false });

        expect(deployedFlagsFromJobs([
            {
                name: 'deploy',
                steps: [
                    { name: 'Deploy CloudFront Function', conclusion: 'success' },
                    { name: 'Deploy affected assets', conclusion: 'skipped' }
                ]
            }
        ])).toEqual({ uploadedAssets: false, uploadedFunction: true });

        expect(deployedFlagsFromJobs([])).toEqual({
            uploadedAssets: false,
            uploadedFunction: false
        });
    });

    it('treats one successful re-run as an upload of that commit', () => {
        expect(mergeDeployedCommits([
            { sha: NEWER, uploadedAssets: false, uploadedFunction: false },
            { sha: NEWER, uploadedAssets: true, uploadedFunction: false }
        ])).toEqual([
            { sha: NEWER, uploadedAssets: true, uploadedFunction: false }
        ]);
    });

    it('leaves a normal single push on its own predecessor', () => {
        const changedFiles = getChangedFilesFromGit(OLDER, NEWER);
        const decision = plan({
            changedFiles,
            deployedCommits: [{ sha: OLDER, uploadedAssets: true, uploadedFunction: false }]
        });

        expect(decision.skip).toBe(false);
        expect(decision.reason).toBe('deploy');
        expect(decision.deployBase).toBe(OLDER);
        expect(decision.republishAll).toBe(false);
        expect(formatGithubNotice(decision)).toBeNull();

        const targets = detectAffectedTargets(changedFiles);
        expect(targets.scope).toBe('selected-tools');
        expect(targets.shouldDeploy).toBe(true);
        expect(targets.invalidationPaths).toContain('/jwt-builder/*');
        expect(changedFiles).not.toContain('package.json');
    });

    it('dry-runs the Oct 29 race: the newer build includes the older commit, then the older upload is skipped', () => {
        // Run 40879968931 (#144, 3fac9d6) uploaded at 13:14:41Z and finished at
        // 13:15:05Z. Run 40879927352 (#147, a2d9bf2) acquired deploy-main after
        // that and uploaded an all-tools build at 13:15:14Z. Diffing the newer
        // push only against its parent misses package.json, so the babel bump's
        // rebuild would be dropped if that older upload is skipped. Widening
        // the base to the last asset upload (c8a1399) puts both pushes in the
        // build that is allowed to finish.
        const widenedFiles = getChangedFilesFromGit(PARENT, NEWER);
        const narrowFiles = getChangedFilesFromGit(OLDER, NEWER);

        expect(narrowFiles).toContain('jwt-builder/tool.meta.json');
        expect(narrowFiles).not.toContain('package.json');
        expect(widenedFiles).toEqual(expect.arrayContaining([
            'package.json',
            'package-lock.json',
            'jwt-builder/tool.meta.json'
        ]));

        const newerFirst = plan({
            changedFiles: widenedFiles,
            deployedCommits: [{ sha: PARENT, uploadedAssets: true, uploadedFunction: false }]
        });

        expect(newerFirst.skip).toBe(false);
        expect(newerFirst.deployBase).toBe(PARENT);
        const landed = detectAffectedTargets(widenedFiles);
        expect(landed.scope).toBe('all-tools');
        expect(landed.affectedTools).toContain('jwt-builder-tool');
        expect(landed.invalidationPaths).toContain('/jwt-builder/*');

        const olderAfter = plan({
            commitSha: OLDER,
            mainHeadSha: NEWER,
            eventBefore: PARENT,
            changedFiles: getChangedFilesFromGit(PARENT, OLDER),
            deployedCommits: [
                { sha: PARENT, uploadedAssets: true, uploadedFunction: false },
                { sha: NEWER, uploadedAssets: true, uploadedFunction: false }
            ]
        });

        expect(olderAfter.skip).toBe(true);
        expect(olderAfter.reason).toBe('skip-newer');
        expect(olderAfter.newerSha).toBe(NEWER);
        expect(formatGithubNotice(olderAfter)).toBe(
            `::notice::Skipping stale deploy of ${OLDER}; newer commit ${NEWER} already deployed. Current main is ${NEWER}.`
        );
    });

    it('still deploys the older commit when it wins the lock before the newer upload', () => {
        const decision = plan({
            commitSha: OLDER,
            mainHeadSha: NEWER,
            eventBefore: PARENT,
            changedFiles: ['package.json', 'package-lock.json'],
            deployedCommits: [{ sha: PARENT, uploadedAssets: true, uploadedFunction: false }]
        });

        expect(decision.skip).toBe(false);
        expect(decision.deployBase).toBe(PARENT);
        expect(decision.notice).toBe('');
    });

    it('does not treat a failed or empty newer deploy as an upload', () => {
        const decision = plan({
            commitSha: OLDER,
            mainHeadSha: NEWER,
            eventBefore: PARENT,
            changedFiles: ['package.json'],
            deployedCommits: [{ sha: NEWER, uploadedAssets: false, uploadedFunction: false }]
        });

        expect(decision.skip).toBe(false);
    });

    it('skips when a newer commit published the CloudFront function', () => {
        const decision = plan({
            commitSha: OLDER,
            mainHeadSha: NEWER,
            eventBefore: PARENT,
            deployedCommits: [{ sha: NEWER, uploadedAssets: false, uploadedFunction: true }]
        });

        expect(decision.skip).toBe(true);
        expect(decision.newerSha).toBe(NEWER);
    });

    it('names the newest descendant when more than one upload has finished', () => {
        const decision = plan({
            commitSha: PARENT,
            mainHeadSha: NEWER,
            eventBefore: 'c0ffee',
            deployedCommits: [
                { sha: OLDER, uploadedAssets: true, uploadedFunction: false },
                { sha: NEWER, uploadedAssets: true, uploadedFunction: false }
            ]
        });

        expect(decision.skip).toBe(true);
        expect(decision.newerSha).toBe(NEWER);
    });

    it('skips a commit that is no longer on main', () => {
        const removed = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        const decision = plan({
            commitSha: removed,
            mainHeadSha: NEWER,
            eventBefore: PARENT,
            isAncestor: () => false
        });

        expect(decision.skip).toBe(true);
        expect(decision.reason).toBe('skip-not-on-main');
        expect(formatGithubNotice(decision)).toBe(
            `::notice::Skipping deploy of ${removed}; it is not on current main ${NEWER}.`
        );
    });

    it('keeps an unusable before SHA so detection can full-rebuild', () => {
        const zeros = '0'.repeat(40);
        expect(resolveDeployBase(zeros, NEWER, PARENT, gitIsAncestor)).toBe(zeros);
        expect(resolveDeployBase('not-an-ancestor', NEWER, PARENT, () => false)).toBe('not-an-ancestor');
        expect(resolveDeployBase(OLDER, NEWER, NEWER, gitIsAncestor)).toBe(OLDER);
    });

    it('republishes every tool, including jwt-builder, when the deploy workflow changes', () => {
        const decision = plan({
            eventBefore: NEWER,
            commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            mainHeadSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            changedFiles: [WORKFLOW_FILE, 'scripts/plan-production-deploy.js'],
            isAncestor: () => false,
            deployedCommits: [{ sha: NEWER, uploadedAssets: true, uploadedFunction: false }]
        });

        expect(decision.skip).toBe(false);
        expect(decision.republishAll).toBe(true);
        expect(decision.deployBase).toBe(NEWER);

        // The workflow passes package.json, the canonical all-tools trigger,
        // so the merge build is HEAD's pages. The version-bump gate reads the
        // git diff, not this argument.
        const targets = detectAffectedTargets(['package.json']);
        expect(targets.scope).toBe('all-tools');
        expect(targets.affectedTools).toContain('jwt-builder-tool');
        expect(targets.shouldDeploy).toBe(true);
        expect(targets.invalidationPaths).toContain('/jwt-builder/*');
    });
});

describe('deploy workflow contract', () => {
    const workflow = yaml.load(fs.readFileSync(path.join(REPO_ROOT, '.github', 'workflows', 'ci.yml'), 'utf8'));
    const build = workflow.jobs['test-and-build'];
    const deploy = workflow.jobs.deploy;
    const findStep = (job, name) => job.steps.find((step) => step.name === name);

    it('keeps upload serialization and orders the upload that is allowed to finish', () => {
        expect(workflow.permissions.actions).toBe('read');
        expect(deploy.concurrency).toEqual({
            group: 'deploy-main',
            'cancel-in-progress': false
        });
        expect(build.outputs).toEqual({
            deploy_base: '${{ steps.plan.outputs.deploy_base }}',
            republish_all: '${{ steps.plan.outputs.republish_all }}'
        });

        const planStep = findStep(build, 'Plan production deploy scope');
        expect(planStep.env.GH_TOKEN).toBe('${{ github.token }}');
        expect(planStep.run).toContain('node scripts/plan-production-deploy.js');
        expect(planStep.run).toContain('--mode scope');
        expect(planStep.run).toContain('--write-github-output');
        expect(planStep.run).toContain('refs/heads/main');

        const buildDetect = findStep(build, 'Detect affected runtime targets');
        expect(buildDetect.run).toContain('github.event.pull_request.base.sha');
        expect(buildDetect.run).toContain('steps.plan.outputs.deploy_base');
        expect(buildDetect.run).toContain('steps.plan.outputs.republish_all');
        expect(buildDetect.run).toContain('--changed-file package.json');

        const skipStep = findStep(deploy, 'Decide whether this commit may deploy');
        expect(skipStep.env.GH_TOKEN).toBe('${{ github.token }}');
        expect(skipStep.run).toContain('--mode skip');
        expect(skipStep.run).toContain('node scripts/plan-production-deploy.js');

        const deployDetect = findStep(deploy, 'Detect affected deploy targets');
        expect(deployDetect.run).toContain('needs.test-and-build.outputs.deploy_base');
        expect(deployDetect.run).toContain('needs.test-and-build.outputs.republish_all');
        expect(deployDetect.run).toContain('--changed-file package.json');
        expect(deployDetect.run).not.toContain('github.event.before');

        const functionDetect = findStep(deploy, 'Detect CloudFront Function changes');
        expect(functionDetect.run).toContain('needs.test-and-build.outputs.deploy_base');
        expect(functionDetect.run).toContain('git diff --name-only "$BASE" "$HEAD"');
        expect(functionDetect.run).not.toContain('github.event.before');
    });

    it('leaves CloudFront invalidation on the existing deploy script for the upload that runs', () => {
        const assets = findStep(deploy, 'Deploy affected assets');
        const restore = findStep(deploy, 'Restore build artifacts');
        const credentials = findStep(deploy, 'Configure AWS credentials');
        const cloudfront = findStep(deploy, 'Deploy CloudFront Function');
        const gate = "steps.deploy_order.outputs.skip != 'true'";

        expect(assets.if).toBe(`${gate} && steps.affected.outputs.should_deploy == 'true'`);
        expect(restore.if).toBe(assets.if);
        expect(cloudfront.if).toBe(`${gate} && steps.cloudfront_function.outputs.should_deploy == 'true'`);
        expect(credentials.if).toBe(`${gate} && (steps.affected.outputs.should_deploy == 'true' || steps.cloudfront_function.outputs.should_deploy == 'true')`);

        expect(assets.run).toContain('DEPLOY_ARGS=(--bucket tools.codesamplez.com --distribution-id "${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}")');
        expect(assets.run).toContain('DEPLOY_ARGS+=(--tools "${{ steps.affected.outputs.affected_tools }}")');
        expect(assets.run).toContain('DEPLOY_ARGS+=(--include-root-shell)');
        expect(assets.run).toContain('DEPLOY_ARGS+=(--include-root-assets)');
        expect(assets.run).toContain('npm run deploy:affected -- "${DEPLOY_ARGS[@]}"');
        expect(assets.run).not.toContain('create-invalidation');
        expect(cloudfront.run.trim()).toBe('node scripts/deploy-cloudfront-function.js --distribution-id "${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}"');

        const deployScript = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'deploy-affected-assets.js'), 'utf8');
        expect(deployScript).toContain("'create-invalidation'");
        expect(deployScript).toContain("'--paths'");
    });
});
