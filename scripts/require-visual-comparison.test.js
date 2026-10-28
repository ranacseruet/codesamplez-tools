const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { evaluateVisualComparison, runVisualComparisonCheck, runCli } = require('./require-visual-comparison');

function completedSummary(overrides) {
    return {
        status: 'clean',
        totalScreenshots: 2,
        matchedScreenshots: 2,
        changedScreenshots: 0,
        missingInBaseline: 0,
        missingInCurrent: 0,
        errors: [],
        ...overrides
    };
}

describe('evaluateVisualComparison', () => {
    it('treats an intentional scope skip as not a comparison', () => {
        const result = evaluateVisualComparison({
            shouldRun: 'false',
            status: 'skipped',
            scopeReason: 'no_snapdrift_relevant_changes',
            baselineFound: 'false',
            baselineResolutionStatus: '',
            summary: { status: 'skipped', reason: 'no_snapdrift_relevant_changes' }
        });

        expect(result.ok).toBe(true);
        expect(result.title).toMatch(/skipped/i);
        expect(result.detail).toMatch(/not a completed baseline comparison/);
        expect(result.detail).toMatch(/no_snapdrift_relevant_changes/);
    });

    it('fails when the job never reported whether SnapDrift ran', () => {
        const result = evaluateVisualComparison({
            shouldRun: '',
            status: '',
            summary: null
        });

        expect(result.ok).toBe(false);
        expect(result.detail).toMatch(/failing instead of reporting success/);
    });

    it('fails a should-run comparison that did not write a summary', () => {
        const result = evaluateVisualComparison({
            shouldRun: 'true',
            status: '',
            summary: null,
            summaryError: 'summary file not found.'
        });

        expect(result.ok).toBe(false);
        expect(result.detail).toMatch(/summary file not found/);
    });

    it('fails when the summary is incomplete, including comparison_too_large', () => {
        const result = evaluateVisualComparison({
            shouldRun: 'true',
            status: 'incomplete',
            baselineFound: 'false',
            baselineResolutionStatus: 'missing',
            baselineResolutionMessage: 'No non-expired SnapDrift baseline artifact named ui-foundation-visual-baseline was found.',
            summary: completedSummary({
                status: 'incomplete',
                totalScreenshots: 2,
                matchedScreenshots: 1,
                changedScreenshots: 0,
                errors: [{
                    id: 'js-minifier-mobile',
                    message: 'comparison_too_large: union canvas exceeds the maximum'
                }]
            })
        });

        expect(result.ok).toBe(false);
        expect(result.title).toMatch(/incomplete/i);
        expect(result.detail).toMatch(/failing instead of reporting success/);
        expect(result.detail).toMatch(/status: incomplete/);
        expect(result.detail).toMatch(/js-minifier-mobile: comparison_too_large/);
        expect(result.detail).toMatch(/baseline-found: false/);
        expect(result.detail).toMatch(/ui-foundation-visual-baseline/);
    });

    it('fails a skipped missing-baseline summary when the diff was in scope', () => {
        const result = evaluateVisualComparison({
            shouldRun: 'true',
            status: 'skipped',
            baselineFound: 'false',
            baselineResolutionStatus: 'missing',
            summary: {
                status: 'skipped',
                reason: 'missing_main_baseline_artifact',
                message: 'No baseline artifact is available.'
            }
        });

        expect(result.ok).toBe(false);
        expect(result.detail).toMatch(/missing_main_baseline_artifact/);
        expect(result.detail).toMatch(/failing instead of reporting success/);
    });

    it('accepts a completed hosted comparison when the GitHub artifact is missing', () => {
        const result = evaluateVisualComparison({
            shouldRun: 'true',
            status: 'clean',
            baselineFound: 'false',
            baselineResolutionStatus: 'missing',
            summary: completedSummary()
        });

        expect(result.ok).toBe(true);
        expect(result.detail).toMatch(/Compared 2 of 2/);
        expect(result.detail).toMatch(/hosted Snap baseline/);
        expect(result.detail).toMatch(/ui-foundation-visual-baseline/);
        expect(result.detail).toMatch(/upload-artifact/);
    });

    it('accepts a completed comparison that found drift', () => {
        const result = evaluateVisualComparison({
            shouldRun: 'true',
            status: 'changes-detected',
            baselineFound: 'true',
            baselineResolutionStatus: 'found',
            summary: completedSummary({
                status: 'changes-detected',
                matchedScreenshots: 1,
                changedScreenshots: 1
            })
        });

        expect(result.ok).toBe(true);
        expect(result.detail).toMatch(/status: changes-detected/);
        expect(result.detail).toMatch(/1 over threshold/);
    });

    it('rejects a clean status that did not compare every selected route', () => {
        const missing = evaluateVisualComparison({
            shouldRun: 'true',
            status: 'clean',
            summary: completedSummary({ missingInBaseline: 1, matchedScreenshots: 1 })
        });
        const empty = evaluateVisualComparison({
            shouldRun: 'true',
            status: 'clean',
            summary: completedSummary({ totalScreenshots: 0, matchedScreenshots: 0 })
        });

        expect(missing.ok).toBe(false);
        expect(missing.detail).toMatch(/missing in baseline: 1/);
        expect(empty.ok).toBe(false);
    });

    it('fails when a should-run diff has no summary object', () => {
        const missing = evaluateVisualComparison({
            shouldRun: 'true',
            status: 'clean',
            summary: null
        });
        const notAnObject = evaluateVisualComparison({
            shouldRun: 'true',
            status: '',
            summary: 'not-json-object'
        });

        expect(missing.ok).toBe(false);
        expect(notAnObject.ok).toBe(false);
        expect(missing.detail).toMatch(/did not write a summary/);
        expect(notAnObject.detail).toMatch(/did not write a summary/);
    });

    it('uses the summary status and scope reason when the action outputs are empty', () => {
        const skipped = evaluateVisualComparison({
            shouldRun: 'false',
            status: '',
            summary: { status: 'skipped', reason: 'documented_skip' }
        });
        const unnamed = evaluateVisualComparison({
            shouldRun: 'false',
            summary: null
        });
        const fromSummary = evaluateVisualComparison({
            shouldRun: 'true',
            status: '',
            baselineFound: 'false',
            summary: completedSummary()
        });

        expect(skipped.ok).toBe(true);
        expect(skipped.detail).toMatch(/documented_skip/);
        expect(unnamed.detail).toMatch(/out of scope/);
        expect(fromSummary.ok).toBe(true);
        expect(fromSummary.detail).toMatch(/status: clean/);
        expect(fromSummary.detail).toMatch(/not found/);
    });

    it('describes a failed comparison that omitted ids, counts, and artifact text', () => {
        const result = evaluateVisualComparison({
            shouldRun: 'true',
            status: '',
            baselineFound: 'true',
            baselineResolutionStatus: '',
            summary: {
                errors: [null, { id: '', message: '' }, { message: 'comparison_too_large' }],
                missingInCurrent: 2
            }
        });

        expect(result.ok).toBe(false);
        expect(result.detail).toMatch(/status: missing/);
        expect(result.detail).toMatch(/baseline-found: true/);
        expect(result.detail).toMatch(/resolution: unknown/);
        expect(result.detail).toMatch(/- unknown: unknown error/);
        expect(result.detail).toMatch(/- unknown: comparison_too_large/);
        expect(result.detail).toMatch(/missing in current capture: 2/);
        expect(result.detail).not.toMatch(/compared \d+ of/);
    });
});

describe('runVisualComparisonCheck', () => {
    it('writes the verdict to the job summary and returns the exit code', () => {
        const summary = JSON.stringify(completedSummary());
        const written = [];
        const code = runVisualComparisonCheck({
            SHOULD_RUN: 'true',
            STATUS: 'clean',
            BASELINE_FOUND: 'false',
            BASELINE_RESOLUTION_STATUS: 'missing',
            SUMMARY_PATH: 'summary.json',
            GITHUB_STEP_SUMMARY: '/tmp/unused'
        }, {
            existsSync: () => true,
            readFileSync: () => summary,
            writeSummary: (markdown) => written.push(markdown),
            writeStdout: () => {},
            writeStderr: () => {}
        });

        expect(code).toBe(0);
        expect(written[0]).toMatch(/compared this pull request against a baseline/i);
    });

    it('does not require a summary file when the diff was scoped out', () => {
        const written = [];
        const code = runVisualComparisonCheck({
            SHOULD_RUN: 'false',
            STATUS: 'skipped',
            SCOPE_REASON: 'no_snapdrift_relevant_changes',
            SUMMARY_PATH: ''
        }, {
            existsSync: () => false,
            readFileSync: () => {
                throw new Error('should not read');
            },
            writeSummary: (markdown) => written.push(markdown),
            writeStdout: () => {},
            writeStderr: () => {}
        });

        expect(code).toBe(0);
        expect(written[0]).toMatch(/intentional scope skip/);
    });

    it('fails when the summary path is set but the file is missing', () => {
        const stderr = [];
        const code = runVisualComparisonCheck({
            SHOULD_RUN: 'true',
            STATUS: 'incomplete',
            SUMMARY_PATH: '/tmp/snapdrift-summary-missing.json',
            BASELINE_FOUND: 'false',
            BASELINE_RESOLUTION_STATUS: 'missing'
        }, {
            existsSync: () => false,
            readFileSync: () => {
                throw new Error('should not read');
            },
            writeSummary: () => {},
            writeStdout: () => {},
            writeStderr: (line) => stderr.push(line)
        });

        expect(code).toBe(1);
        expect(stderr[0]).toBe('::error::SnapDrift comparison did not finish');
    });

    it('reports a non-Error thrown while reading the summary', () => {
        const code = runVisualComparisonCheck({
            SHOULD_RUN: 'true',
            STATUS: '',
            SUMMARY_PATH: 'summary.json'
        }, {
            existsSync: () => true,
            readFileSync: () => {
                throw 'boom';
            },
            writeSummary: () => {},
            writeStdout: () => {},
            writeStderr: () => {}
        });

        expect(code).toBe(1);
    });

    it('reports an Error thrown while parsing the summary', () => {
        let detail = '';
        const code = runVisualComparisonCheck({
            SHOULD_RUN: 'true',
            STATUS: 'incomplete',
            SUMMARY_PATH: 'summary.json'
        }, {
            existsSync: () => true,
            readFileSync: () => 'not-json',
            writeSummary: (markdown) => {
                detail = markdown;
            },
            writeStdout: () => {},
            writeStderr: () => {}
        });

        expect(code).toBe(1);
        expect(detail).toMatch(/not-json|Unexpected token|JSON/);
    });

    it('writes the job summary and the failure annotation through the default streams', () => {
        const summaryFile = path.join(os.tmpdir(), `visual-comparison-summary-${process.pid}.md`);
        fs.writeFileSync(summaryFile, '');
        const stdout = [];
        const stderr = [];
        const originalStdout = process.stdout.write;
        const originalStderr = process.stderr.write;
        process.stdout.write = (chunk) => {
            stdout.push(String(chunk));
            return true;
        };
        process.stderr.write = (chunk) => {
            stderr.push(String(chunk));
            return true;
        };

        try {
            const failed = runVisualComparisonCheck({
                SHOULD_RUN: 'true',
                STATUS: '',
                SUMMARY_PATH: '',
                GITHUB_STEP_SUMMARY: summaryFile
            });
            const skipped = runVisualComparisonCheck({
                SHOULD_RUN: 'false',
                STATUS: 'skipped',
                SCOPE_REASON: 'no_snapdrift_relevant_changes',
                SUMMARY_PATH: ''
            });

            expect(failed).toBe(1);
            expect(fs.readFileSync(summaryFile, 'utf8')).toMatch(/did not finish/);
            expect(stdout.join('')).toMatch(/did not finish/);
            expect(stderr.join('')).toMatch(/::error::SnapDrift comparison did not finish/);
            expect(skipped).toBe(0);
            expect(stdout.join('')).toMatch(/intentional scope skip/);
        } finally {
            process.stdout.write = originalStdout;
            process.stderr.write = originalStderr;
            fs.rmSync(summaryFile, { force: true });
        }
    });
});

describe('runCli', () => {
    const previousExitCode = process.exitCode;

    afterEach(() => {
        process.exitCode = previousExitCode;
    });

    it('sets the process exit code when invoked as the script entry', () => {
        const summaryFile = path.join(os.tmpdir(), `visual-comparison-cli-${process.pid}.md`);
        fs.writeFileSync(summaryFile, '');
        const originalStdout = process.stdout.write;
        const originalStderr = process.stderr.write;
        process.stdout.write = () => true;
        process.stderr.write = () => true;

        try {
            const code = runCli({
                SHOULD_RUN: 'false',
                STATUS: 'skipped',
                SCOPE_REASON: 'cli-direct',
                SUMMARY_PATH: '',
                GITHUB_STEP_SUMMARY: summaryFile
            }, true);

            expect(code).toBe(0);
            expect(process.exitCode).toBe(0);
            expect(fs.readFileSync(summaryFile, 'utf8')).toMatch(/intentional scope skip/);
        } finally {
            process.stdout.write = originalStdout;
            process.stderr.write = originalStderr;
            fs.rmSync(summaryFile, { force: true });
        }
    });

    it('does nothing when the module is required instead of executed', () => {
        const code = runCli({
            SHOULD_RUN: 'true',
            SUMMARY_PATH: ''
        }, false);

        expect(code).toBeUndefined();
    });

    it('exits 0 for a scope skip and 1 when the direct process has no summary', () => {
        const script = path.join(__dirname, 'require-visual-comparison.js');
        const summaryFile = path.join(os.tmpdir(), `visual-comparison-spawn-${process.pid}.md`);
        fs.writeFileSync(summaryFile, '');

        try {
            const skipped = spawnSync(process.execPath, [script], {
                env: {
                    ...process.env,
                    SHOULD_RUN: 'false',
                    STATUS: 'skipped',
                    SCOPE_REASON: 'cli-direct',
                    SUMMARY_PATH: '',
                    GITHUB_STEP_SUMMARY: summaryFile
                },
                encoding: 'utf8'
            });
            const failed = spawnSync(process.execPath, [script], {
                env: {
                    ...process.env,
                    SHOULD_RUN: 'true',
                    STATUS: '',
                    SUMMARY_PATH: '',
                    GITHUB_STEP_SUMMARY: ''
                },
                encoding: 'utf8'
            });

            expect(skipped.status).toBe(0);
            expect(skipped.stdout).toMatch(/intentional scope skip/);
            expect(fs.readFileSync(summaryFile, 'utf8')).toMatch(/cli-direct/);
            expect(failed.status).toBe(1);
            expect(failed.stderr).toMatch(/::error::SnapDrift comparison did not finish/);
        } finally {
            fs.rmSync(summaryFile, { force: true });
        }
    });
});
