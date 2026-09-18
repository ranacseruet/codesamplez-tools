import {
    MAX_RECENT_TOOLS_STORED,
    RECENT_TOOLS_STORAGE_KEY,
    clearRecentToolVisits,
    readRecentToolVisits,
    recordToolVisit
} from './recent-tools';

function storedValue(): string | null {
    return window.localStorage.getItem(RECENT_TOOLS_STORAGE_KEY);
}

describe('recent-tools', () => {
    beforeEach(() => {
        window.localStorage.clear();
        jest.restoreAllMocks();
    });

    describe('readRecentToolVisits', () => {
        it('returns an empty list when nothing has been recorded', () => {
            expect(readRecentToolVisits()).toEqual([]);
        });

        it('returns stored visits newest first', () => {
            recordToolVisit('json-formatter-tool', 1);
            recordToolVisit('diff-checker-tool', 2);

            expect(readRecentToolVisits()).toEqual([
                { id: 'diff-checker-tool', at: 2 },
                { id: 'json-formatter-tool', at: 1 }
            ]);
        });

        it('discards a payload that is not valid JSON', () => {
            window.localStorage.setItem(RECENT_TOOLS_STORAGE_KEY, '{not json');

            expect(readRecentToolVisits()).toEqual([]);
        });

        it('discards a payload that is not an array', () => {
            window.localStorage.setItem(RECENT_TOOLS_STORAGE_KEY, '{"id":"json-formatter-tool"}');

            expect(readRecentToolVisits()).toEqual([]);
        });

        it.each([
            ['a non-object entry', '["json-formatter-tool"]'],
            ['a missing timestamp', '[{"id":"json-formatter-tool"}]'],
            ['a non-numeric timestamp', '[{"id":"json-formatter-tool","at":"today"}]'],
            ['an empty id', '[{"id":"","at":1}]'],
            ['one bad entry among good ones', '[{"id":"json-formatter-tool","at":1},{"at":2}]']
        ])('resolves the whole list to empty for %s', (_label, payload) => {
            window.localStorage.setItem(RECENT_TOOLS_STORAGE_KEY, payload);

            expect(readRecentToolVisits()).toEqual([]);
        });

        it('degrades to an empty list when storage throws', () => {
            jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('SecurityError');
            });

            expect(readRecentToolVisits()).toEqual([]);
        });
    });

    describe('recordToolVisit', () => {
        it('moves a repeat visit to the front instead of duplicating it', () => {
            recordToolVisit('json-formatter-tool', 1);
            recordToolVisit('diff-checker-tool', 2);
            recordToolVisit('json-formatter-tool', 3);

            expect(readRecentToolVisits()).toEqual([
                { id: 'json-formatter-tool', at: 3 },
                { id: 'diff-checker-tool', at: 2 }
            ]);
        });

        it('caps the stored list', () => {
            for (let index = 0; index < MAX_RECENT_TOOLS_STORED + 4; index += 1) {
                recordToolVisit(`tool-${index}`, index);
            }

            const visits = readRecentToolVisits();
            expect(visits).toHaveLength(MAX_RECENT_TOOLS_STORED);
            expect(visits[0].id).toBe(`tool-${MAX_RECENT_TOOLS_STORED + 3}`);
        });

        it('defaults the timestamp to now', () => {
            const before = Date.now();
            recordToolVisit('json-formatter-tool');

            const [visit] = readRecentToolVisits();
            expect(visit.at).toBeGreaterThanOrEqual(before);
        });

        it('ignores an empty tool id', () => {
            recordToolVisit('');

            expect(storedValue()).toBeNull();
        });

        it('does not throw when storage is blocked', () => {
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });

            expect(() => recordToolVisit('json-formatter-tool')).not.toThrow();
        });
    });

    describe('clearRecentToolVisits', () => {
        it('forgets every recorded visit', () => {
            recordToolVisit('json-formatter-tool', 1);
            clearRecentToolVisits();

            expect(storedValue()).toBeNull();
            expect(readRecentToolVisits()).toEqual([]);
        });

        it('does not throw when storage is blocked', () => {
            jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
                throw new Error('SecurityError');
            });

            expect(() => clearRecentToolVisits()).not.toThrow();
        });
    });
});
