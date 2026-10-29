// @ts-check

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const { getChangedFilesFromGit } = require('./detect-affected-tools');

const WORKFLOW_FILE = '.github/workflows/ci.yml';
const RUN_WINDOW = 30;

/**
 * @typedef {{
 *   sha: string,
 *   uploadedAssets: boolean,
 *   uploadedFunction: boolean
 * }} DeployedCommit
 */

/**
 * @typedef {{
 *   commitSha: string,
 *   mainHeadSha: string,
 *   eventBefore: string,
 *   changedFiles: string[],
 *   isAncestor: (ancestor: string, descendant: string) => boolean,
 *   deployedCommits: DeployedCommit[]
 * }} PlanInput
 */

/**
 * @typedef {{
 *   skip: boolean,
 *   reason: 'deploy' | 'skip-newer' | 'skip-not-on-main',
 *   deployBase: string,
 *   republishAll: boolean,
 *   notice: string,
 *   newerSha: string | null
 * }} DeployPlan
 */

/**
 * Inspect a run when its deploy job may already have uploaded. Queued runs have
 * not entered the deploy job. In-progress runs are included because the upload
 * step can succeed before the job's post-steps finish.
 * @param {string | null | undefined} status
 * @returns {boolean}
 */
function runNeedsJobInspection(status) {
    return status === 'completed' || status === 'in_progress';
}

/**
 * @param {Array<{ name?: string, steps?: Array<{ name?: string, conclusion?: string | null }> }> | null | undefined} jobs
 * @returns {{ uploadedAssets: boolean, uploadedFunction: boolean }}
 */
function deployedFlagsFromJobs(jobs) {
    const deploy = (jobs || []).find((job) => job.name === 'deploy');
    const steps = deploy && deploy.steps ? deploy.steps : [];
    const conclusion = (name) => {
        const step = steps.find((candidate) => candidate.name === name);
        return step ? step.conclusion : null;
    };

    return {
        uploadedAssets: conclusion('Deploy affected assets') === 'success',
        uploadedFunction: conclusion('Deploy CloudFront Function') === 'success'
    };
}

/**
 * Re-runs share a SHA. One successful upload is enough to count.
 * @param {DeployedCommit[]} entries
 * @returns {DeployedCommit[]}
 */
function mergeDeployedCommits(entries) {
    /** @type {Map<string, DeployedCommit>} */
    const bySha = new Map();

    entries.forEach((entry) => {
        const existing = bySha.get(entry.sha) || {
            sha: entry.sha,
            uploadedAssets: false,
            uploadedFunction: false
        };
        existing.uploadedAssets = existing.uploadedAssets || entry.uploadedAssets;
        existing.uploadedFunction = existing.uploadedFunction || entry.uploadedFunction;
        bySha.set(entry.sha, existing);
    });

    return Array.from(bySha.values());
}

/**
 * @param {DeployedCommit[]} commits
 * @param {(ancestor: string, descendant: string) => boolean} isAncestor
 * @param {(entry: DeployedCommit) => boolean} include
 * @returns {DeployedCommit | null}
 */
function newestMatching(commits, isAncestor, include) {
    const matches = commits.filter(include);
    if (matches.length === 0) {
        return null;
    }

    const newest = matches.find((entry) => matches.every((other) =>
        other.sha === entry.sha || isAncestor(other.sha, entry.sha)
    ));

    return newest || matches[0];
}

/**
 * @param {string} commitSha
 * @param {DeployedCommit[]} deployedCommits
 * @param {(ancestor: string, descendant: string) => boolean} isAncestor
 * @returns {string | null}
 */
function newestUploadedDescendant(commitSha, deployedCommits, isAncestor) {
    const match = newestMatching(deployedCommits, isAncestor, (entry) =>
        entry.sha !== commitSha
        && isAncestor(commitSha, entry.sha)
        && (entry.uploadedAssets || entry.uploadedFunction)
    );

    return match ? match.sha : null;
}

/**
 * @param {string} commitSha
 * @param {DeployedCommit[]} deployedCommits
 * @param {(ancestor: string, descendant: string) => boolean} isAncestor
 * @returns {string | null}
 */
function newestAssetAncestor(commitSha, deployedCommits, isAncestor) {
    const match = newestMatching(deployedCommits, isAncestor, (entry) =>
        entry.sha !== commitSha
        && entry.uploadedAssets
        && isAncestor(entry.sha, commitSha)
    );

    return match ? match.sha : null;
}

/**
 * Keep `github.event.before` unless the last asset upload is strictly behind
 * it. That gap is an ancestor whose upload has not happened yet; the deploy
 * that does run has to build those files or they never reach the bucket.
 * A missing, all-zero, or non-ancestor `before` stays put so the existing
 * full-rebuild fallback in detect-affected-tools.js still applies.
 * @param {string} eventBefore
 * @param {string} commitSha
 * @param {string | null} lastAssetSha
 * @param {(ancestor: string, descendant: string) => boolean} isAncestor
 * @returns {string}
 */
function resolveDeployBase(eventBefore, commitSha, lastAssetSha, isAncestor) {
    if (!eventBefore || /^0+$/u.test(eventBefore)) {
        return eventBefore;
    }

    if (!isAncestor(eventBefore, commitSha)) {
        return eventBefore;
    }

    if (!lastAssetSha || lastAssetSha === eventBefore) {
        return eventBefore;
    }

    if (isAncestor(lastAssetSha, eventBefore)) {
        return lastAssetSha;
    }

    return eventBefore;
}

/**
 * Decide whether this main commit may upload, and which diff base the build
 * and the deploy job must share.
 *
 * Serialization (`deploy-main`, cancel-in-progress false) only stops two
 * uploads from running at once. The lock is taken when the deploy job starts,
 * which is when test-and-build finishes — not when the commit was pushed. On
 * 2026-10-29, #144 (3fac9d6, run 40879968931) finished its deploy at 13:15:05Z
 * and #147 (a2d9bf2, run 40879927352) then uploaded an all-tools build at
 * 13:15:14Z, overwriting jwt-builder. publish-baseline on the older run
 * skipped; deploy had no equivalent.
 *
 * Skipping every non-HEAD commit would drop the older push's unique files,
 * because affected deploys are partial. This plan uploads when no descendant
 * has uploaded yet (the older job won the lock first) and skips when one has
 * (uploading now would overwrite it). The descendant's build diffs back to
 * the last asset upload so those unique files are in the build that lands.
 * @param {PlanInput} input
 * @returns {DeployPlan}
 */
function planProductionDeploy(input) {
    if (!input.commitSha || !input.mainHeadSha) {
        throw new Error('commitSha and mainHeadSha are required');
    }

    const onMain = input.commitSha === input.mainHeadSha
        || input.isAncestor(input.commitSha, input.mainHeadSha);

    if (!onMain) {
        return {
            skip: true,
            reason: 'skip-not-on-main',
            deployBase: input.eventBefore,
            republishAll: false,
            notice: `Skipping deploy of ${input.commitSha}; it is not on current main ${input.mainHeadSha}.`,
            newerSha: null
        };
    }

    const newerSha = newestUploadedDescendant(input.commitSha, input.deployedCommits, input.isAncestor);
    if (newerSha) {
        return {
            skip: true,
            reason: 'skip-newer',
            deployBase: input.eventBefore,
            republishAll: false,
            notice: `Skipping stale deploy of ${input.commitSha}; newer commit ${newerSha} already deployed. Current main is ${input.mainHeadSha}.`,
            newerSha
        };
    }

    const deployBase = resolveDeployBase(
        input.eventBefore,
        input.commitSha,
        newestAssetAncestor(input.commitSha, input.deployedCommits, input.isAncestor),
        input.isAncestor
    );

    return {
        skip: false,
        reason: 'deploy',
        deployBase,
        republishAll: input.changedFiles.includes(WORKFLOW_FILE),
        notice: '',
        newerSha: null
    };
}

/**
 * @param {DeployPlan} plan
 * @returns {string | null}
 */
function formatGithubNotice(plan) {
    if (!plan.skip || !plan.notice) {
        return null;
    }

    return `::notice::${plan.notice}`;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {string}
 */
function exec(command, args) {
    try {
        return execFileSync(command, args, {
            cwd: process.cwd(),
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        }).trim();
    } catch (error) {
        const stderr = /** @type {{ stderr?: Buffer | string }} */ (error).stderr;
        const detail = stderr ? stderr.toString().trim() : (error instanceof Error ? error.message : String(error));
        throw new Error(`${command} ${args.join(' ')} failed: ${detail}`, { cause: error });
    }
}

/**
 * A commit is not an ancestor of itself. Descendants of the checked-out SHA
 * are only present after fetching main.
 * @param {string} ancestor
 * @param {string} descendant
 * @returns {boolean}
 */
function gitIsAncestor(ancestor, descendant) {
    if (!ancestor || !descendant || ancestor === descendant) {
        return false;
    }

    const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
        cwd: process.cwd(),
        stdio: 'ignore'
    });

    return result.status === 0;
}

/**
 * @returns {string}
 */
function readMainHead() {
    const output = exec('git', ['ls-remote', 'origin', 'refs/heads/main']);
    const sha = output.split(/\s+/u)[0] || '';
    if (!/^[0-9a-f]{40}$/iu.test(sha)) {
        throw new Error('Could not resolve the current main commit.');
    }

    return sha;
}

/**
 * @param {string} commitSha
 * @returns {DeployedCommit[]}
 */
function loadDeployedCommits(commitSha) {
    const repository = process.env.GITHUB_REPOSITORY;
    if (!repository) {
        throw new Error('GITHUB_REPOSITORY is required to read deploy history. Refusing to deploy without an ordering decision.');
    }

    const listed = JSON.parse(exec('gh', [
        'run', 'list',
        '--workflow', 'ci.yml',
        '--branch', 'main',
        '--event', 'push',
        '--limit', String(RUN_WINDOW),
        '--json', 'databaseId,headSha,status'
    ]));

    if (!Array.isArray(listed)) {
        throw new Error('Deploy history response was not a list. Refusing to deploy without an ordering decision.');
    }

    /** @type {DeployedCommit[]} */
    const entries = [];

    listed.forEach((run) => {
        const sha = typeof run.headSha === 'string' ? run.headSha : '';
        if (!sha || sha === commitSha || !runNeedsJobInspection(run.status)) {
            return;
        }

        if (!gitIsAncestor(sha, commitSha) && !gitIsAncestor(commitSha, sha)) {
            return;
        }

        const payload = JSON.parse(exec('gh', [
            'api',
            `repos/${repository}/actions/runs/${run.databaseId}/jobs`
        ]));
        const flags = deployedFlagsFromJobs(payload && payload.jobs);
        entries.push({ sha, ...flags });
    });

    return mergeDeployedCommits(entries);
}

/**
 * @param {DeployPlan} plan
 * @returns {Record<string, string>}
 */
function planOutputs(plan) {
    return {
        skip: String(plan.skip),
        reason: plan.reason,
        deploy_base: plan.deployBase,
        republish_all: String(plan.republishAll),
        newer_sha: plan.newerSha || ''
    };
}

/**
 * @param {Record<string, string>} outputs
 * @returns {void}
 */
function writeGithubOutputs(outputs) {
    const outputPath = process.env.GITHUB_OUTPUT;
    if (!outputPath) {
        throw new Error('GITHUB_OUTPUT is not set');
    }

    const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
    fs.appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

/**
 * @param {string[]} argv
 * @returns {{ mode: 'scope' | 'skip', commit: string, eventBefore: string, writeGithubOutput: boolean }}
 */
function parseArgs(argv) {
    /** @type {{ mode: 'scope' | 'skip', commit: string, eventBefore: string, writeGithubOutput: boolean }} */
    const args = {
        mode: 'scope',
        commit: '',
        eventBefore: '',
        writeGithubOutput: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--mode') {
            const mode = argv[index + 1];
            if (mode !== 'scope' && mode !== 'skip') {
                throw new Error(`Unknown --mode ${mode || ''}`);
            }
            args.mode = mode;
            index += 1;
            continue;
        }

        if (arg === '--commit') {
            args.commit = argv[index + 1] || '';
            index += 1;
            continue;
        }

        if (arg === '--event-before') {
            args.eventBefore = argv[index + 1] || '';
            index += 1;
            continue;
        }

        if (arg === '--write-github-output') {
            args.writeGithubOutput = true;
            continue;
        }

        if (arg === '--help' || arg === '-h') {
            console.log('Usage: node scripts/plan-production-deploy.js --mode scope|skip --commit <sha> --event-before <sha> [--write-github-output]');
            process.exit(0);
        }

        throw new Error(`Unknown argument ${arg}`);
    }

    if (!args.commit || !args.eventBefore) {
        throw new Error('Both --commit and --event-before are required');
    }

    return args;
}

/**
 * @param {string} commitSha
 * @param {string} eventBefore
 * @returns {DeployPlan}
 */
function decideProductionDeploy(commitSha, eventBefore) {
    exec('git', ['fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main']);
    const mainHeadSha = readMainHead();
    const deployedCommits = loadDeployedCommits(commitSha);
    const preliminary = planProductionDeploy({
        commitSha,
        mainHeadSha,
        eventBefore,
        changedFiles: [],
        isAncestor: gitIsAncestor,
        deployedCommits
    });
    const changedFiles = preliminary.skip
        ? []
        : getChangedFilesFromGit(preliminary.deployBase, commitSha);

    return planProductionDeploy({
        commitSha,
        mainHeadSha,
        eventBefore,
        changedFiles,
        isAncestor: gitIsAncestor,
        deployedCommits
    });
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const plan = decideProductionDeploy(args.commit, args.eventBefore);
    console.log(`Production deploy plan: reason=${plan.reason} base=${plan.deployBase} republish_all=${plan.republishAll} skip=${plan.skip}`);

    if (args.mode === 'skip') {
        const notice = formatGithubNotice(plan);
        if (notice) {
            console.log(notice);
        }
    }

    if (args.writeGithubOutput) {
        writeGithubOutputs(planOutputs(plan));
    }
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

module.exports = {
    WORKFLOW_FILE,
    decideProductionDeploy,
    deployedFlagsFromJobs,
    formatGithubNotice,
    mergeDeployedCommits,
    newestAssetAncestor,
    newestUploadedDescendant,
    planProductionDeploy,
    resolveDeployBase,
    runNeedsJobInspection
};
