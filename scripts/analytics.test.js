/** @jest-environment node */

const {
    buildAdsTxt,
    renderAdsenseMarkup,
    renderAnalyticsHeadMarkup,
    renderGoogleAnalyticsMarkup
} = require('./analytics');

describe('analytics head markup', () => {
    it('renders the GA4 loader and bootstrap for a measurement id', () => {
        const markup = renderGoogleAnalyticsMarkup('G-ABC123XYZ');

        expect(markup).toContain('https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ');
        expect(markup).toContain("gtag('config','G-ABC123XYZ')");
        expect(markup).toContain('window.dataLayer=window.dataLayer||[]');
    });

    it('renders the AdSense Auto ads loader for a client id', () => {
        const markup = renderAdsenseMarkup('ca-pub-1234567890123456');

        expect(markup).toContain('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456');
        expect(markup).toContain('crossorigin="anonymous"');
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
