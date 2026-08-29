// @ts-check

/**
 * Keep worker dispatch thresholds in a runtime-neutral module so the browser
 * tools and the Node-based cross-browser signoff use the same values.
 */
export const TEXT_ANALYZER_WORKER_CHAR_THRESHOLD = 5_000;
export const DIFF_CHECKER_WORKER_CHAR_THRESHOLD = 20_000;
export const JSON_FORMATTER_WORKER_CHAR_THRESHOLD = 50_000;
