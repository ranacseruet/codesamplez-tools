// @ts-check

import { pathToFileURL } from 'node:url';

export { runVisualBaselineCapture } from '../visual-diff-github-action/lib/capture-visual-routes.mjs';

import { runVisualBaselineCapture } from '../visual-diff-github-action/lib/capture-visual-routes.mjs';

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  runVisualBaselineCapture().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
