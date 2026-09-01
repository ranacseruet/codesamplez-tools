/** Dedicated worker for JSON Schema validation.
 *
 * Ajv and json-source-map are intentionally reachable only through this
 * worker entrypoint. The formatter main bundle never imports the validator
 * implementation or uses a main-thread fallback.
 */
import { exposeWorker } from '../common/worker-harness';
import {
    validateJsonSchema,
    type SchemaValidationRequest,
    type SchemaValidationResult
} from './schema-validation-core';

exposeWorker<SchemaValidationRequest, SchemaValidationResult>(validateJsonSchema);
