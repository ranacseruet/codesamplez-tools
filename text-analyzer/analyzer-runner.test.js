import { jest } from '@jest/globals';
import { createAnalyzerRunner } from './analyzer-runner';

// Minimal fake so `new Worker(new URL('./text-analyzer.worker.ts', import.meta.url))`
// executes (jsdom provides no Worker). Captures the URL it was constructed with.
class FakeWorker {
    constructor(url) {
        FakeWorker.lastUrl = url;
        this.onmessage = null;
        this.onerror = null;
    }

    postMessage(message) {
        queueMicrotask(() => {
            this.onmessage?.({ data: { id: message.id, result: { wordCount: 2, charCount: 11 } } });
        });
    }

    terminate() {}
}

describe('createAnalyzerRunner', () => {
    afterEach(() => {
        delete globalThis.Worker;
    });

    it('constructs a worker pointing at the analyzer worker chunk and resolves results', async () => {
        globalThis.Worker = FakeWorker;

        const runner = createAnalyzerRunner();
        const result = await runner.run('hello world');

        expect(String(FakeWorker.lastUrl)).toContain('text-analyzer.worker');
        expect(result).toEqual({ wordCount: 2, charCount: 11 });
        runner.terminate();
    });

    it('falls back to analyzeText when no Worker is available', async () => {
        const runner = createAnalyzerRunner();
        const result = await runner.run('hello world');

        // Real `analyzeText` fallback (jsdom has no Worker).
        expect(result.wordCount).toBe(2);
        expect(result.charCount).toBe(11);
    });
});
