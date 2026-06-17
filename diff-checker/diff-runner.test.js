import { jest } from '@jest/globals';
import { createDiffRunner } from './diff-runner';

// Minimal fake so `new Worker(new URL('./diff.worker.ts', import.meta.url))`
// executes (jsdom provides no Worker). Captures the URL it was constructed with
// and echoes a canned result.
class FakeWorker {
    constructor(url) {
        FakeWorker.lastUrl = url;
        this.onmessage = null;
        this.onerror = null;
    }

    postMessage(message) {
        queueMicrotask(() => {
            this.onmessage?.({ data: { id: message.id, result: [['added', 'baz']] } });
        });
    }

    terminate() {}
}

const REQUEST = {
    originalLines: ['foo'],
    modifiedLines: ['baz'],
    ignoreWhitespace: true
};

describe('createDiffRunner', () => {
    afterEach(() => {
        delete globalThis.Worker;
    });

    it('constructs a worker pointing at the diff worker chunk and resolves results', async () => {
        globalThis.Worker = FakeWorker;

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
