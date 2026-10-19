/** @jest-environment node */

const fs = require('fs');
const vm = require('vm');
const {
    CONSENT_DENIED_REGIONS,
    CONSENT_MODE_WAIT_FOR_UPDATE_MS,
    REGULATED_TIME_ZONES,
    buildAdsTxt,
    findTrackerMarkupOffenders,
    renderAdsenseMarkup,
    renderAnalyticsHeadMarkup,
    renderAnalyticsResourceHints,
    renderGoogleAnalyticsMarkup
} = require('./analytics');

const PRODUCTION_SITE_BASE_URL = 'https://tools.codesamplez.com/';
const BLOCKED_HOSTS = ['localhost', '127.0.0.1', 'd26sivjsrj0zo7.cloudfront.net', 'other.cloudfront.net'];

/**
 * Run the inline loaders against a fake window and record anything that would
 * become a network request (script injection or preconnect insertion).
 * @param {string} markup
 * @param {string} hostname
 * @param {{ timeZone?: string }} [extras]
 */
function executeInlineScripts(markup, hostname, extras = {}) {
    const appended = [];
    const insertedHtml = [];
    const listeners = [];
    const timeouts = [];
    const document = {
        createElement(tag) {
            return { tag, async: false, src: '', crossOrigin: '' };
        },
        head: {
            appendChild(node) {
                appended.push(node);
            },
            insertAdjacentHTML(_position, html) {
                insertedHtml.push(html);
            }
        },
        documentElement: {
            appendChild(node) {
                appended.push(node);
            },
            insertAdjacentHTML(_position, html) {
                insertedHtml.push(html);
            }
        }
    };
    /** @type {Record<string, unknown>} */
    const context = {
        location: { hostname },
        document,
        setTimeout(fn, delay) {
            timeouts.push({ fn, delay });
            return timeouts.length;
        },
        addEventListener(type, fn, options) {
            listeners.push({ type, fn, options });
        },
        removeEventListener() {}
    };
    context.window = context;
    if (extras.timeZone) {
        context.Intl = {
            DateTimeFormat() {
                return {
                    resolvedOptions() {
                        return { timeZone: extras.timeZone };
                    }
                };
            }
        };
    }

    const bodies = [...markup.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
    if (bodies.length === 0) {
        throw new Error('Expected inline loader script');
    }
    bodies.forEach((body) => {
        vm.runInNewContext(body, context, { timeout: 1000 });
    });

    return { appended, insertedHtml, listeners, timeouts, context };
}

describe('analytics head markup', () => {
    it('renders the GA4 loader and bootstrap for a measurement id', () => {
        const markup = renderGoogleAnalyticsMarkup('G-ABC123XYZ', PRODUCTION_SITE_BASE_URL);

        expect(markup).toContain('https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ');
        expect(markup).toContain("gtag('config','G-ABC123XYZ')");
        expect(markup).toContain('window.dataLayer=window.dataLayer||[]');
        expect(markup.indexOf("gtag('consent','default'")).toBeLessThan(markup.indexOf("gtag('config'"));
        expect(markup.indexOf("gtag('config'")).toBeLessThan(markup.indexOf('googletagmanager.com/gtag/js'));
        expect(markup.match(/gtag\('consent','default'/g)).toHaveLength(1);
        expect(markup).toContain(`'region':${JSON.stringify(CONSENT_DENIED_REGIONS)}`);
        expect(markup).toContain(`'wait_for_update':${CONSENT_MODE_WAIT_FOR_UPDATE_MS}`);
        expect(markup).not.toContain("'ad_storage':'granted'");
        expect(markup).not.toContain('referrer');
    });

    it('lazily injects the AdSense Auto ads loader for a client id', () => {
        const markup = renderAdsenseMarkup('ca-pub-1234567890123456', PRODUCTION_SITE_BASE_URL);

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
        const markup = renderAdsenseMarkup('ca-pub-</script><script>x', PRODUCTION_SITE_BASE_URL);
        expect(markup).not.toContain('</script><script>x');
        expect(markup).toContain('\\u003c/script');
    });

    it('combines GA4 and AdSense when both ids are configured', () => {
        const markup = renderAnalyticsHeadMarkup({
            googleAnalyticsId: 'G-ABC123XYZ',
            adsenseClientId: 'ca-pub-1234567890123456'
        }, PRODUCTION_SITE_BASE_URL);

        expect(markup).toContain('googletagmanager.com');
        expect(markup).toContain('googlesyndication.com');
    });

    it('renders only the configured channel for partial configuration', () => {
        const gaOnly = renderAnalyticsHeadMarkup({ googleAnalyticsId: 'G-ABC123XYZ', adsenseClientId: null }, PRODUCTION_SITE_BASE_URL);
        expect(gaOnly).toContain('googletagmanager.com');
        expect(gaOnly).not.toContain('googlesyndication.com');

        const adsOnly = renderAnalyticsHeadMarkup({ googleAnalyticsId: null, adsenseClientId: 'ca-pub-1234567890123456' }, PRODUCTION_SITE_BASE_URL);
        expect(adsOnly).toContain('googlesyndication.com');
        expect(adsOnly).not.toContain('googletagmanager.com');
    });

    it('returns an empty string when nothing is configured', () => {
        expect(renderAnalyticsHeadMarkup({ googleAnalyticsId: null, adsenseClientId: null })).toBe('');
        expect(renderAnalyticsHeadMarkup()).toBe('');
    });

    it('escapes ids defensively when building markup', () => {
        const markup = renderGoogleAnalyticsMarkup('G-A"B', PRODUCTION_SITE_BASE_URL);
        expect(markup).toContain('id=G-A&quot;B');
    });
});

describe('analytics resource hints', () => {
    it('preconnects to the ad origins when AdSense is configured', () => {
        const hints = renderAnalyticsResourceHints({ googleAnalyticsId: null, adsenseClientId: 'ca-pub-1234567890123456' }, PRODUCTION_SITE_BASE_URL);
        expect(hints).toContain('rel="preconnect" href="https://pagead2.googlesyndication.com" crossorigin');
        expect(hints).toContain('rel="preconnect" href="https://googleads.g.doubleclick.net" crossorigin');
        expect(hints).not.toContain('googletagmanager.com');
    });

    it('preconnects to the GA origin when analytics is configured', () => {
        const hints = renderAnalyticsResourceHints({ googleAnalyticsId: 'G-ABC123XYZ', adsenseClientId: null }, PRODUCTION_SITE_BASE_URL);
        expect(hints).toContain('rel="preconnect" href="https://www.googletagmanager.com"');
        expect(hints).not.toContain('googlesyndication.com');
    });

    it('returns an empty string when nothing is configured', () => {
        expect(renderAnalyticsResourceHints({ googleAnalyticsId: null, adsenseClientId: null })).toBe('');
        expect(renderAnalyticsResourceHints()).toBe('');
    });
});

describe('consent mode regions', () => {
    it('denies only the EEA, the UK, and Switzerland', () => {
        expect(new Set(CONSENT_DENIED_REGIONS).size).toBe(CONSENT_DENIED_REGIONS.length);
        expect([...CONSENT_DENIED_REGIONS].sort()).toEqual([
            'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR',
            'GB', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MT',
            'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
        ]);
        expect(CONSENT_DENIED_REGIONS).not.toContain('UK');
        expect(CONSENT_DENIED_REGIONS).not.toContain('US');
        expect(REGULATED_TIME_ZONES).toContain('Europe/London');
        expect(REGULATED_TIME_ZONES).toContain('Europe/Zurich');
        expect(REGULATED_TIME_ZONES).not.toContain('America/New_York');
        expect(REGULATED_TIME_ZONES).not.toContain('UTC');
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
            { filename: 'ga.html', source: renderGoogleAnalyticsMarkup('G-ABC123XYZ', PRODUCTION_SITE_BASE_URL) },
            { filename: 'ads.html', source: renderAdsenseMarkup('ca-pub-1234567890123456', PRODUCTION_SITE_BASE_URL) },
            {
                filename: 'hints.html',
                source: renderAnalyticsResourceHints({ googleAnalyticsId: 'G-ABC123XYZ', adsenseClientId: 'ca-pub-1234567890123456' }, PRODUCTION_SITE_BASE_URL)
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

describe('analytics host gate', () => {
    const gaMarkup = renderGoogleAnalyticsMarkup('G-ABC123XYZ', PRODUCTION_SITE_BASE_URL);
    const adsMarkup = renderAdsenseMarkup('ca-pub-1234567890123456', PRODUCTION_SITE_BASE_URL);
    const hintMarkup = renderAnalyticsResourceHints({
        googleAnalyticsId: 'G-ABC123XYZ',
        adsenseClientId: 'ca-pub-1234567890123456'
    }, PRODUCTION_SITE_BASE_URL);

    it('rejects a siteBaseUrl that cannot supply a hostname', () => {
        expect(() => renderGoogleAnalyticsMarkup('G-ABC123XYZ', undefined))
            .toThrow('Analytics markup requires siteBaseUrl so the allowed host is derived from root config');
        expect(() => renderAdsenseMarkup('ca-pub-1234567890123456', '   '))
            .toThrow('Analytics markup requires siteBaseUrl so the allowed host is derived from root config');
        expect(() => renderAnalyticsHeadMarkup({
            googleAnalyticsId: 'G-ABC123XYZ',
            adsenseClientId: null
        }, 'not a url')).toThrow('Analytics siteBaseUrl must be a valid absolute URL: not a url');
        expect(() => renderAnalyticsResourceHints({
            googleAnalyticsId: 'G-ABC123XYZ',
            adsenseClientId: null
        }, 'file:///tmp/page')).toThrow('Analytics siteBaseUrl must include a hostname: file:///tmp/page');
    });

    it('derives the allowed host from siteBaseUrl instead of a hard-coded string', () => {
        const source = fs.readFileSync(require.resolve('./analytics.js'), 'utf8');
        expect(source).not.toContain('tools.codesamplez.com');

        expect(gaMarkup).toContain('location.hostname!=="tools.codesamplez.com"');

        const previewMarkup = renderGoogleAnalyticsMarkup('G-ABC123XYZ', 'https://preview.example:8443/tools/');
        expect(previewMarkup).toContain('location.hostname!=="preview.example"');
        expect(previewMarkup).not.toContain('tools.codesamplez.com');

        const previewAllowed = executeInlineScripts(previewMarkup, 'preview.example');
        expect(previewAllowed.appended.map((node) => node.src)).toEqual([
            'https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ'
        ]);
        const previewBlocked = executeInlineScripts(previewMarkup, 'tools.codesamplez.com');
        expect(previewBlocked.appended).toEqual([]);
        expect(previewBlocked.context.gtag).toBeUndefined();
    });

    it('loads and configures gtag on the production host', () => {
        expect(gaMarkup).not.toMatch(/<script[^>]*\ssrc=/);

        const result = executeInlineScripts(gaMarkup, 'tools.codesamplez.com');

        expect(result.appended).toEqual([
            expect.objectContaining({
                async: true,
                src: 'https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ'
            })
        ]);
        expect(typeof result.context.gtag).toBe('function');
        expect(result.context.dataLayer[0][0]).toBe('consent');
        expect(result.context.dataLayer[0][1]).toBe('default');
        expect(result.context.dataLayer[0][2]).toEqual({
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            region: [...CONSENT_DENIED_REGIONS],
            wait_for_update: CONSENT_MODE_WAIT_FOR_UPDATE_MS
        });
        expect(result.context.dataLayer[1][0]).toBe('js');
        expect(result.context.dataLayer[1][1].getTime()).toEqual(expect.any(Number));
        expect(result.context.dataLayer[2][0]).toBe('config');
        expect(result.context.dataLayer[2][1]).toBe('G-ABC123XYZ');
    });

    it.each(BLOCKED_HOSTS)('does not request gtag.js on %s', (hostname) => {
        const result = executeInlineScripts(gaMarkup, hostname);

        expect(result.appended).toEqual([]);
        expect(result.context.gtag).toBeUndefined();
        expect(result.context.dataLayer).toBeUndefined();
    });

    it('requests the AdSense loader on the production host after the idle fallback', () => {
        const result = executeInlineScripts(adsMarkup, 'tools.codesamplez.com');

        expect(result.appended).toEqual([]);
        expect(result.listeners.map((listener) => listener.type)).toEqual([
            'scroll', 'mousemove', 'keydown', 'touchstart', 'pointerdown'
        ]);
        expect(result.timeouts).toHaveLength(1);
        expect(result.timeouts[0].delay).toBe(3500);

        result.timeouts[0].fn();

        expect(result.appended).toEqual([
            expect.objectContaining({
                async: true,
                crossOrigin: 'anonymous',
                src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456'
            })
        ]);
    });

    it.each(['Europe/Berlin', 'Europe/London', 'Europe/Zurich', 'Atlantic/Reykjavik'])(
        'loads the AdSense script immediately for %s',
        (timeZone) => {
            const result = executeInlineScripts(adsMarkup, 'tools.codesamplez.com', { timeZone });

            expect(result.context.dataLayer[0][0]).toBe('consent');
            expect(result.context.dataLayer[0][1]).toBe('default');
            expect(result.appended).toEqual([
                expect.objectContaining({
                    async: true,
                    crossOrigin: 'anonymous',
                    src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456'
                })
            ]);
            expect(result.listeners).toEqual([]);
            expect(result.timeouts).toEqual([]);
        }
    );

    it.each(['America/New_York', 'UTC', 'Europe/Istanbul'])(
        'keeps the lazy AdSense loader for %s',
        (timeZone) => {
            const result = executeInlineScripts(adsMarkup, 'tools.codesamplez.com', { timeZone });

            expect(result.appended).toEqual([]);
            expect(result.listeners.map((listener) => listener.type)).toEqual([
                'scroll', 'mousemove', 'keydown', 'touchstart', 'pointerdown'
            ]);
            expect(result.timeouts).toEqual([{ fn: expect.any(Function), delay: 3500 }]);
        }
    );

    it.each(BLOCKED_HOSTS)('does not request adsbygoogle.js on %s even in a regulated time zone', (hostname) => {
        const result = executeInlineScripts(adsMarkup, hostname, { timeZone: 'Europe/Berlin' });

        expect(result.appended).toEqual([]);
        expect(result.listeners).toEqual([]);
        expect(result.timeouts).toEqual([]);
        expect(result.context.gtag).toBeUndefined();
        expect(result.context.dataLayer).toBeUndefined();
    });

    it.each(BLOCKED_HOSTS)('does not request adsbygoogle.js on %s', (hostname) => {
        const result = executeInlineScripts(adsMarkup, hostname);

        expect(result.appended).toEqual([]);
        expect(result.listeners).toEqual([]);
        expect(result.timeouts).toEqual([]);
    });

    it('inserts preconnect hints only on the production host', () => {
        const allowed = executeInlineScripts(hintMarkup, 'tools.codesamplez.com');
        expect(allowed.insertedHtml.join('\n')).toContain('rel="preconnect" href="https://www.googletagmanager.com"');
        expect(allowed.insertedHtml.join('\n')).toContain('rel="preconnect" href="https://pagead2.googlesyndication.com"');

        BLOCKED_HOSTS.forEach((hostname) => {
            const blocked = executeInlineScripts(hintMarkup, hostname);
            expect(blocked.insertedHtml).toEqual([]);
        });
    });
});
