/**
 * Dedicated worker for diff computation — keeps the (potentially expensive on
 * large inputs) line + word diff off the main thread. Returns an array of
 * `[changeType, lineContent]` tuples the main thread renders. The onmessage
 * request/response plumbing lives in `common/worker-harness`.
 */
import { exposeWorker } from '../common/worker-harness';
import { computeDiff, type DiffComputeRequest, type DiffComputeResult } from './diff';

exposeWorker<DiffComputeRequest, DiffComputeResult>(
    ({ originalLines, modifiedLines, ignoreWhitespace }) =>
        computeDiff(originalLines, modifiedLines, ignoreWhitespace) as DiffComputeResult
);
