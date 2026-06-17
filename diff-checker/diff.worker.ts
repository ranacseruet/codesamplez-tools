/// <reference lib="webworker" />
/**
 * Dedicated worker for diff computation. Keeps the (potentially expensive on
 * large inputs) line + word diff off the main thread. Pure compute, no DOM —
 * the result is an array of `[changeType, lineContent]` tuples that the main
 * thread renders. Message contract matches `common/worker-runner.ts`.
 */
import { computeDiff, type DiffComputeRequest, type DiffComputeResult } from './diff';
import type { WorkerRequest, WorkerResponse } from '../common/worker-runner';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest<DiffComputeRequest>>) => {
    const { id, payload } = event.data;
    try {
        const result = computeDiff(
            payload.originalLines,
            payload.modifiedLines,
            payload.ignoreWhitespace
        ) as DiffComputeResult;
        const response: WorkerResponse<DiffComputeResult> = { id, result };
        ctx.postMessage(response);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'diff computation failed';
        const response: WorkerResponse<DiffComputeResult> = { id, error: message };
        ctx.postMessage(response);
    }
};
