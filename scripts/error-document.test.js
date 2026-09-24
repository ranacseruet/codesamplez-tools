/** @jest-environment node */

const { generateNotFoundDocument } = require('./error-document');
const { SITE_BASE_URL, buildSiteAssetUri } = require('../common/siteBaseUrl');

function withEnv(overrides, run) {
    const originalEnv = { ...process.env };

    Object.keys(overrides).forEach((key) => {
        const value = overrides[key];
        if (typeof value === 'undefined') {
            delete process.env[key];
            return;
        }

        process.env[key] = value;
    });

    try {
        return run();
    } finally {
        process.env = originalEnv;
    }
}

describe('not found document generation', () => {
    it('renders a branded, noindex 404 page that links back to the tools index', () => {
        const html = generateNotFoundDocument();

        // Same provenance stamp as root/tool pages, so a live 404 is traceable to a build.
        expect(html).toMatch(/<html lang="en" data-theme="dark" data-build-commit="[0-9a-f]{40}">/);
        expect(html).toContain("localStorage.getItem('cst-standalone-theme-mode')");
        expect(html).toContain('<title>Page Not Found | CodeSamplez</title>');
        expect(html).toContain('<meta name="robots" content="noindex, follow">');
        expect(html).toContain('<h1 class="main-title">404 — Page Not Found</h1>');
        expect(html).toContain(`<a href="${SITE_BASE_URL}" class="cta-button">Browse all tools`);
        expect(html).toContain(`<link rel="stylesheet" href="${buildSiteAssetUri('/styles.css')}">`);
        expect(html).toContain(`<script src="${buildSiteAssetUri('/root-shell/bundle.main.js')}" defer></script>`);

        // Exactly one h1, and no per-page canonical or structured data on a soft-404.
        expect([...html.matchAll(/<h1\b[^>]*>/g)]).toHaveLength(1);
        expect(html).not.toContain('rel="canonical"');
        expect(html).not.toContain('application/ld+json');
        expect(html).not.toContain('og:image');
    });

    it('injects analytics head scripts so 404 hits are tracked in production', () => {
        const html = withEnv({
            NODE_ENV: 'production',
            CST_GA_MEASUREMENT_ID: 'G-NOTFOUND01'
        }, () => generateNotFoundDocument());

        expect(html).toContain('https://www.googletagmanager.com/gtag/js?id=G-NOTFOUND01');
    });

    it('omits analytics in development', () => {
        const html = withEnv({ NODE_ENV: 'development' }, () => generateNotFoundDocument());

        expect(html).not.toContain('googletagmanager.com');
    });
});
