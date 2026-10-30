const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const { detectAffectedTargets } = require('./affected-tools');
const { getChangedFilesFromGit } = require('./detect-affected-tools');
const {
    FULL_DEPLOY_BASE,
    RUN_PAGE_SIZE,
    WORKFLOW_FILE,
    decideProductionDeploy,
    deployedFlagsFromJobs,
    exec,
    formatGithubNotice,
    gitIsAncestor,
    loadDeployedCommits,
    main,
    mergeDeployedCommits,
    newestUploadedDescendant,
    parseArgs,
    planOutputs,
    planProductionDeploy,
    readMainHead,
    reportCliError,
    resolveDeployBase,
    runCli,
    runNeedsJobInspection,
    writeGithubOutputs
} = require('./plan-production-deploy');

const REPO_ROOT = path.resolve(__dirname, '..');
const PARENT = 'c8a1399f926998ea696e4dfcd39cdc97f03f7b71';
const OLDER = 'a2d9bf2a29eefe7322e83b27355034b35d5ac937';
const NEWER = '3fac9d62824bf0d43c856af1c3c596707b775749';

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
        expect(deployedFlagsFromJobs(null)).toEqual({
            uploadedAssets: false,
            uploadedFunction: false
        });
        expect(deployedFlagsFromJobs([{ name: 'deploy' }])).toEqual({
            uploadedAssets: false,
            uploadedFunction: false
        });
    });

    it('treats one successful re-run as an upload of that commit', () => {
        expect(mergeDeployedCommits([
            { sha: NEWER, uploadedAssets: false, uploadedFunction: false },
            { sha: NEWER, uploadedAssets: true, uploadedFunction: true },
            { sha: NEWER, uploadedAssets: false, uploadedFunction: false }
        ])).toEqual([
            { sha: NEWER, uploadedAssets: true, uploadedFunction: true }
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

function historyIsAncestor(ancestor, descendant) {
    if (String(ancestor).startsWith('doc-') && (descendant === OLDER || descendant === NEWER)) {
        return true;
    }

    return gitIsAncestor(ancestor, descendant);
}

function assetJobs(conclusion) {
    return [{
        name: 'deploy',
        steps: [
            { name: 'Deploy affected assets', conclusion },
            { name: 'Deploy CloudFront Function', conclusion: 'skipped' }
        ]
    }];
}

function fakeHistory({ pages, jobsByRunId, mainSha }) {
    const requested = [];
    const run = (command, args) => {
        const text = `${command} ${args.join(' ')}`;
        requested.push(text);

        if (command === 'git' && args[0] === 'fetch') {
            return '';
        }

        if (command === 'git' && args[0] === 'ls-remote') {
            return `${mainSha}\trefs/heads/main`;
        }

        if (args[0] === 'api' && args[1].includes('/workflows/ci.yml/runs')) {
            const page = Number(args[1].match(/[?&]page=(\d+)/u)[1]);
            return JSON.stringify({ workflow_runs: pages[page] || [] });
        }

        if (args[0] === 'api' && args[1].includes('/jobs')) {
            const id = args[1].match(/\/runs\/(\d+)\/jobs/u)[1];
            if (jobsByRunId[id] === null) {
                return 'null';
            }

            return JSON.stringify({ jobs: jobsByRunId[id] || [{ name: 'deploy' }] });
        }

        throw new Error(`unexpected ${text}`);
    };

    return { run, requested };
}

describe('deploy history window', () => {
    const previousRepository = process.env.GITHUB_REPOSITORY;

    beforeEach(() => {
        process.env.GITHUB_REPOSITORY = 'ranacseruet/codesamplez-tools';
    });

    afterEach(() => {
        if (previousRepository === undefined) {
            delete process.env.GITHUB_REPOSITORY;
        } else {
            process.env.GITHUB_REPOSITORY = previousRepository;
        }
    });

    it('paginates past a full page of non-uploads to the asset ancestor', () => {
        // A 30-run cap would stop inside this page. The upload is on the next
        // page, after documentation pushes that never uploaded assets.
        const page = [
            { id: 1, head_sha: '', status: 'completed', event: 'push' },
            { id: 2, head_sha: NEWER, status: 'completed', event: 'push' },
            { id: 3, head_sha: PARENT, status: 'queued', event: 'push' },
            { id: 4, head_sha: OLDER, status: 'completed', event: 'pull_request' },
            { id: 5, head_sha: 'b'.repeat(40), status: 'completed', event: 'push' },
            { id: 6, head_sha: OLDER, status: 'waiting' },
            { id: 16, head_sha: 16, status: 'completed', event: 'push' }
        ];
        const jobsByRunId = { 900: assetJobs('success'), 10: null };

        while (page.length < RUN_PAGE_SIZE) {
            const id = page.length + 4;
            page.push({
                id,
                head_sha: `doc-${id}`,
                status: id === 40 ? 'in_progress' : 'completed',
                event: 'push'
            });
            if (jobsByRunId[id] === undefined && id !== 10) {
                jobsByRunId[id] = assetJobs('skipped');
            }
        }

        const history = fakeHistory({
            pages: {
                1: page,
                2: [{ id: 900, head_sha: PARENT, status: 'completed' }]
            },
            jobsByRunId,
            mainSha: NEWER
        });
        const decision = decideProductionDeploy(NEWER, OLDER, {
            exec: history.run,
            isAncestor: historyIsAncestor
        });

        expect(history.requested.some((line) => line.includes('&page=2'))).toBe(true);
        expect(history.requested.some((line) => line.includes('/runs/40/jobs'))).toBe(true);
        expect(decision.skip).toBe(false);
        expect(decision.deployBase).toBe(PARENT);
        expect(decision.republishAll).toBe(false);
        expect(decision.deployBase).not.toBe(OLDER);
    });

    it('full-deploys when history ends without an uploaded ancestor', () => {
        const history = fakeHistory({
            pages: {
                1: [{ id: 10, head_sha: 'doc-10', status: 'completed', event: 'push' }]
            },
            jobsByRunId: { 10: null },
            mainSha: NEWER
        });
        const decision = decideProductionDeploy(NEWER, OLDER, {
            exec: history.run,
            isAncestor: historyIsAncestor
        });

        expect(decision.skip).toBe(false);
        expect(decision.deployBase).toBe(FULL_DEPLOY_BASE);
        expect(decision.republishAll).toBe(true);
        expect(detectAffectedTargets(['package.json']).affectedTools).toContain('jwt-builder-tool');

        const empty = fakeHistory({ pages: { 1: [] }, jobsByRunId: {}, mainSha: NEWER });
        expect(decideProductionDeploy(NEWER, OLDER, {
            exec: empty.run,
            isAncestor: historyIsAncestor
        }).deployBase).toBe(FULL_DEPLOY_BASE);
    });

    it('full-deploys when the page cap is hit before an uploaded ancestor', () => {
        const history = fakeHistory({
            pages: {
                1: Array.from({ length: RUN_PAGE_SIZE }, (_, index) => ({
                    id: index + 1,
                    head_sha: 'b'.repeat(40),
                    status: 'completed',
                    event: 'push'
                })),
                2: [{ id: 900, head_sha: PARENT, status: 'completed', event: 'push' }]
            },
            jobsByRunId: { 900: assetJobs('success') },
            mainSha: NEWER
        });
        const decision = decideProductionDeploy(NEWER, OLDER, {
            exec: history.run,
            isAncestor: historyIsAncestor,
            maxPages: 1
        });

        expect(history.requested.some((line) => line.includes('page=2'))).toBe(false);
        expect(decision.deployBase).toBe(FULL_DEPLOY_BASE);
        expect(decision.republishAll).toBe(true);
    });

    it('keeps a normal push on its predecessor when that upload is in the history', () => {
        const history = fakeHistory({
            pages: {
                1: [{ id: 7, head_sha: OLDER, status: 'completed', event: 'push' }]
            },
            jobsByRunId: { 7: assetJobs('success') },
            mainSha: NEWER
        });
        const decision = decideProductionDeploy(NEWER, OLDER, {
            exec: history.run,
            isAncestor: historyIsAncestor
        });

        expect(decision.skip).toBe(false);
        expect(decision.deployBase).toBe(OLDER);
        expect(decision.republishAll).toBe(false);
    });

    it('still skips once a descendant upload is on an earlier page', () => {
        const history = fakeHistory({
            pages: {
                1: [{ id: 8, head_sha: NEWER, status: 'completed', event: 'push' }]
            },
            jobsByRunId: { 8: assetJobs('success') },
            mainSha: NEWER
        });
        const decision = plan({
            commitSha: OLDER,
            mainHeadSha: NEWER,
            eventBefore: PARENT,
            changedFiles: ['package.json'],
            deployedCommits: [{ sha: NEWER, uploadedAssets: true, uploadedFunction: false }],
            assetAncestorFound: false
        });

        expect(decision.skip).toBe(true);
        expect(decision.deployBase).not.toBe(FULL_DEPLOY_BASE);
        const resolved = decideProductionDeploy(OLDER, PARENT, {
            exec: history.run,
            isAncestor: historyIsAncestor
        });
        expect(resolved.skip).toBe(true);
        expect(resolved.reason).toBe('skip-newer');
        expect(resolved.newerSha).toBe(NEWER);
        expect(resolved.deployBase).not.toBe(FULL_DEPLOY_BASE);
    });
});

describe('deploy planner cli', () => {
    const previousRepository = process.env.GITHUB_REPOSITORY;
    const previousOutput = process.env.GITHUB_OUTPUT;

    afterEach(() => {
        if (previousRepository === undefined) {
            delete process.env.GITHUB_REPOSITORY;
        } else {
            process.env.GITHUB_REPOSITORY = previousRepository;
        }

        if (previousOutput === undefined) {
            delete process.env.GITHUB_OUTPUT;
        } else {
            process.env.GITHUB_OUTPUT = previousOutput;
        }
    });

    function exitSpy() {
        return jest.spyOn(process, 'exit').mockImplementation(() => {
            throw new Error('process.exit');
        });
    }

    it('requires both commits and rejects unknown flags', () => {
        expect(() => parseArgs([])).toThrow('Both --commit and --event-before are required');
        expect(() => parseArgs(['--commit'])).toThrow('Both --commit and --event-before are required');
        expect(() => parseArgs(['--commit', NEWER, '--event-before'])).toThrow('Both --commit and --event-before are required');
        expect(() => parseArgs(['--mode'])).toThrow('Unknown --mode');
        expect(() => parseArgs(['--mode', 'sideways', '--commit', NEWER, '--event-before', OLDER])).toThrow('Unknown --mode sideways');
        expect(() => parseArgs(['--nope'])).toThrow('Unknown argument --nope');
        expect(parseArgs(['--mode', 'skip', '--commit', NEWER, '--event-before', OLDER, '--write-github-output'])).toEqual({
            mode: 'skip',
            commit: NEWER,
            eventBefore: OLDER,
            writeGithubOutput: true
        });
    });

    it('prints help and exits', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const spy = exitSpy();

        try {
            expect(() => parseArgs(['--help'])).toThrow('process.exit');
            expect(() => parseArgs(['-h'])).toThrow('process.exit');
            expect(logSpy.mock.calls.map((call) => call.join(' ')).join('\n')).toContain('Usage: node scripts/plan-production-deploy.js');
        } finally {
            spy.mockRestore();
            logSpy.mockRestore();
        }
    });

    it('reads and rejects main SHAs', () => {
        expect(readMainHead(() => `${NEWER}\trefs/heads/main`)).toBe(NEWER);
        expect(() => readMainHead(() => '')).toThrow('Could not resolve the current main commit.');
        expect(() => readMainHead(() => 'not-a-sha')).toThrow('Could not resolve the current main commit.');
        expect(readMainHead()).toMatch(/^[0-9a-f]{40}$/u);
    });

    it('runs git and reports a missing command', () => {
        const { commandFailureDetail } = require('./plan-production-deploy');
        expect(exec('git', ['rev-parse', '--verify', 'HEAD'])).toMatch(/^[0-9a-f]{40}$/u);
        expect(() => exec('git', ['rev-parse', '--verify', 'not-a-real-ref-xyz'])).toThrow(/Needed a single revision/);
        expect(() => exec('definitely-missing-bin-plan-deploy', [])).toThrow(/ENOENT/);
        expect(commandFailureDetail('plain failure')).toBe('plain failure');
        expect(commandFailureDetail(null)).toBe('null');
        expect(commandFailureDetail({ stderr: '  from stderr  ' })).toBe('from stderr');
        expect(commandFailureDetail({ stderr: '   ' })).toBe('[object Object]');
        expect(commandFailureDetail(new Error('from message'))).toBe('from message');
        expect(commandFailureDetail(new Error(''))).toBe('Error');
    });

    it('uses ancestry and refuses a commit that is missing', () => {
        expect(gitIsAncestor('', NEWER)).toBe(false);
        expect(gitIsAncestor(NEWER, '')).toBe(false);
        expect(gitIsAncestor(NEWER, NEWER)).toBe(false);
        expect(gitIsAncestor(OLDER, NEWER)).toBe(true);
        expect(gitIsAncestor(NEWER, OLDER)).toBe(false);
        expect(() => plan({ commitSha: '', mainHeadSha: NEWER })).toThrow('commitSha and mainHeadSha are required');
        expect(() => plan({ mainHeadSha: '' })).toThrow('commitSha and mainHeadSha are required');
        expect(resolveDeployBase('', NEWER, PARENT, gitIsAncestor)).toBe('');
        expect(formatGithubNotice({ skip: true, notice: '' })).toBeNull();
        expect(formatGithubNotice({ skip: false, notice: 'later' })).toBeNull();
        expect(newestUploadedDescendant('base', [
            { sha: 'left', uploadedAssets: true, uploadedFunction: false },
            { sha: 'right', uploadedAssets: true, uploadedFunction: false }
        ], (ancestor, descendant) => ancestor === 'base' && (descendant === 'left' || descendant === 'right'))).toBe('left');
    });

    it('refuses to read history without a repository', () => {
        delete process.env.GITHUB_REPOSITORY;
        expect(() => loadDeployedCommits(NEWER)).toThrow(/GITHUB_REPOSITORY/);
        expect(() => decideProductionDeploy(NEWER, OLDER)).toThrow(/GITHUB_REPOSITORY/);
        process.env.GITHUB_REPOSITORY = 'ranacseruet/codesamplez-tools';
        expect(() => loadDeployedCommits(NEWER, {
            exec: () => '{"total_count":1}'
        })).toThrow('Deploy history response was not a list.');
    });

    it('writes the plan to GITHUB_OUTPUT and prints a skip notice', () => {
        const outputFile = path.join(os.tmpdir(), `plan-deploy-${process.pid}.txt`);
        fs.writeFileSync(outputFile, '');
        process.env.GITHUB_OUTPUT = outputFile;
        process.env.GITHUB_REPOSITORY = 'ranacseruet/codesamplez-tools';
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const history = fakeHistory({
            pages: {
                1: [{ id: 8, head_sha: NEWER, status: 'completed', event: 'push' }]
            },
            jobsByRunId: { 8: assetJobs('success') },
            mainSha: NEWER
        });

        try {
            const plan = runCli([
                '--mode', 'skip',
                '--commit', OLDER,
                '--event-before', PARENT,
                '--write-github-output'
            ], {
                exec: history.run,
                isAncestor: historyIsAncestor
            });
            const written = fs.readFileSync(outputFile, 'utf8');

            expect(plan.skip).toBe(true);
            expect(written).toContain('skip=true');
            expect(written).toContain(`newer_sha=${NEWER}`);
            expect(logSpy.mock.calls.map((call) => call.join(' ')).join('\n')).toContain('::notice::Skipping stale deploy');
            expect(planOutputs({
                skip: false,
                reason: 'deploy',
                deployBase: OLDER,
                republishAll: false,
                newerSha: null
            })).toEqual({
                skip: 'false',
                reason: 'deploy',
                deploy_base: OLDER,
                republish_all: 'false',
                newer_sha: ''
            });
        } finally {
            logSpy.mockRestore();
            fs.rmSync(outputFile, { force: true });
        }
    });

    it('does not print a notice when the commit deploys', () => {
        process.env.GITHUB_REPOSITORY = 'ranacseruet/codesamplez-tools';
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const history = fakeHistory({
            pages: {
                1: [{ id: 7, head_sha: OLDER, status: 'completed', event: 'push' }]
            },
            jobsByRunId: { 7: assetJobs('success') },
            mainSha: NEWER
        });

        try {
            const scopePlan = runCli([
                '--mode', 'scope',
                '--commit', NEWER,
                '--event-before', OLDER
            ], {
                exec: history.run,
                isAncestor: historyIsAncestor
            });
            const plan = runCli([
                '--mode', 'skip',
                '--commit', NEWER,
                '--event-before', OLDER
            ], {
                exec: history.run,
                isAncestor: historyIsAncestor
            });
            const logged = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');

            expect(scopePlan.skip).toBe(false);
            expect(plan.skip).toBe(false);
            expect(logged).toContain('reason=deploy');
            expect(logged).not.toContain('::notice::');
        } finally {
            logSpy.mockRestore();
        }
    });

    it('requires GITHUB_OUTPUT before writing a plan', () => {
        delete process.env.GITHUB_OUTPUT;
        expect(() => writeGithubOutputs({ skip: 'false' })).toThrow('GITHUB_OUTPUT is not set');
    });

    it('reports cli failures without deploying', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const spy = exitSpy();

        try {
            expect(() => reportCliError(new Error('broken plan'))).toThrow('process.exit');
            expect(errorSpy).toHaveBeenCalledWith('broken plan');
            expect(() => reportCliError('plain failure')).toThrow('process.exit');
            expect(errorSpy).toHaveBeenCalledWith('plain failure');
            expect(() => main()).toThrow('process.exit');
        } finally {
            spy.mockRestore();
            errorSpy.mockRestore();
        }
    });
});
