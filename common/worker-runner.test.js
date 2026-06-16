import { jest } from '@jest/globals';
import { createWorkerRunner } from './worker-runner';

/**
 * Configurable fake Worker. `mode` controls how it responds to postMessage:
 *  - 'echo'     : replies { id, result: handler(payload) }
 *  - 'never'    : never replies (exercises the timeout path)
 *  - 'error'        : fires onerror asynchronously (load/runtime failure)
 *  - 'errorResponse': replies { id, error } (worker caught a runtime error)
 *  - 'unknownId'    : replies with an id that was never requested, then echoes
 *  - 'throw'        : throws synchronously from postMessage
 */
class FakeWorker {
    constructor(mode, handler) {
        this.mode = mode;
        this.handler = handler;
        this.onmessage = null;
        this.onerror = null;
        this.onmessageerror = null;
        this.terminated = false;
        FakeWorker.instances.push(this);
    }

    postMessage(message) {
        if (this.mode === 'throw') {
            throw new Error('postMessage failed');
        }
        if (this.mode === 'never') {
            return;
        }
        if (this.mode === 'error') {
            queueMicrotask(() => this.onerror?.(new Event('error')));
            return;
        }
        if (this.mode === 'errorResponse') {
            queueMicrotask(() => this.onmessage?.({ data: { id: message.id, error: 'boom in worker' } }));
            return;
        }
        if (this.mode === 'unknownId') {
            queueMicrotask(() => {
                // A stale/unknown response must be ignored, then the real one resolves.
                this.onmessage?.({ data: { id: -999, result: 'ignored' } });
                this.onmessage?.({ data: { id: message.id, result: this.handler(message.payload) } });
            });
            return;
        }
        queueMicrotask(() => {
            this.onmessage?.({ data: { id: message.id, result: this.handler(message.payload) } });
        });
    }

    terminate() {
        this.terminated = true;
    }
}
FakeWorker.instances = [];

const installFakeWorker = () => {
    globalThis.Worker = FakeWorker;
};

const removeWorker = () => {
    delete globalThis.Worker;
};

const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('createWorkerRunner', () => {
    beforeEach(() => {
        FakeWorker.instances.length = 0;
        removeWorker();
        jest.useRealTimers();
    });

    afterEach(() => {
        removeWorker();
    });

    it('falls back to the main thread when Worker is unavailable', async () => {
        const fallback = jest.fn((value) => value * 2);
        const runner = createWorkerRunner({
            createWorker: () => {
                throw new Error('should not construct');
            },
            fallback
        });

        await expect(runner.run(21)).resolves.toBe(42);
        expect(fallback).toHaveBeenCalledWith(21);
        expect(runner.isFallbackOnly).toBe(true);
    });

    it('runs in the worker on the happy path and correlates by id', async () => {
        installFakeWorker();
        const fallback = jest.fn();
        const runner = createWorkerRunner({
            createWorker: () => new FakeWorker('echo', (value) => value + 1),
            fallback
        });

        const [a, b] = await Promise.all([runner.run(1), runner.run(10)]);
        expect(a).toBe(2);
        expect(b).toBe(11);
        expect(fallback).not.toHaveBeenCalled();
        expect(FakeWorker.instances).toHaveLength(1); // worker reused across calls
    });

    it('falls back for in-flight and future calls when the worker errors', async () => {
        installFakeWorker();
        const fallback = jest.fn((value) => `fallback:${value}`);
        const runner = createWorkerRunner({
            createWorker: () => new FakeWorker('error'),
            fallback
        });

        await expect(runner.run('x')).resolves.toBe('fallback:x');
        expect(runner.isFallbackOnly).toBe(true);

        // Subsequent calls also use the fallback without reconstructing a worker.
        await expect(runner.run('y')).resolves.toBe('fallback:y');
        expect(FakeWorker.instances).toHaveLength(1);
    });

    it('rejects when the worker replies with an error response', async () => {
        installFakeWorker();
        const fallback = jest.fn();
        const runner = createWorkerRunner({
            createWorker: () => new FakeWorker('errorResponse'),
            fallback
        });

        await expect(runner.run('q')).rejects.toThrow('boom in worker');
        // An in-band error is a per-request result, not a broken worker.
        expect(fallback).not.toHaveBeenCalled();
        expect(runner.isFallbackOnly).toBe(false);
    });

    it('ignores responses for unknown ids and resolves the real one', async () => {
        installFakeWorker();
        const runner = createWorkerRunner({
            createWorker: () => new FakeWorker('unknownId', (value) => `ok:${value}`),
            fallback: jest.fn()
        });

        await expect(runner.run('m')).resolves.toBe('ok:m');
    });

    it('falls back when createWorker throws even though Worker exists', async () => {
        installFakeWorker(); // Worker is defined...
        const fallback = jest.fn((value) => `caught:${value}`);
        const runner = createWorkerRunner({
            createWorker: () => {
                throw new Error('construction failed');
            },
            fallback
        });

        await expect(runner.run('c')).resolves.toBe('caught:c');
        expect(runner.isFallbackOnly).toBe(true);
    });

    it('falls back when postMessage throws', async () => {
        installFakeWorker();
        const fallback = jest.fn((value) => `fb:${value}`);
        const runner = createWorkerRunner({
            createWorker: () => new FakeWorker('throw'),
            fallback
        });

        await expect(runner.run('z')).resolves.toBe('fb:z');
        expect(fallback).toHaveBeenCalledWith('z');
    });

    it('falls back when the worker exceeds the timeout', async () => {
        jest.useFakeTimers();
        installFakeWorker();
        const fallback = jest.fn((value) => `late:${value}`);
        const runner = createWorkerRunner({
            createWorker: () => new FakeWorker('never'),
            fallback,
            timeoutMs: 50
        });

        const promise = runner.run('slow');
        await jest.advanceTimersByTimeAsync(60);
        await expect(promise).resolves.toBe('late:slow');
        expect(fallback).toHaveBeenCalledWith('slow');
    });

    it('terminate() tears down the worker and settles pending via fallback', async () => {
        installFakeWorker();
        const fallback = jest.fn((value) => `t:${value}`);
        const runner = createWorkerRunner({
            createWorker: () => new FakeWorker('never'),
            fallback
        });

        const promise = runner.run('pending');
        runner.terminate();
        await expect(promise).resolves.toBe('t:pending');
        expect(FakeWorker.instances[0].terminated).toBe(true);
        expect(runner.isFallbackOnly).toBe(true);
        await flush();
    });
});
