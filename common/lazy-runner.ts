/**
 * Main-thread lazy wrapper around a `WorkerRunner`.
 *
 * Captures the lifecycle every tool's offload dispatch otherwise hand-rolls:
 *   1. lazily `import()` the per-tool runner factory (code-splitting the worker
 *      chunk out of the main bundle and off the SSR/prerender graph),
 *   2. memoize the constructed runner across calls,
 *   3. fall back to a direct main-thread compute if the runner *chunk itself*
 *      fails to load — that happens before the `WorkerRunner`'s own fallback can
 *      engage (e.g. a cache-skew deploy or transient network error), and
 *   4. expose `terminate()` to tear the worker down.
 *
 * The factory is imported via a thunk that resolves to the factory function, so
 * runner modules keep descriptive named exports, e.g.:
 *
 *   const runner = createLazyRunner(
 *     () => import('./diff-runner').then((m) => m.createDiffRunner),
 *     (payload) => computeOnMainThread(payload)
 *   );
 *
 * Threshold decisions and any stale-result dropping (live-as-you-type) stay at
 * the call site — those are tool-specific.
 */
import type { WorkerRunner } from './worker-runner';

export interface LazyRunner<TPayload, TResult> {
    /**
     * Run in the worker (lazily constructed), falling back to the main thread on
     * any failure. For live-as-you-type callers, pass `shouldAbort`: it is
     * checked *after* the runner chunk loads and, if it returns true, the run is
     * abandoned without dispatching to the worker or fallback (the request was
     * superseded while the chunk was loading). The returned promise then settles
     * to a value the caller is expected to ignore.
     */
    run(payload: TPayload, shouldAbort?: () => boolean): Promise<TResult>;
    /** Tear down the worker, if one was constructed. Safe to call when none was. */
    terminate(): void;
}

export function createLazyRunner<TPayload, TResult>(
    importFactory: () => Promise<() => WorkerRunner<TPayload, TResult>>,
    fallback: (payload: TPayload) => TResult | Promise<TResult>
): LazyRunner<TPayload, TResult> {
    let runner: WorkerRunner<TPayload, TResult> | null = null;

    return {
        async run(payload, shouldAbort) {
            let createRunner: () => WorkerRunner<TPayload, TResult>;
            try {
                createRunner = await importFactory();
            } catch {
                // The runner chunk failed to load — degrade to a direct
                // main-thread compute rather than leaving the caller stuck.
                return fallback(payload);
            }

            // Superseded while the chunk was loading: skip the dispatch entirely
            // so stale work never reaches the worker/fallback. The caller drops
            // this result (its own `active`/stale guard is already false).
            if (shouldAbort?.()) {
                return undefined as unknown as TResult;
            }

            if (!runner) {
                runner = createRunner();
            }
            try {
                return await runner.run(payload);
            } catch {
                // Factory threw or the worker run rejected — fall back. (A
                // fallback that itself throws, e.g. invalid input, surfaces to
                // the caller, which is the intended error path.)
                return fallback(payload);
            }
        },
        terminate() {
            if (runner) {
                runner.terminate();
                runner = null;
            }
        }
    };
}
