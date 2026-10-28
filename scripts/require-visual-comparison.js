#!/usr/bin/env node
'use strict';

const fs = require('fs');

/**
 * Decide whether a visual-diff job is allowed to succeed.
 *
 * Provider `snap` compares the hosted Snap baseline. The GitHub artifact named
 * in `baselineArtifactName` is not that baseline: the pinned baseline action
 * uploads it only for the local provider, and publish-baseline sets
 * `upload-artifact: false`. `baseline-found: false` is therefore expected on a
 * real hosted comparison and is not, by itself, a failure.
 *
 * A run that tried to compare must finish `clean` or `changes-detected` with
 * every selected route accounted for. `incomplete`, a missing hosted baseline,
 * or a skipped summary after the diff was in scope fails the check. An
 * intentional scope skip (`should-run: false`) is not a comparison.
 *
 * @param {{
 *   shouldRun: string | undefined,
 *   status: string | undefined,
 *   scopeReason: string | undefined,
 *   baselineFound: string | undefined,
 *   baselineResolutionStatus: string | undefined,
 *   baselineResolutionMessage: string | undefined,
 *   summary: object | null,
 *   summaryError: string | undefined
 * }} input
 * @returns {{ ok: boolean, title: string, detail: string }}
 */
function evaluateVisualComparison(input) {
    const shouldRun = input.shouldRun || '';
    const summary = input.summary;
    const status = (input.status || (summary && summary.status) || '').trim();

    if (shouldRun === 'false') {
        const reason = input.scopeReason || (summary && summary.reason) || 'out of scope';
        return {
            ok: true,
            title: 'SnapDrift skipped this pull request',
            detail: `No comparison was required (${reason}). This is an intentional scope skip, not a completed baseline comparison.`
        };
    }

    if (shouldRun !== 'true') {
        return {
            ok: false,
            title: 'SnapDrift comparison did not run',
            detail: 'The visual-diff job did not report whether SnapDrift ran, so this check is failing instead of reporting success.'
        };
    }

    if (input.summaryError) {
        return {
            ok: false,
            title: 'SnapDrift comparison did not finish',
            detail: `This check is failing instead of reporting success. The summary could not be read: ${input.summaryError}`
        };
    }

    if (!summary || typeof summary !== 'object') {
        return {
            ok: false,
            title: 'SnapDrift comparison did not finish',
            detail: 'This check is failing instead of reporting success. SnapDrift did not write a summary, so there is no evidence of a baseline comparison.'
        };
    }

    const errors = Array.isArray(summary.errors) ? summary.errors : [];
    const missingInBaseline = Number(summary.missingInBaseline) || 0;
    const missingInCurrent = Number(summary.missingInCurrent) || 0;
    const matched = Number(summary.matchedScreenshots) || 0;
    const changed = Number(summary.changedScreenshots) || 0;
    const compared = matched + changed;
    const total = Number(summary.totalScreenshots);
    const fullyCompared = Number.isFinite(total) && total > 0 && compared === total
        && errors.length === 0
        && missingInBaseline === 0
        && missingInCurrent === 0
        && (status === 'clean' || status === 'changes-detected');

    if (fullyCompared) {
        const artifactFound = input.baselineFound === 'true';
        const artifactNote = artifactFound
            ? 'A GitHub Actions baseline artifact was also resolved.'
            : 'GitHub artifact lookup did not find `ui-foundation-visual-baseline`'
                + ` (${input.baselineResolutionStatus || 'not found'}). That artifact is not the baseline:`
                + ' publish-baseline sets upload-artifact to false, and the pinned SnapDrift baseline action'
                + ' uploads it only for the local provider. This diff used the hosted Snap baseline.';
        return {
            ok: true,
            title: 'SnapDrift compared this pull request against a baseline',
            detail: `status: ${status}. Compared ${compared} of ${total} selected route(s)`
                + ` (${matched} matched, ${changed} over threshold). ${artifactNote}`
        };
    }

    const lines = [
        'SnapDrift did not finish a comparison against a baseline, so this check is failing instead of reporting success.',
        `status: ${status || 'missing'}`,
        `GitHub artifact baseline-found: ${input.baselineFound === 'true' ? 'true' : 'false'}`,
        `GitHub artifact resolution: ${input.baselineResolutionStatus || 'unknown'}`
    ];
    if (input.baselineResolutionMessage) {
        lines.push(`artifact lookup: ${input.baselineResolutionMessage}`);
    }
    if (summary.reason) {
        lines.push(`reason: ${summary.reason}`);
    }
    if (summary.message) {
        lines.push(`message: ${summary.message}`);
    }
    if (errors.length > 0) {
        lines.push('errors:');
        errors.forEach((error) => {
            const id = error && error.id ? error.id : 'unknown';
            const message = error && error.message ? error.message : 'unknown error';
            lines.push(`- ${id}: ${message}`);
        });
    }
    if (missingInBaseline > 0 || missingInCurrent > 0) {
        lines.push(`missing in baseline: ${missingInBaseline}; missing in current capture: ${missingInCurrent}`);
    }
    if (Number.isFinite(total)) {
        lines.push(`compared ${compared} of ${total} selected route(s).`);
    }
    return {
        ok: false,
        title: 'SnapDrift comparison incomplete',
        detail: lines.join('\n')
    };
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {{
 *   existsSync?: (path: string) => boolean,
 *   readFileSync?: (path: string, encoding: string) => string,
 *   writeSummary?: (markdown: string) => void,
 *   writeStdout?: (line: string) => void,
 *   writeStderr?: (line: string) => void
 * }} [io]
 * @returns {number}
 */
function runVisualComparisonCheck(env, io) {
    const existsSync = (io && io.existsSync) || fs.existsSync;
    const readFileSync = (io && io.readFileSync) || fs.readFileSync;
    const writeSummary = (io && io.writeSummary) || ((markdown) => {
        if (env.GITHUB_STEP_SUMMARY) {
            fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
        }
    });
    const writeStdout = (io && io.writeStdout) || ((line) => {
        process.stdout.write(`${line}\n`);
    });
    const writeStderr = (io && io.writeStderr) || ((line) => {
        process.stderr.write(`${line}\n`);
    });

    const summaryPath = env.SUMMARY_PATH || '';
    let summary = null;
    let summaryError;
    if (!summaryPath) {
        summaryError = 'SUMMARY_PATH is empty.';
    } else if (!existsSync(summaryPath)) {
        summaryError = `summary file not found at ${summaryPath}.`;
    } else {
        try {
            summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
        } catch (error) {
            summaryError = error instanceof Error ? error.message : String(error);
        }
    }

    // A scope skip still writes a summary, but a missing one must not fail the
    // intentional-skip path: the action records should-run before the summary.
    if (env.SHOULD_RUN === 'false') {
        summaryError = undefined;
    }

    const result = evaluateVisualComparison({
        shouldRun: env.SHOULD_RUN,
        status: env.STATUS,
        scopeReason: env.SCOPE_REASON,
        baselineFound: env.BASELINE_FOUND,
        baselineResolutionStatus: env.BASELINE_RESOLUTION_STATUS,
        baselineResolutionMessage: env.BASELINE_RESOLUTION_MESSAGE,
        summary,
        summaryError
    });

    const markdown = `### ${result.title}\n\n${result.detail}\n`;
    writeSummary(markdown);
    writeStdout(markdown.trimEnd());
    if (!result.ok) {
        const annotation = result.title.replace(/\s+/g, ' ').trim();
        writeStderr(`::error::${annotation}`);
        return 1;
    }
    return 0;
}

/**
 * `node scripts/require-visual-comparison.js` passes no second argument, so
 * the check runs only when this file is the process entry. Callers can pass
 * the flag explicitly.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {boolean} [invokedDirectly]
 * @returns {number | undefined}
 */
function runCli(env = process.env, invokedDirectly = require.main === module) {
    if (!invokedDirectly) {
        return undefined;
    }
    const code = runVisualComparisonCheck(env);
    process.exitCode = code;
    return code;
}

runCli();

module.exports = {
    evaluateVisualComparison,
    runVisualComparisonCheck,
    runCli
};
