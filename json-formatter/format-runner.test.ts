import { jest } from '@jest/globals';
import { createFormatRunner } from './format-runner';

// Minimal fake so `new Worker(new URL('./format.worker.ts', import.meta.url))`
// executes (jsdom provides no Worker). Captures the URL and echoes a result.
class FakeWorker {
    static lastUrl: URL | string | undefined;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;

    constructor(url: URL | string) {
        FakeWorker.lastUrl = url;
    }

    postMessage(message: { id: number; payload: unknown }) {
        queueMicrotask(() => {
            this.onmessage?.({
                data: { id: message.id, result: { formatted: { a: 1 }, formattedString: '{\n  "a": 1\n}' } }
            });
        });
    }

    terminate() {}
}

describe('createFormatRunner', () => {
    afterEach(() => {
        delete (globalThis as { Worker?: unknown }).Worker;
    });

    it('constructs a worker pointing at the format worker chunk and resolves results', async () => {
        (globalThis as unknown as { Worker: typeof FakeWorker }).Worker = FakeWorker;

        const runner = createFormatRunner();
        const result = await runner.run({ input: '{"a":1}', autoFix: false, sortKeys: true });

        expect(String(FakeWorker.lastUrl)).toContain('format.worker');
        expect(result).toEqual({ formatted: { a: 1 }, formattedString: '{\n  "a": 1\n}' });
        runner.terminate();
    });

    it('falls back to formatJson when no Worker is available', async () => {
        const runner = createFormatRunner();
        const result = await runner.run({ input: '{"b":2,"a":1}', autoFix: false, sortKeys: true });

        // Real `formatJson` fallback (jsdom has no Worker).
        expect(result.formatted).toEqual({ a: 1, b: 2 });
        expect(result.formattedString).toBe('{\n  "a": 1,\n  "b": 2\n}');
    });
});
