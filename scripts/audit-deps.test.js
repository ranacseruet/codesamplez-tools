const { ALLOWED_ADVISORIES, advisoryIdFromUrl, collectAdvisories, evaluateAudit } = require('./audit-deps');

const BRACES_ID = 'GHSA-vfj7-8cjw-p6xm';

function advisory(name, id, severity = 'high') {
    return { source: 1, name, title: `${name} problem`, url: `https://github.com/advisories/${id}`, severity };
}

/** Mirrors the `npm audit --json` shape: the root package holds the advisory, dependents list it by name. */
function bracesReport() {
    return {
        vulnerabilities: {
            braces: { name: 'braces', severity: 'high', via: [advisory('braces', BRACES_ID)] },
            micromatch: { name: 'micromatch', severity: 'high', via: ['braces'] },
            'webpack-dev-server': { name: 'webpack-dev-server', severity: 'high', via: ['micromatch'] },
        },
    };
}

describe('audit-deps', () => {
    const allowed = { [BRACES_ID]: { reason: 'test', expires: '2026-11-04' } };
    const before = new Date('2026-10-05T00:00:00Z');

    test('extracts the GHSA id from an advisory url', () => {
        expect(advisoryIdFromUrl(`https://github.com/advisories/${BRACES_ID}`)).toBe(BRACES_ID);
        expect(advisoryIdFromUrl('https://example.com/none')).toBeNull();
        expect(advisoryIdFromUrl(undefined)).toBeNull();
    });

    test('counts only advisory objects, not inherited package names', () => {
        expect(collectAdvisories(bracesReport())).toHaveLength(1);
        expect(collectAdvisories({})).toEqual([]);
        expect(collectAdvisories(null)).toEqual([]);
    });

    test('tolerates an allowlisted advisory before it expires', () => {
        const result = evaluateAudit(bracesReport(), { allowed, now: before });
        expect(result.blocking).toEqual([]);
        expect(result.tolerated).toEqual([BRACES_ID]);
    });

    test('blocks an allowlisted advisory once the entry has expired', () => {
        const result = evaluateAudit(bracesReport(), { allowed, now: new Date('2026-11-05T00:00:00Z') });
        expect(result.blocking).toHaveLength(1);
        expect(result.expired).toEqual([BRACES_ID]);
    });

    test('keeps the allowance valid through the whole expiry day', () => {
        const result = evaluateAudit(bracesReport(), { allowed, now: new Date('2026-11-04T20:00:00Z') });
        expect(result.blocking).toEqual([]);
    });

    test('blocks high and critical advisories that are not allowlisted', () => {
        const report = bracesReport();
        report.vulnerabilities.other = { name: 'other', severity: 'critical', via: [advisory('other', 'GHSA-aaaa-bbbb-cccc', 'critical')] };
        const result = evaluateAudit(report, { allowed, now: before });
        expect(result.blocking.map((item) => item.packageName)).toEqual(['other']);
    });

    test('ignores advisories below high severity', () => {
        const report = { vulnerabilities: { 'fast-uri': { via: [advisory('fast-uri', 'GHSA-hrr3-gc8f-f4qj', 'moderate')] } } };
        expect(evaluateAudit(report, { allowed: {}, now: before }).blocking).toEqual([]);
    });

    test('blocks an advisory with no GHSA id rather than waving it through', () => {
        const report = { vulnerabilities: { odd: { via: [{ name: 'odd', title: 'odd', url: '', severity: 'high' }] } } };
        const result = evaluateAudit(report, { allowed, now: before });
        expect(result.blocking).toHaveLength(1);
    });

    test('reports allowlist entries that no longer match anything', () => {
        const result = evaluateAudit({ vulnerabilities: {} }, { allowed, now: before });
        expect(result.unusedAllowances).toEqual([BRACES_ID]);
    });

    test('every shipped allowlist entry carries a reason and a valid expiry', () => {
        for (const [id, entry] of Object.entries(ALLOWED_ADVISORIES)) {
            expect(id).toMatch(/^GHSA-/);
            expect(entry.reason.length).toBeGreaterThan(0);
            expect(Number.isNaN(Date.parse(`${entry.expires}T00:00:00Z`))).toBe(false);
        }
    });
});
