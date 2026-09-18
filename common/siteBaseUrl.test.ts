import { getRootPageDefinition } from '../scripts/tool-manifest';
import { SITE_BASE_URL, SITE_STATIC_ROOT_URI, buildSiteAssetUri, buildSiteHref } from './siteBaseUrl';

describe('site base url helpers', () => {
    it('exposes separate page and asset roots from the injected catalog metadata', () => {
        const rootPageDefinition = getRootPageDefinition();

        expect(SITE_BASE_URL).toBe(rootPageDefinition.absoluteUrl);
        expect(SITE_STATIC_ROOT_URI).toBe(rootPageDefinition.staticRootUri);
    });

    it('builds absolute asset urls from the static root without dropping nested paths', () => {
        expect(buildSiteHref('/json-formatter/')).toBe(new URL('json-formatter/', SITE_BASE_URL).toString());
        expect(buildSiteAssetUri('/diff-checker/images/diff-result-view-example.webp'))
            .toBe(new URL('diff-checker/images/diff-result-view-example.webp', SITE_STATIC_ROOT_URI).toString());
        expect(buildSiteAssetUri('./root-shell/styles.main.css'))
            .toBe(new URL('root-shell/styles.main.css', SITE_STATIC_ROOT_URI).toString());
    });
});
