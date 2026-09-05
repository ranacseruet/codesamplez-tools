/** @jest-environment node */

const {
    buildAdsTxt,
    findTrackerMarkupOffenders,
    renderAdsenseMarkup,
    renderAnalyticsHeadMarkup,
    renderAnalyticsResourceHints,
    renderGoogleAnalyticsMarkup
} = require('./analytics');

describe('analytics head markup', () => {
    it('renders the GA4 loader and bootstrap for a measurement id', () => {
        const markup = renderGoogleAnalyticsMarkup('G-ABC123XYZ');

        expect(markup).toContain('https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ');
        expect(markup).toContain("gtag('config','G-ABC123XYZ')");
        expect(markup).toContain('window.dataLayer=window.dataLayer||[]');
    });

    it('lazily injects the AdSense Auto ads loader for a client id', () => {
        const markup = renderAdsenseMarkup('ca-pub-1234567890123456');

        // Loader URL is present, but as a deferred script injection rather than a
        // render-time <script src> on the critical path.
        expect(markup).toContain('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456');
        expect(markup).not.toContain('<script async src=');
        expect(markup).toContain("s.crossOrigin='anonymous'");
        // Deferred until first interaction or a short idle fallback.
        expect(markup).toContain('addEventListener');
        expect(markup).toContain('setTimeout(load,3500)');
    });

    it('escapes a script-breakout attempt in the AdSense client id', () => {
        const markup = renderAdsenseMarkup('ca-pub-</script><script>x');
        expect(markup).not.toContain('</script><script>x');
        expect(markup).toContain('\\u003c/script');
    });

    it('combines GA4 and AdSense when both ids are configured', () => {
        const markup = renderAnalyticsHeadMarkup({
            googleAnalyticsId: 'G-ABC123XYZ',
            adsenseClientId: 'ca-pub-1234567890123456'
        });

        expect(markup).toContain('googletagmanager.com');
        expect(markup).toContain('googlesyndication.com');
    });

    it('renders only the configured channel for partial configuration', () => {
        const gaOnly = renderAnalyticsHeadMarkup({ googleAnalyticsId: 'G-ABC123XYZ', adsenseClientId: null });
        expect(gaOnly).toContain('googletagmanager.com');
        expect(gaOnly).not.toContain('googlesyndication.com');

        const adsOnly = renderAnalyticsHeadMarkup({ googleAnalyticsId: null, adsenseClientId: 'ca-pub-1234567890123456' });
        expect(adsOnly).toContain('googlesyndication.com');
        expect(adsOnly).not.toContain('googletagmanager.com');
    });

    it('returns an empty string when nothing is configured', () => {
        expect(renderAnalyticsHeadMarkup({ googleAnalyticsId: null, adsenseClientId: null })).toBe('');
        expect(renderAnalyticsHeadMarkup()).toBe('');
    });

    it('escapes ids defensively when building markup', () => {
        const markup = renderGoogleAnalyticsMarkup('G-A"B');
        expect(markup).toContain('id=G-A&quot;B');
    });
});

describe('analytics resource hints', () => {
    it('preconnects to the ad origins when AdSense is configured', () => {
        const hints = renderAnalyticsResourceHints({ googleAnalyticsId: null, adsenseClientId: 'ca-pub-1234567890123456' });
        expect(hints).toContain('rel="preconnect" href="https://pagead2.googlesyndication.com" crossorigin');
        expect(hints).toContain('rel="preconnect" href="https://googleads.g.doubleclick.net" crossorigin');
        expect(hints).not.toContain('googletagmanager.com');
    });

    it('preconnects to the GA origin when analytics is configured', () => {
        const hints = renderAnalyticsResourceHints({ googleAnalyticsId: 'G-ABC123XYZ', adsenseClientId: null });
        expect(hints).toContain('rel="preconnect" href="https://www.googletagmanager.com"');
        expect(hints).not.toContain('googlesyndication.com');
    });

    it('returns an empty string when nothing is configured', () => {
        expect(renderAnalyticsResourceHints({ googleAnalyticsId: null, adsenseClientId: null })).toBe('');
        expect(renderAnalyticsResourceHints()).toBe('');
    });
});

describe('ads.txt', () => {
    it('derives the publisher record by stripping the ca- prefix', () => {
        expect(buildAdsTxt('ca-pub-1234567890123456'))
            .toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0');
    });

    it('returns an empty string when AdSense is not configured', () => {
        expect(buildAdsTxt(null)).toBe('');
        expect(buildAdsTxt('')).toBe('');
        expect(buildAdsTxt(undefined)).toBe('');
    });
});

describe('tracker markup detection', () => {
    it('flags every markup shape this module emits', () => {
        const offenders = findTrackerMarkupOffenders([
            { filename: 'ga.html', source: renderGoogleAnalyticsMarkup('G-ABC123XYZ') },
            { filename: 'ads.html', source: renderAdsenseMarkup('ca-pub-1234567890123456') },
            {
                filename: 'hints.html',
                source: renderAnalyticsResourceHints({ googleAnalyticsId: 'G-ABC123XYZ', adsenseClientId: 'ca-pub-1234567890123456' })
            }
        ]);

        expect(offenders).toEqual(['ga.html', 'ads.html', 'hints.html']);
    });

    it('ignores tracker-free pages and prose that merely mentions analytics', () => {
        expect(findTrackerMarkupOffenders([
            { filename: 'clean.html', source: '<!doctype html><html><head><title>Tool</title></head></html>' },
            { filename: 'prose.html', source: '<p>We removed Google Analytics from local builds.</p>' }
        ])).toEqual([]);
    });
});
