import { computeDiff, type DiffComputeRequest, type DiffComputeResult } from './diff';
import { createWorkerRunner, type WorkerRunner } from '../common/worker-runner';

/**
 * Builds the diff worker URL with webpack 5's native worker syntax.
 * `import.meta.url` resolves against the tool's `output.publicPath`
 * (`/diff-checker/`), which makes the chunk load correctly in the per-tool
 * production build — the path-resolution contract proven by the text-analyzer
 * pilot (#398).
 */
export function createDiffRunner(): WorkerRunner<DiffComputeRequest, DiffComputeResult> {
    return createWorkerRunner<DiffComputeRequest, DiffComputeResult>({
        // Classic (non-module) worker: webpack bundles the worker + its `diff`
        // dependency into a single self-contained chunk, avoiding the
        // `experiments.outputModule` requirement a `{ type: 'module' }` worker
        // would impose on this build.
        createWorker: () => new Worker(new URL('./diff.worker.ts', import.meta.url)),
        fallback: ({ originalLines, modifiedLines, ignoreWhitespace }) =>
            computeDiff(originalLines, modifiedLines, ignoreWhitespace) as DiffComputeResult
    });
}
