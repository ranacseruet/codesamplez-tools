import type { JSX } from 'preact';
import { render } from 'preact';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { TOOL_CATALOG_ENTRIES, TOOL_CATALOG_GROUPS } from './toolCatalog';
import { formatModifierChord, isEditableTarget } from '../shortcut-utils';
import { buildSiteHref } from '../siteBaseUrl';

// Maps catalog group ids to the v4 category accent slug (chip/palette hues).
// Keep in sync with GROUP_CATEGORY_SLUGS in scripts/root-document.js.
const GROUP_CATEGORY_SLUGS: Record<string, string> = {
    'code-formatters': 'formatters',
    'encoders-decoders': 'encoders',
    'text-analysis': 'text'
};

const MAX_PALETTE_ITEMS = 8;

interface ToolSearchEntry {
    id: string;
    title: string;
    description: string;
    href: string;
    groupId: string;
    groupLabel: string;
    categorySlug: string;
}

const TOOL_SEARCH_ENTRIES: ToolSearchEntry[] = TOOL_CATALOG_ENTRIES.map((entry) => ({
    id: entry.id,
    title: entry.title,
    description: entry.description,
    href: buildSiteHref(entry.publicPath),
    groupId: entry.catalogGroupId,
    groupLabel: TOOL_CATALOG_GROUPS.find((group) => group.id === entry.catalogGroupId)?.label ?? '',
    categorySlug: GROUP_CATEGORY_SLUGS[entry.catalogGroupId] ?? 'formatters'
}));

function matchesQueryTokens(tool: ToolSearchEntry, queryTokens: string[]): boolean {
    if (queryTokens.length === 0) {
        return true;
    }

    const haystack = `${tool.title} ${tool.description} ${tool.groupLabel}`.toLowerCase();
    return queryTokens.every((token) => haystack.includes(token));
}

// Title matches outrank description/group-label matches; ties keep catalog
// order (Array.prototype.sort is stable).
function rankTools(tools: ToolSearchEntry[], queryTokens: string[]): ToolSearchEntry[] {
    if (queryTokens.length === 0) {
        return tools;
    }

    return tools
        .map((tool) => ({
            tool,
            isTitleMatch: queryTokens.every((token) => tool.title.toLowerCase().includes(token))
        }))
        .sort((left, right) => Number(right.isTitleMatch) - Number(left.isTitleMatch))
        .map(({ tool }) => tool);
}

function SearchIcon(): JSX.Element {
    return (
        <svg
            className="tool-search__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    );
}

/**
 * Landing-page tool finder: a search box with a command palette (⌘K or / to
 * focus, ↑↓ to navigate, ↵ to open) plus category filter chips. Filtering
 * also hides/shows the SSR'd tool cards directly, so the grid and the palette
 * never disagree. Data comes from the build-time injected shell catalog —
 * zero extra payload.
 */
export function ToolSearch(): JSX.Element {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const paletteRef = useRef<HTMLDivElement>(null);

    const queryTokens = useMemo(
        () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
        [query]
    );
    const filteredTools = useMemo(
        () => rankTools(
            TOOL_SEARCH_ENTRIES.filter((tool) =>
                (!category || tool.groupId === category) && matchesQueryTokens(tool, queryTokens)
            ),
            queryTokens
        ),
        [category, queryTokens]
    );
    const paletteItems = filteredTools.slice(0, MAX_PALETTE_ITEMS);
    const isFiltering = queryTokens.length > 0 || category !== null;
    // Shared with the `?` help overlay so the advertised chord matches exactly.
    const shortcutLabel = formatModifierChord('K');

    // Filter the SSR'd grid in lockstep with the palette. When nothing is
    // being filtered, every card and group is visible again.
    useLayoutEffect(() => {
        const visibleIds = new Set(filteredTools.map((tool) => tool.id));
        document.querySelectorAll<HTMLElement>('.tool-card[data-tool-id]').forEach((card) => {
            const shouldHide = isFiltering && !visibleIds.has(card.dataset.toolId ?? '');
            card.classList.toggle('tool-card--hidden', shouldHide);
        });
        document.querySelectorAll<HTMLElement>('.tool-group[data-tool-group]').forEach((group) => {
            const hasVisibleCard = group.querySelector('.tool-card:not(.tool-card--hidden)') !== null;
            group.classList.toggle('tool-group--hidden', !hasVisibleCard);
        });
    }, [filteredTools, isFiltering]);

    // Global shortcuts: `/` (outside editable fields) and ⌘K / Ctrl+K focus the
    // search. Mounted once for the page lifetime.
    useLayoutEffect(() => {
        const onGlobalKeydown = (event: KeyboardEvent) => {
            const isFocusShortcut = (event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey);
            const isSlashShortcut = event.key === '/' && !isEditableTarget(event.target);
            if (!isFocusShortcut && !isSlashShortcut) {
                return;
            }

            event.preventDefault();
            inputRef.current?.focus();
            inputRef.current?.select();
            setIsOpen(true);
        };

        document.addEventListener('keydown', onGlobalKeydown);
        return () => document.removeEventListener('keydown', onGlobalKeydown);
    }, []);

    // Close the palette on outside click/tap.
    useLayoutEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const onDocumentClick = (event: MouseEvent) => {
            const root = inputRef.current?.closest('.tool-search');
            if (root && event.target instanceof Node && !root.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('click', onDocumentClick);
        return () => document.removeEventListener('click', onDocumentClick);
    }, [isOpen]);

    const onQueryInput = (event: JSX.TargetedEvent<HTMLInputElement>) => {
        setQuery(event.currentTarget.value);
        setIsOpen(true);
        setActiveIndex(0);
    };

    const onInputKeydown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((index) => Math.min(index + 1, paletteItems.length - 1));
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
            return;
        }

        if (event.key === 'Enter') {
            // Activate the highlighted option's real anchor so navigation (and
            // testability) goes through the same path as a click.
            if (isOpen && paletteItems.length > 0) {
                event.preventDefault();
                const anchors = paletteRef.current?.querySelectorAll<HTMLAnchorElement>('.tool-search__item');
                anchors?.[Math.min(activeIndex, paletteItems.length - 1)]?.click();
            }
            return;
        }

        if (event.key === 'Escape') {
            if (isOpen) {
                event.preventDefault();
                setIsOpen(false);
            } else if (query) {
                setQuery('');
            }
        }
    };

    const onChipClick = (groupId: string | null) => (event: MouseEvent) => {
        event.preventDefault();
        setCategory((current) => (current === groupId ? null : groupId));
        setActiveIndex(0);
    };

    // Chips are anchors with role="button" (no-JS fallback = section anchor);
    // button role expects Space to activate, so handle it explicitly.
    const onChipKeydown = (groupId: string | null) => (event: KeyboardEvent) => {
        if (event.key === ' ') {
            event.preventDefault();
            setCategory((current) => (current === groupId ? null : groupId));
            setActiveIndex(0);
        }
    };

    return (
        <>
            <div className="tool-search__box">
                <SearchIcon />
                <input
                    ref={inputRef}
                    className="tool-search__input"
                    type="search"
                    placeholder="Search tools…"
                    aria-label="Search tools"
                    autocomplete="off"
                    spellcheck={false}
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-controls="tool-search-palette"
                    aria-activedescendant={isOpen && paletteItems.length > 0 ? `tool-search-option-${activeIndex}` : undefined}
                    value={query}
                    onInput={onQueryInput}
                    onKeyDown={onInputKeydown}
                    onFocus={() => setIsOpen(true)}
                />
                <kbd className="tool-search__kbd" aria-hidden="true">{shortcutLabel}</kbd>
            </div>
            <div className="tool-search__chips">
                <a
                    className="tool-search__chip tool-search__chip--all"
                    role="button"
                    href="#tools"
                    aria-pressed={category === null}
                    onClick={onChipClick(null)}
                    onKeyDown={onChipKeydown(null)}
                >
                    All tools
                </a>
                {TOOL_CATALOG_GROUPS.map((group) => {
                    const slug = GROUP_CATEGORY_SLUGS[group.id] ?? 'formatters';
                    return (
                        <a
                            key={group.id}
                            className={`tool-search__chip tool-search__chip--${slug}`}
                            role="button"
                            href={`#group-${group.id}`}
                            aria-pressed={category === group.id}
                            onClick={onChipClick(group.id)}
                            onKeyDown={onChipKeydown(group.id)}
                        >
                            {group.label}
                        </a>
                    );
                })}
            </div>
            {isOpen ? (
                <div
                    className="tool-search__palette"
                    id="tool-search-palette"
                    role="listbox"
                    aria-label="Matching tools"
                    ref={paletteRef}
                >
                    {paletteItems.length === 0 ? (
                        <p className="tool-search__empty">No tools match “{query}”.</p>
                    ) : (
                        <ul className="tool-search__list">
                            {paletteItems.map((tool, index) => (
                                <li
                                    key={tool.id}
                                    role="option"
                                    id={`tool-search-option-${index}`}
                                    aria-selected={index === activeIndex}
                                >
                                    <a
                                        href={tool.href}
                                        className={`tool-search__item${index === activeIndex ? ' tool-search__item--active' : ''}`}
                                        onMouseEnter={() => setActiveIndex(index)}
                                    >
                                        <span className={`tool-search__item-icon tool-search__item-icon--${tool.categorySlug}`} aria-hidden="true" />
                                        <span className="tool-search__item-text">
                                            <span className="tool-search__item-title">{tool.title}</span>
                                            <span className="tool-search__item-group">{tool.groupLabel}</span>
                                        </span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="tool-search__hints" aria-hidden="true">↑↓ navigate · ↵ open · esc close</p>
                </div>
            ) : null}
            {isFiltering ? (
                <p className="tool-search__count" aria-live="polite">
                    {filteredTools.length} of {TOOL_SEARCH_ENTRIES.length} tools
                </p>
            ) : null}
        </>
    );
}

export function mountToolSearch(rootId = 'tool-search-root'): void {
    if (typeof document === 'undefined') {
        return;
    }

    const root = document.getElementById(rootId);
    if (!root) {
        return;
    }

    render(<ToolSearch />, root);
}
