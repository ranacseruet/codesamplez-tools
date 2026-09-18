/// <reference lib="webworker" />
/**
 * Dedicated-worker side of the compute-offload contract. Wraps the repetitive
 * `onmessage` boilerplate every tool worker would otherwise hand-roll: read the
 * id-correlated request, run the pure compute function, and post back exactly
 * one of `result` / `error`. The message shape matches `common/worker-runner.ts`
 * (the main-thread half).
 *
 * Each tool still needs its own one-line worker entry module so webpack can
 * statically discover and chunk it via `new Worker(new URL('./x.worker.ts',
 * import.meta.url))`; that entry just calls `exposeWorker(computeFn)`.
 *
 * The compute may be sync or async; rejections/throws become an `error`
 * response, which the runner surfaces as a rejected `run()` (and thus the
 * caller's fallback). Keep compute pure — no DOM, structured-cloneable payload
 * and result.
 */
import type { WorkerRequest, WorkerResponse } from './worker-runner';

export function exposeWorker<TPayload, TResult>(
    compute: (payload: TPayload) => TResult | Promise<TResult>
): void {
    const ctx = self as unknown as DedicatedWorkerGlobalScope;

    ctx.onmessage = async (event: MessageEvent<WorkerRequest<TPayload>>) => {
        const { id, payload } = event.data;
        try {
            const result = await compute(payload);
            ctx.postMessage({ id, result } satisfies WorkerResponse<TResult>);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'worker computation failed';
            ctx.postMessage({ id, error: message } satisfies WorkerResponse<TResult>);
        }
    };
}
