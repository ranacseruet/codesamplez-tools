/**
 * Web Worker compute-offload foundation.
 *
 * Wraps a dedicated Worker behind a typed, Promise-based `run()` API with an
 * always-available main-thread fallback. The fallback is used when:
 *   - the environment has no `Worker` (SSR / old browser / jsdom tests),
 *   - the worker fails to construct or load (e.g. asset path resolution),
 *   - the worker emits a runtime error, or
 *   - a request exceeds `timeoutMs`.
 *
 * This is intentionally separate from `common/scheduler-utils.ts`: that yields
 * the main thread between chunks of work (cooperative INP relief), whereas this
 * moves the work off the main thread entirely. Use a worker only for genuinely
 * CPU-bound work where the (de)serialization cost is small relative to compute.
 *
 * The runner is request/response and id-correlated; callers that only care about
 * the latest result (e.g. live-as-you-type) should drop stale resolutions on
 * their side (an `active` flag in the awaiting effect).
 */

/** Message posted to the worker. */
export interface WorkerRequest<TPayload> {
    id: number;
    payload: TPayload;
}

/** Message posted back by the worker. Exactly one of `result`/`error` is set. */
export interface WorkerResponse<TResult> {
    id: number;
    result?: TResult;
    error?: string;
}

export interface WorkerRunner<TPayload, TResult> {
    /** Run `payload` in the worker, falling back to the main thread on any failure. */
    run(payload: TPayload): Promise<TResult>;
    /** Tear down the worker and settle any in-flight requests via the fallback. */
    terminate(): void;
    /** True once the worker has been disabled and all calls go to the fallback. */
    readonly isFallbackOnly: boolean;
}

export interface CreateWorkerRunnerOptions<TPayload, TResult> {
    /**
     * Lazily constructs the Worker. Kept as a factory so the (potentially
     * throwing) `new Worker(new URL(...))` call only runs in capable browsers
     * and only when the worker is first needed.
     */
    createWorker: () => Worker;
    /** Main-thread implementation, used for every fallback path. */
    fallback: (payload: TPayload) => TResult | Promise<TResult>;
    /** Per-request timeout before falling back. Defaults to 10s. */
    timeoutMs?: number;
    /**
     * Terminate the current worker when a request times out. The runner stays
     * available to create a fresh worker for the next request; this is useful
     * for untrusted workloads where a timed-out worker must never be reused.
     */
    terminateOnTimeout?: boolean;
}

interface PendingEntry<TPayload, TResult> {
    payload: TPayload;
    resolve: (value: TResult) => void;
    reject: (reason?: unknown) => void;
    timer: ReturnType<typeof setTimeout> | null;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export function createWorkerRunner<TPayload, TResult>(
    options: CreateWorkerRunnerOptions<TPayload, TResult>
): WorkerRunner<TPayload, TResult> {
    const {
        createWorker,
        fallback,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        terminateOnTimeout = false
    } = options;

    let worker: Worker | null = null;
    let fallbackOnly = false;
    let nextId = 0;
    const pending = new Map<number, PendingEntry<TPayload, TResult>>();

    const settleViaFallback = (entry: PendingEntry<TPayload, TResult>): void => {
        if (entry.timer !== null) {
            clearTimeout(entry.timer);
        }
        Promise.resolve()
            .then(() => fallback(entry.payload))
            .then(entry.resolve, entry.reject);
    };

    /**
     * Permanently disable the worker and route this + all outstanding requests
     * to the main-thread fallback. Called on construct/load/runtime failure so a
     * broken worker degrades gracefully instead of hanging the tool.
     */
    const disableWorker = (): void => {
        fallbackOnly = true;
        if (worker) {
            try {
                worker.terminate();
            } catch {
                /* ignore */
            }
            worker = null;
        }
        const entries = [...pending.values()];
        pending.clear();
        entries.forEach(settleViaFallback);
    };

    const terminateTimedOutWorker = (): void => {
        if (worker) {
            const timedOutWorker = worker;
            timedOutWorker.onerror = null;
            if ('onmessageerror' in timedOutWorker) {
                timedOutWorker.onmessageerror = null;
            }
            try {
                timedOutWorker.terminate();
            } catch {
                /* ignore */
            }
            worker = null;
        }

        const entries = [...pending.values()];
        pending.clear();
        entries.forEach(settleViaFallback);
    };

    const ensureWorker = (): Worker | null => {
        if (fallbackOnly) {
            return null;
        }
        if (worker) {
            return worker;
        }
        if (typeof Worker === 'undefined') {
            fallbackOnly = true;
            return null;
        }
        try {
            const created = createWorker();
            created.onmessage = (event: MessageEvent<WorkerResponse<TResult>>) => {
                const { id, result, error } = event.data ?? ({} as WorkerResponse<TResult>);
                const entry = pending.get(id);
                if (!entry) {
                    return;
                }
                pending.delete(id);
                if (entry.timer !== null) {
                    clearTimeout(entry.timer);
                }
                if (error !== undefined) {
                    entry.reject(new Error(error));
                } else {
                    entry.resolve(result as TResult);
                }
            };
            // A load/runtime failure (e.g. the chunk 404s under the wrong
            // publicPath) surfaces here — disable and fall back for everyone.
            created.onerror = () => disableWorker();
            if ('onmessageerror' in created) {
                created.onmessageerror = () => disableWorker();
            }
            worker = created;
            return worker;
        } catch {
            fallbackOnly = true;
            return null;
        }
    };

    const run = (payload: TPayload): Promise<TResult> => {
        const activeWorker = ensureWorker();
        if (!activeWorker) {
            return Promise.resolve().then(() => fallback(payload));
        }

        const id = ++nextId;
        return new Promise<TResult>((resolve, reject) => {
            const entry: PendingEntry<TPayload, TResult> = { payload, resolve, reject, timer: null };
            entry.timer = setTimeout(() => {
                if (!pending.has(id)) {
                    return;
                }

                if (terminateOnTimeout) {
                    terminateTimedOutWorker();
                } else if (pending.delete(id)) {
                    entry.timer = null;
                    settleViaFallback(entry);
                }
            }, timeoutMs);
            pending.set(id, entry);

            try {
                const message: WorkerRequest<TPayload> = { id, payload };
                activeWorker.postMessage(message);
            } catch {
                pending.delete(id);
                settleViaFallback(entry);
            }
        });
    };

    const terminate = (): void => {
        disableWorker();
    };

    return {
        run,
        terminate,
        get isFallbackOnly() {
            return fallbackOnly;
        }
    };
}
