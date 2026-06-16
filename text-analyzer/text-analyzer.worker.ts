/// <reference lib="webworker" />
/**
 * Dedicated worker for text analysis. Keeps the (potentially expensive on very
 * large inputs) `analyzeText` computation off the main thread. Pure compute, no
 * DOM access. Message contract matches `common/worker-runner.ts`.
 */
import { analyzeText, type TextAnalysisResult } from './TextAnalyzer';
import type { WorkerRequest, WorkerResponse } from '../common/worker-runner';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest<string>>) => {
    const { id, payload } = event.data;
    try {
        const result = analyzeText(payload);
        const response: WorkerResponse<TextAnalysisResult> = { id, result };
        ctx.postMessage(response);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'text analysis failed';
        const response: WorkerResponse<TextAnalysisResult> = { id, error: message };
        ctx.postMessage(response);
    }
};
