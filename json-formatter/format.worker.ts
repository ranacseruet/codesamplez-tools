/**
 * Dedicated worker for JSON formatting — keeps the (potentially expensive on
 * large inputs) auto-fix + parse + key-sort + stringify off the main thread.
 * Returns `{ formatted, formattedString }`; the parsed `formatted` value is
 * structured-cloned back so the main thread's tree renderer walks it without a
 * second `JSON.parse`. The onmessage plumbing lives in `common/worker-harness`.
 */
import { exposeWorker } from '../common/worker-harness';
import { formatJson, type JsonFormatRequest, type JsonFormatResult } from './json-format-core';

exposeWorker<JsonFormatRequest, JsonFormatResult>(formatJson);
