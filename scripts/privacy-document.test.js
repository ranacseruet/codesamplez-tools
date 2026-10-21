/** @jest-environment node */

const { generateNotFoundDocument } = require('./error-document');
const { formatPrivacyLastUpdatedLabel, generatePrivacyDocument, PRIVACY_PAGE_DESCRIPTION } = require('./privacy-document');
const { generateRootDocument } = require('./root-document');
const { generateToolDocument } = require('./tool-document');
const { buildSitemapEntries, getPrivacyPageLastmodPaths, resolveGitLastmodForPaths } = require('./generated-site-assets');
const { SITE_BASE_URL, buildSiteAssetUri, buildSiteHref } = require('../common/siteBaseUrl');

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

function footerBottom(html) {
    const start = html.indexOf('cst-shell__footer-bottom');
    const end = html.indexOf('</footer>', start);
    return html.slice(start, end);
}

describe('privacy document generation', () => {
    const privacyUrl = buildSiteHref('/privacy/');

    it('prerenders a self-canonical privacy page', () => {
        const html = generatePrivacyDocument();

        expect(html).toMatch(/<html lang="en" data-theme="dark" data-build-commit="[0-9a-f]{40}">/);
        expect(html).toContain('<title>Privacy Policy | CodeSamplez</title>');
        expect(html).toContain(`<meta name="description" content="${PRIVACY_PAGE_DESCRIPTION}">`);
        expect(html).toContain(`<link rel="canonical" href="${privacyUrl}">`);
        expect(html).toContain(`<meta property="og:url" content="${privacyUrl}">`);
        expect(html).toContain('<h1 id="privacy-policy-title" class="main-title">Privacy Policy</h1>');
        expect([...html.matchAll(/<h1\b[^>]*>/g)]).toHaveLength(1);
        expect(html).toContain('"@type":"WebPage"');
        expect(html).toContain('"@type":"BreadcrumbList"');
        expect(html).toContain(`"url":"${privacyUrl}"`);
        expect(html).toContain(`"name":"Home","item":"${SITE_BASE_URL}"`);
        expect(html).toContain('"name":"Privacy Policy"');
        expect(html).toContain(`<a class="cst-shell__breadcrumb-link" href="${SITE_BASE_URL}">Home</a>`);
        expect(html).toContain('<span class="cst-shell__breadcrumb-current" aria-current="page">Privacy Policy</span>');
        expect(html).toContain(`<link rel="stylesheet" href="${buildSiteAssetUri('/styles.css')}">`);
        expect(html).toContain(`<script src="${buildSiteAssetUri('/root-shell/bundle.main.js')}" defer></script>`);
        expect(html).not.toContain('noindex');
    });

    it('formats the sitemap lastmod as a UTC calendar date', () => {
        expect(formatPrivacyLastUpdatedLabel('2026-10-17T23:30:00.000Z')).toBe('17 October 2026');
        expect(formatPrivacyLastUpdatedLabel('2026-01-05T00:30:00.000Z')).toBe('5 January 2026');
        expect(formatPrivacyLastUpdatedLabel('not-a-date')).toBeNull();
        expect(formatPrivacyLastUpdatedLabel(null)).toBeNull();
    });

    it('shows the privacy sitemap lastmod as the visible last-updated date', () => {
        const lastmod = resolveGitLastmodForPaths(getPrivacyPageLastmodPaths());
        const label = formatPrivacyLastUpdatedLabel(lastmod);
        const html = generatePrivacyDocument();
        const privacyEntry = buildSitemapEntries().find((entry) => entry.absoluteUrl === privacyUrl);

        expect(lastmod).toEqual(expect.any(String));
        expect(label).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
        expect(html).toContain(`Last updated: ${label}.`);
        expect(privacyEntry.lastmod).toBe(lastmod);
    });

    it('states local processing, Google Analytics, and Google AdSense cookies without extra legal claims', () => {
        const html = generatePrivacyDocument();

        expect(html).toContain('processed in your browser');
        expect(html).toContain('do not upload that input to a server');
        expect(html).toContain('Google Analytics 4');
        expect(html).toContain('The pages also send a tool_used event for diff-checker, json-formatter, and base64 with the params tool_id, action, trigger (user, sample, or share), and outcome (success or error), plus an optional input_size_bucket; unknown trigger or outcome values are dropped, and the event contains no tool input content.');
        expect(html).not.toContain('do not add analytics events beyond that default configuration');
        expect(html).toContain('uses cookies');
        expect(html).toContain('Google AdSense');
        expect(html).toContain("Google, as a third-party vendor, and its partners use cookies to serve ads based on a user's prior visits to this website and other websites.");
        expect(html).toContain("Google's use of advertising cookies enables it and its partners to serve personalized ads.");
        expect(html).toContain('You can opt out of personalized advertising via');
        expect(html).toContain('opt out of some third-party vendors\' cookies via');
        expect(html).toContain('Other third-party vendors and ad networks may also serve ads on the site and use cookies.');
        expect(html).toContain('href="https://adssettings.google.com"');
        expect(html).toContain('href="https://www.aboutads.info/choices/"');
        expect(html).not.toContain('https://www.google.com/settings/ads');
        expect(html).toContain('href="https://adssettings.google.com/"');
        expect(html).toContain('href="https://tools.google.com/dlpage/gaoptout"');
        expect(html).toContain('href="https://codesamplez.com/contact"');
        expect(html).toContain('Visitors in the EEA, the UK, and Switzerland are shown Google\'s consent message and can choose whether Google Analytics and Google AdSense may store cookies. Until that choice allows storage, those cookies stay off. The Privacy settings link in the footer reopens the message.');
        expect(html).toContain('does not provide its own control');
        expect(html).toContain('>Privacy settings</a>');

        ['GDPR', 'CCPA', 'legitimate interest', 'data protection officer', 'retention', 'jurisdiction', 'do not sell'].forEach((phrase) => {
            expect(html.toLowerCase()).not.toContain(phrase.toLowerCase());
        });
    });

    it('links the privacy page from the tool, root, not-found, and privacy footers', () => {
        const privacyLink = `<a href="${privacyUrl}" class="cst-shell__footer-link">Privacy</a>`;
        const documents = [
            generateRootDocument(),
            generateToolDocument('json-formatter-tool'),
            generateNotFoundDocument(),
            generatePrivacyDocument()
        ];

        documents.forEach((html) => {
            expect(footerBottom(html)).toContain(privacyLink);
            expect(footerBottom(html)).toContain('>Privacy settings</a>');
        });
    });

    it('does not set a referrer policy stricter than strict-origin-when-cross-origin', () => {
        const documents = [
            generateRootDocument(),
            generateToolDocument('json-formatter-tool'),
            generateNotFoundDocument(),
            generatePrivacyDocument()
        ];

        documents.forEach((html) => {
            const referrerMetas = [...html.matchAll(/<meta\b[^>]*>/gi)]
                .map((match) => match[0])
                .filter((tag) => /name=["']referrer["']/i.test(tag));
            referrerMetas.forEach((tag) => {
                expect(tag).toMatch(/content=["']strict-origin-when-cross-origin["']/);
            });

            [...html.matchAll(/\breferrerpolicy=["']([^"']+)["']/gi)].forEach((match) => {
                expect(match[1]).toBe('strict-origin-when-cross-origin');
            });
        });
    });

    it('uses a localhost self-canonical in development', () => {
        const html = withEnv({
            NODE_ENV: 'development',
            PORT: '8081',
            CST_SITE_BASE_URL: undefined
        }, () => generatePrivacyDocument());

        expect(html).toContain('<link rel="canonical" href="http://localhost:8081/privacy/">');
        expect(html).toContain('<a href="http://localhost:8081/privacy/" class="cst-shell__footer-link">Privacy</a>');
    });

    it('builds with analytics ids configured and does not throw', () => {
        const productionHtml = withEnv({
            NODE_ENV: 'production',
            CST_GA_MEASUREMENT_ID: 'G-PRIVACYPAGE',
            CST_ADSENSE_CLIENT_ID: 'ca-pub-1234567890123456'
        }, () => generatePrivacyDocument());
        const developmentHtml = withEnv({
            NODE_ENV: 'development',
            CST_GA_MEASUREMENT_ID: 'G-PRIVACYPAGE',
            CST_ADSENSE_CLIENT_ID: 'ca-pub-1234567890123456'
        }, () => generatePrivacyDocument());

        expect(productionHtml).toContain('https://www.googletagmanager.com/gtag/js?id=G-PRIVACYPAGE');
        expect(productionHtml.indexOf("gtag('consent','default'")).toBeLessThan(productionHtml.indexOf('https://www.googletagmanager.com/gtag/js?id=G-PRIVACYPAGE'));
        expect(productionHtml).toContain('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456');
        expect(productionHtml).toContain('location.hostname!=="tools.codesamplez.com"');
        expect(developmentHtml).not.toContain('googletagmanager.com');
        expect(developmentHtml).not.toContain('googlesyndication.com');
    });
});
