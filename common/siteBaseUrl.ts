import { ROOT_PAGE_METADATA } from './app-shell/toolCatalog';

export const SITE_BASE_URL = ROOT_PAGE_METADATA.absoluteUrl;

export function buildSiteHref(publicPath: string): string {
    return new URL(publicPath.replace(/^\/+/, ''), SITE_BASE_URL).toString();
}
