const { evaluateVisualComparison, runVisualComparisonCheck } = require('./require-visual-comparison');

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
});
