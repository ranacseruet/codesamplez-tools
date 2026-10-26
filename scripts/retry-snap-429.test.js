const { installSnap429Retry, isSnapVisualRequest, shouldAutoInstall } = require('./retry-snap-429');

function response(status, retryAfter) {
    return {
        status,
        headers: {
            get(name) {
                if (name === 'retry-after' && retryAfter != null) {
                    return retryAfter;
                }
                return null;
            }
        },
        body: {
            cancel() {
                this.cancelled = true;
            },
            cancelled: false
        }
    };
}

describe('isSnapVisualRequest', () => {
    it('matches hosted visual API urls and ignores everything else', () => {
        expect(isSnapVisualRequest('https://snap.example/v1/visual/captures/cap/local-result')).toBe(true);
        expect(isSnapVisualRequest(new URL('https://snap.example/v1/visual/projects/p/runs'))).toBe(true);
        expect(isSnapVisualRequest({ url: 'https://snap.example/v1/visual/runs/run' })).toBe(true);
        expect(isSnapVisualRequest('https://registry.npmjs.org/left-pad')).toBe(false);
        expect(isSnapVisualRequest('https://snap.example/v1/screenshots/batch')).toBe(false);
        expect(isSnapVisualRequest(null)).toBe(false);
        expect(isSnapVisualRequest({ href: 'https://snap.example/v1/visual/runs/run' })).toBe(false);
    });
});

describe('installSnap429Retry', () => {
    it('retries a replayable visual 429 and then returns the next response', async () => {
        const seen = [];
        const delays = [];
        const first = response(429, '1');
        const fetchWithRetry = installSnap429Retry({
            fetch: async (url) => {
                seen.push(url);
                return seen.length === 1 ? first : response(200);
            },
            sleep: async (delayMs) => {
                delays.push(delayMs);
            },
            writeStderr: () => {}
        });

        const result = await fetchWithRetry('https://snap.example/v1/visual/captures/cap/local-result', {
            method: 'POST',
            body: '{"imageBase64":"abc"}'
        });

        expect(result.status).toBe(200);
        expect(seen).toHaveLength(2);
        expect(delays).toEqual([1000]);
        expect(first.body.cancelled).toBe(true);
    });

    it('uses the fallback backoff when Retry-After is missing or not a delay', async () => {
        const bodies = [response(429, 'soon'), response(429), response(204)];
        const delays = [];
        const fetchWithRetry = installSnap429Retry({
            fetch: async () => bodies.shift(),
            sleep: async (delayMs) => {
                delays.push(delayMs);
            },
            backoffMs: [1000, 2000],
            writeStderr: () => {}
        });

        const result = await fetchWithRetry('https://snap.example/v1/visual/runs/run', {
            body: Buffer.from('png')
        });

        expect(result.status).toBe(204);
        expect(delays).toEqual([1000, 2000]);
    });

    it('returns the last 429 when the attempts are exhausted', async () => {
        let calls = 0;
        const fetchWithRetry = installSnap429Retry({
            maxAttempts: 2,
            fetch: async () => {
                calls += 1;
                return response(429);
            },
            sleep: async () => {},
            writeStderr: () => {}
        });

        const result = await fetchWithRetry(new URL('https://snap.example/v1/visual/captures/cap/local-result'), {
            body: new Uint8Array([1, 2])
        });

        expect(result.status).toBe(429);
        expect(calls).toBe(2);
    });

    it('does not retry a non-visual 429, a non-429, or a body that cannot be replayed', async () => {
        const calls = [];
        const fetchWithRetry = installSnap429Retry({
            fetch: async (url) => {
                calls.push(String(url));
                return response(url.endsWith('/ok') ? 200 : 429);
            },
            sleep: async () => {
                throw new Error('should not sleep');
            }
        });

        await expect(fetchWithRetry('https://registry.npmjs.org/left-pad')).resolves.toMatchObject({ status: 429 });
        await expect(fetchWithRetry('https://snap.example/v1/visual/runs/run/ok')).resolves.toMatchObject({ status: 200 });
        await expect(fetchWithRetry('https://snap.example/v1/visual/runs/run', {
            body: { pipe() {} }
        })).resolves.toMatchObject({ status: 429 });
        expect(calls).toHaveLength(3);
    });

    it('stops waiting when the request is aborted', async () => {
        const controller = new AbortController();
        const fetchWithRetry = installSnap429Retry({
            fetch: async () => response(429, '2'),
            sleep: async () => {
                controller.abort();
            },
            writeStderr: () => {}
        });

        await expect(fetchWithRetry('https://snap.example/v1/visual/captures/cap/local-result', {
            signal: controller.signal,
            body: 'replay'
        })).rejects.toThrow(/aborted/);

        const stopped = new AbortController();
        const fetchStopped = installSnap429Retry({
            fetch: async () => response(429, '1'),
            sleep: async () => {
                stopped.abort('stop');
            },
            writeStderr: () => {}
        });
        await expect(fetchStopped('https://snap.example/v1/visual/captures/cap/local-result', {
            signal: stopped.signal,
            body: 'replay'
        })).rejects.toThrow(/aborted/);
    });

    it('rejects immediately when the signal is already aborted', async () => {
        const controller = new AbortController();
        const reason = new Error('timed out');
        controller.abort(reason);
        const fetchWithRetry = installSnap429Retry({
            fetch: async () => response(429),
            sleep: async () => {
                throw new Error('should not sleep');
            }
        });

        await expect(fetchWithRetry('https://snap.example/v1/visual/captures/cap/local-result', {
            signal: controller.signal
        })).rejects.toBe(reason);

        const stopped = new AbortController();
        stopped.abort('stop');
        await expect(fetchWithRetry('https://snap.example/v1/visual/captures/cap/local-result', {
            signal: stopped.signal
        })).rejects.toThrow(/aborted/);
    });

    it('installs itself on global fetch when no fetch override is passed', async () => {
        jest.useFakeTimers();
        const original = global.fetch;
        const originalWrite = process.stderr.write;
        const stderr = [];
        const calls = [];
        global.fetch = async () => {
            calls.push('base');
            if (calls.length === 1) {
                return { status: 429 };
            }
            return response(201);
        };
        process.stderr.write = (chunk) => {
            stderr.push(String(chunk));
            return true;
        };

        try {
            const installed = installSnap429Retry();
            const pending = global.fetch('https://snap.example/v1/visual/projects/p/baselines/latest');
            await jest.advanceTimersByTimeAsync(1000);
            const result = await pending;
            expect(global.fetch).toBe(installed);
            expect(result.status).toBe(201);
            expect(stderr.join('')).toMatch(/Snap API 429/);
        } finally {
            global.fetch = original;
            process.stderr.write = originalWrite;
            jest.useRealTimers();
        }
    });
});

describe('shouldAutoInstall', () => {
    const previous = process.env.NODE_OPTIONS;

    afterEach(() => {
        if (previous === undefined) {
            delete process.env.NODE_OPTIONS;
        } else {
            process.env.NODE_OPTIONS = previous;
        }
    });

    it('installs only when Node was started with this preload', () => {
        process.env.NODE_OPTIONS = '--require /work/scripts/retry-snap-429.js';
        expect(shouldAutoInstall()).toBe(true);
        process.env.NODE_OPTIONS = '--experimental-vm-modules';
        expect(shouldAutoInstall()).toBe(false);
        delete process.env.NODE_OPTIONS;
        expect(shouldAutoInstall()).toBe(false);
    });

    it('wraps fetch when this file is preloaded through NODE_OPTIONS', () => {
        jest.resetModules();
        const original = global.fetch;
        global.fetch = async () => response(200);
        process.env.NODE_OPTIONS = '--require /work/scripts/retry-snap-429.js';

        let installed;
        jest.isolateModules(() => {
            installed = require('./retry-snap-429');
        });

        expect(installed.shouldAutoInstall()).toBe(true);
        expect(global.fetch).not.toBe(original);
        global.fetch = original;
    });
});
