import { ROOT_PAGE_METADATA } from './app-shell/toolCatalog';

export const SITE_BASE_URL = ROOT_PAGE_METADATA.absoluteUrl;
export const SITE_STATIC_ROOT_URI = ROOT_PAGE_METADATA.staticRootUri;

// The parent CodeSamplez site (articles/tutorials). The tools subdomain links
// back to it for discoverability and to consolidate the brand.
export const MAIN_SITE_URL = 'https://codesamplez.com';

export function buildSiteHref(publicPath: string): string {
    return new URL(publicPath.replace(/^\/+/, ''), SITE_BASE_URL).toString();
}

export function buildSiteAssetUri(pathName: string): string {
    return new URL(pathName.replace(/^\.\/+/, '').replace(/^\/+/, ''), SITE_STATIC_ROOT_URI).toString();
}
