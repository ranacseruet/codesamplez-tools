/**
 * Recently used tools (UI v4 Phase D3).
 *
 * Tool pages record a visit; the landing page renders the result as a shortcut
 * row. The stored value is a list of catalog ids only — never titles, URLs, or
 * anything the user typed — so it stays consistent with the no-transmission
 * model: it lives in this browser's localStorage and is never sent anywhere.
 *
 * Stored payloads are treated as untrusted (a user can edit them, and an older
 * build may have written a different shape): anything that does not parse as
 * the expected structure resolves the WHOLE list to empty rather than being
 * coerced entry by entry, matching the share-payload contract in
 * `common/share-url.ts`.
 */

export const RECENT_TOOLS_STORAGE_KEY = 'cst-recent-tools';

/** How many visits are retained. The landing row shows fewer (see MAX_RECENT_TOOLS_SHOWN). */
export const MAX_RECENT_TOOLS_STORED = 8;

/** How many entries the landing row renders. */
export const MAX_RECENT_TOOLS_SHOWN = 4;

export interface RecentToolVisit {
    /** Catalog tool id, e.g. `json-formatter-tool`. */
    id: string;
    /** Epoch milliseconds of the most recent visit. */
    at: number;
}

function isRecentToolVisit(value: unknown): value is RecentToolVisit {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<RecentToolVisit>;
    return (
        typeof candidate.id === 'string' &&
        candidate.id.length > 0 &&
        typeof candidate.at === 'number' &&
        Number.isFinite(candidate.at)
    );
}

function readStorage(): string | null {
    try {
        return window.localStorage.getItem(RECENT_TOOLS_STORAGE_KEY);
    } catch {
        // Private mode / blocked storage: recent tools are a convenience, so a
        // failure here degrades to "no history" rather than surfacing an error.
        return null;
    }
}

function writeStorage(visits: RecentToolVisit[]): void {
    try {
        window.localStorage.setItem(RECENT_TOOLS_STORAGE_KEY, JSON.stringify(visits));
    } catch {
        // Ignore storage failures (private mode / quota).
    }
}

/**
 * The stored visits, newest first. Returns an empty list for missing, malformed,
 * or partially malformed payloads.
 */
export function readRecentToolVisits(): RecentToolVisit[] {
    const rawValue = readStorage();
    if (!rawValue) {
        return [];
    }

    let parsedValue: unknown;
    try {
        parsedValue = JSON.parse(rawValue);
    } catch {
        return [];
    }

    if (!Array.isArray(parsedValue) || !parsedValue.every(isRecentToolVisit)) {
        return [];
    }

    return (parsedValue as RecentToolVisit[]).slice(0, MAX_RECENT_TOOLS_STORED);
}

/**
 * Records a visit to `toolId`, moving it to the front and keeping the list
 * capped. A repeat visit re-orders rather than duplicating.
 */
export function recordToolVisit(toolId: string, at: number = Date.now()): void {
    if (!toolId) {
        return;
    }

    const previousVisits = readRecentToolVisits().filter((visit) => visit.id !== toolId);
    writeStorage([{ id: toolId, at }, ...previousVisits].slice(0, MAX_RECENT_TOOLS_STORED));
}

/** Forgets every recorded visit (the landing row's Clear control). */
export function clearRecentToolVisits(): void {
    try {
        window.localStorage.removeItem(RECENT_TOOLS_STORAGE_KEY);
    } catch {
        // Ignore storage failures (private mode / blocked storage).
    }
}
