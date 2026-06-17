import { formatJson, type JsonFormatRequest, type JsonFormatResult } from './json-format-core';
import { createWorkerRunner, type WorkerRunner } from '../common/worker-runner';

/**
 * Builds the JSON-format worker URL with webpack 5's native worker syntax.
 * `import.meta.url` resolves against the tool's `output.publicPath`
 * (`/json-formatter/`), the path-resolution contract proven by the
 * text-analyzer pilot (#398) and diff-checker (#403).
 */
export function createFormatRunner(): WorkerRunner<JsonFormatRequest, JsonFormatResult> {
    return createWorkerRunner<JsonFormatRequest, JsonFormatResult>({
        // Classic (non-module) worker: webpack bundles the worker + its core
        // into one self-contained chunk, avoiding the `experiments.outputModule`
        // requirement a `{ type: 'module' }` worker would impose on this build.
        createWorker: () => new Worker(new URL('./format.worker.ts', import.meta.url)),
        fallback: formatJson
    });
}
