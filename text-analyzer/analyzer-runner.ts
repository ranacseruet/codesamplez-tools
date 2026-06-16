import { analyzeText, type TextAnalysisResult } from './TextAnalyzer';
import { createWorkerRunner, type WorkerRunner } from '../common/worker-runner';

/**
 * Builds the worker URL with webpack 5's native worker syntax. `import.meta.url`
 * resolves against the tool's `output.publicPath` (`/text-analyzer/`), which is
 * what makes the chunk load correctly in the per-tool production build — the
 * exact path-resolution problem that sank the earlier worker attempt (#130–#133).
 */
export function createAnalyzerRunner(): WorkerRunner<string, TextAnalysisResult> {
    return createWorkerRunner<string, TextAnalysisResult>({
        // Classic (non-module) worker: webpack bundles the worker + its deps into
        // a single self-contained chunk, avoiding the `experiments.outputModule`
        // requirement (and the `exports is not defined` failure) that a
        // `{ type: 'module' }` worker would impose on this build.
        createWorker: () => new Worker(new URL('./text-analyzer.worker.ts', import.meta.url)),
        fallback: analyzeText
    });
}
