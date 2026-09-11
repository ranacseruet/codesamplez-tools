import { jest } from '@jest/globals';
import { createDiffRunner } from './diff-runner';
import type { DiffComputeRequest } from './diff';

class FakeWorker {
    static lastUrl: string | URL | null = null;
    onmessage: ((event: { data: any }) => void) | null = null;
    onerror: ((error: any) => void) | null = null;

    constructor(url: string | URL) {
        FakeWorker.lastUrl = url;
    }

    postMessage(message: { id: number; request: DiffComputeRequest }) {
        queueMicrotask(() => {
            this.onmessage?.({ data: { id: message.id, result: [['added', 'baz']] } });
        });
    }

    terminate() {}
}

const REQUEST: DiffComputeRequest = {
    originalLines: ['foo'],
    modifiedLines: ['baz'],
    ignoreWhitespace: true
};

describe('createDiffRunner', () => {
    afterEach(() => {
        delete (globalThis as any).Worker;
    });

    it('constructs a worker pointing at the diff worker chunk and resolves results', async () => {
        (globalThis as any).Worker = FakeWorker;

        const runner = createDiffRunner();
        const result = await runner.run(REQUEST);

        expect(String(FakeWorker.lastUrl)).toContain('diff.worker');
        expect(result).toEqual([['added', 'baz']]);
        runner.terminate();
    });

    it('falls back to computeDiff when no Worker is available', async () => {
        const runner = createDiffRunner();
        const result = await runner.run({
            originalLines: ['foo', 'bar'],
            modifiedLines: ['foo', 'baz'],
            ignoreWhitespace: true
        });

        // Real `computeDiff` fallback (jsdom has no Worker): the first line is
        // unchanged, the second is a removal/addition pair.
        expect(result).toContainEqual(['unchanged', 'foo']);
        expect(result.some(([type]) => type === 'added' || type === 'removed')).toBe(true);
    });
});
