// @ts-check

import { pathToFileURL } from 'node:url';

export {
  determineVisualDiffStatus,
  shouldFailVisualDiff,
  formatVisualDiffFailureMessage,
  generateVisualDiffReport,
  runVisualDiffCli
} from '../visual-diff-github-action/lib/compare-visual-results.mjs';

import { runVisualDiffCli } from '../visual-diff-github-action/lib/compare-visual-results.mjs';

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  runVisualDiffCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
