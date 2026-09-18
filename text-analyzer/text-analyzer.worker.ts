/**
 * Dedicated worker for text analysis — keeps the (potentially expensive on very
 * large inputs) `analyzeText` computation off the main thread. The onmessage
 * request/response plumbing lives in `common/worker-harness`.
 */
import { exposeWorker } from '../common/worker-harness';
import { analyzeText, type TextAnalysisResult } from './TextAnalyzer';

exposeWorker<string, TextAnalysisResult>(analyzeText);
