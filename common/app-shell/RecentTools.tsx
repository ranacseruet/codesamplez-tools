/**
 * Landing-page "Recently used" row (UI v4 Phase D3).
 *
 * Reads the visit list recorded by `mountToolShell` on tool pages and renders
 * it as a shortcut row under the hero search. Only ids are stored, so titles and
 * links are resolved from the build-time injected catalog here: a renamed or
 * retired tool cannot leave a stale label (or a dead link) behind — its id
 * simply stops resolving and drops out of the row.
 *
 * The row is client-only by nature (it is per-visitor), so the document ships
 * an empty slot and this fills it. First-time visitors see nothing at all: the
 * slot collapses via `:empty` in styles.css, so there is no layout shift and no
 * empty-state noise on the busiest page of the site.
 */

import type { JSX } from 'preact';
import { render } from 'preact';
import { useLayoutEffect, useState } from 'preact/hooks';
import { TOOL_CATALOG_ENTRIES } from './toolCatalog';
import { buildSiteHref } from '../siteBaseUrl';
import {
    MAX_RECENT_TOOLS_SHOWN,
    clearRecentToolVisits,
    readRecentToolVisits
} from '../recent-tools';

// Keep in sync with GROUP_CATEGORY_SLUGS in ToolSearch.tsx and
// scripts/root-document.js (the shared v4 category accent slugs).
const GROUP_CATEGORY_SLUGS: Record<string, string> = {
    'code-formatters': 'formatters',
    'encoders-decoders': 'encoders',
    'text-analysis': 'text',
    'image-tools': 'media'
};

export interface RecentToolLink {
    id: string;
    title: string;
    href: string;
    categorySlug: string;
}

/**
 * Resolves stored visits to catalog entries, newest first, dropping ids the
 * catalog no longer knows about.
 */
export function resolveRecentToolLinks(limit: number = MAX_RECENT_TOOLS_SHOWN): RecentToolLink[] {
    const links: RecentToolLink[] = [];

    readRecentToolVisits().forEach((visit) => {
        if (links.length >= limit) {
            return;
        }

        const entry = TOOL_CATALOG_ENTRIES.find((candidate) => candidate.id === visit.id);
        if (!entry) {
            return;
        }

        links.push({
            id: entry.id,
            title: entry.title,
            href: buildSiteHref(entry.publicPath),
            categorySlug: GROUP_CATEGORY_SLUGS[entry.catalogGroupId] ?? 'formatters'
        });
    });

    return links;
}

export function RecentTools(): JSX.Element | null {
    // Read at mount: the list otherwise only changes on another page (a tool
    // visit) or via Clear below, which updates this state directly.
    const [links, setLinks] = useState<RecentToolLink[]>(() => resolveRecentToolLinks());

    // Except on a Back navigation: browsers can restore this document from the
    // back/forward cache without re-running DOMContentLoaded, so the row would
    // still show the list as it was *before* the tool the user just came back
    // from. `pageshow` is the one event that fires on a bfcache restore.
    // useLayoutEffect (not useEffect) so the listener attaches synchronously at
    // mount, matching the rest of the shell.
    useLayoutEffect(() => {
        const onPageShow = (event: PageTransitionEvent) => {
            if (!event.persisted) {
                return;
            }
            setLinks(resolveRecentToolLinks());
        };

        window.addEventListener('pageshow', onPageShow);
        return () => window.removeEventListener('pageshow', onPageShow);
    }, []);

    if (links.length === 0) {
        return null;
    }

    const onClear = () => {
        clearRecentToolVisits();
        setLinks([]);
    };

    return (
        <section className="recent-tools" aria-labelledby="recent-tools-label">
            <h2 className="recent-tools__label" id="recent-tools-label">
                Recently used
            </h2>
            <ul className="recent-tools__list">
                {links.map((link) => (
                    <li key={link.id}>
                        <a
                            className={`recent-tools__item recent-tools__item--${link.categorySlug}`}
                            href={link.href}
                            data-tool-id={link.id}
                        >
                            {link.title}
                        </a>
                    </li>
                ))}
            </ul>
            <button type="button" className="recent-tools__clear" onClick={onClear}>
                Clear
            </button>
        </section>
    );
}

// No `typeof document` guard: this only runs from the landing entry bundle
// inside DOMContentLoaded, and nothing server-side imports it.
export function mountRecentTools(rootId = 'recent-tools-root'): void {
    const root = document.getElementById(rootId);
    if (!root) {
        return;
    }

    render(<RecentTools />, root);
}
