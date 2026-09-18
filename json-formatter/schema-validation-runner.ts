import { createWorkerRunner, type WorkerRunner } from '../common/worker-runner';
import type { SchemaValidationRequest, SchemaValidationResult } from './schema-validation-core';

const unavailable = (): SchemaValidationResult => ({
    outcome: 'unavailable',
    message: 'Schema validation is unavailable right now. Your formatted output is still available.'
});

/**
 * Build the isolated validator runner. The worker is constructed only after
 * the optional schema feature is used, and a timeout terminates the worker so
 * an untrusted schema cannot keep running after its deadline.
 */
export function createSchemaValidationRunner(): WorkerRunner<SchemaValidationRequest, SchemaValidationResult> {
    return createWorkerRunner<SchemaValidationRequest, SchemaValidationResult>({
        createWorker: () => new Worker(new URL('./schema-validation.worker.ts', import.meta.url)),
        fallback: unavailable,
        timeoutMs: 5_000,
        terminateOnTimeout: true
    });
}
