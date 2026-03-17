// @ts-check

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium, firefox, webkit } from 'playwright';

/** @typedef {import('../types/qa-script-types').CrossBrowserCheck} CrossBrowserCheck */
/** @typedef {import('../types/qa-script-types').CrossBrowserResults} CrossBrowserResults */

const require = createRequire(import.meta.url);
const { parseToolSelectionArgs } = require('./tool-manifest');
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:8080';
const outDir = path.resolve(process.env.QA_CROSS_BROWSER_OUT_DIR || path.join('qa-artifacts', 'cross-browser-signoff'));
const resultsPath = path.resolve(
  process.env.QA_CROSS_BROWSER_RESULTS_FILE || path.join(outDir, 'cross-browser-signoff-results.json')
);
const markdownPath = path.resolve(
  process.env.QA_CROSS_BROWSER_RESULTS_MARKDOWN || path.join(outDir, 'cross-browser-signoff-results.md')
);
const selection = parseToolSelectionArgs(process.argv.slice(2));
const selectedTools = new Set(selection.requestedTools);

const browserMatrix = [
  { name: 'chromium', type: chromium },
  { name: 'firefox', type: firefox },
  { name: 'webkit', type: webkit }
];

const scenarios = [
  {
    name: 'root-index',
    url: '/',
    waits: ['.cst-shell__header', '.main-container', '.tools-grid']
  },
  {
    name: 'data-format-converter',
    url: '/data-format-converter/',
    waits: ['#app-shell-header .cst-shell__header', '#inputText', '#outputText']
  },
  {
    name: 'js-minifier-tool',
    url: '/js-minifier-tool/',
    waits: ['#app-shell-header .cst-shell__header', '#js-minifier-minify-btn', '#js-minifier-input', '#js-minifier-output']
  },
  {
    name: 'diff-checker-tool',
    url: '/diff-checker-tool/',
    waits: ['#app-shell-header .cst-shell__header', '#text1', '#text2', '#compare-button', '#diff-result']
  }
];

/** @type {CrossBrowserResults} */
const results = {
  startedAt: new Date().toISOString(),
  baseUrl,
  suite: 'cross-browser-signoff',
  checks: []
};

/**
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {number} [timeout]
 * @returns {Promise<void>}
 */
async function waitVisible(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * @param {string} browserName
 * @param {{ name: string }} scenario
 * @param {() => Promise<Record<string, unknown> | void>} fn
 * @returns {Promise<void>}
 */
async function record(browserName, scenario, fn) {
  const started = Date.now();
  const name = `${browserName} ${scenario.name}`;
  try {
    const details = await fn();
    results.checks.push({
      name,
      browser: browserName,
      scenario: scenario.name,
      status: 'passed',
      durationMs: Date.now() - started,
      ...(details || {})
    });
  } catch (error) {
    results.checks.push({
      name,
      browser: browserName,
      scenario: scenario.name,
      status: 'failed',
      durationMs: Date.now() - started,
      error: error?.message || String(error)
    });
    throw error;
  }
}

/**
 * @param {CrossBrowserResults} summary
 * @returns {string}
 */
function makeMarkdown(summary) {
  const lines = [];
  lines.push('# Cross-Browser Signoff');
  lines.push('');
  lines.push(`- Base URL: \`${summary.baseUrl}\``);
  lines.push(`- Total checks: ${summary.checks.length}`);
  lines.push(`- Passed: ${summary.checks.filter((check) => check.status === 'passed').length}`);
  lines.push(`- Failed: ${summary.checks.filter((check) => check.status === 'failed').length}`);
  lines.push('');
  lines.push('## Results');
  for (const check of summary.checks) {
    const suffix = check.status === 'passed' ? 'ok' : `failed (${check.error})`;
    lines.push(`- ${check.name}: ${suffix}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * @param {{ name: string }} scenario
 * @returns {boolean}
 */
function shouldRunScenario(scenario) {
  return selectedTools.size === 0 || selectedTools.has(scenario.name);
}

/**
 * @param {string} browserName
 * @param {import('playwright').BrowserType} browserType
 * @param {{ name: string, url: string, waits: string[] }} scenario
 * @returns {Promise<void>}
 */
async function runScenario(browserName, browserType, scenario) {
  const browser = await browserType.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await record(browserName, scenario, async () => {
      await page.goto(`${baseUrl}${scenario.url}`, { waitUntil: 'networkidle' });
      for (const selector of scenario.waits) {
        await waitVisible(page, selector);
      }
      return {
        url: scenario.url,
        title: await page.title()
      };
    });
    await context.close();
  } finally {
    await browser.close();
  }
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  for (const browser of browserMatrix) {
    for (const scenario of scenarios.filter(shouldRunScenario)) {
      await runScenario(browser.name, browser.type, scenario);
    }
  }

  results.finishedAt = new Date().toISOString();
  results.passed = results.checks.every((check) => check.status === 'passed');
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  await fs.writeFile(markdownPath, makeMarkdown(results));
}

main().catch(async (error) => {
  results.finishedAt = new Date().toISOString();
  results.passed = false;
  results.error = error?.message || String(error);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  await fs.writeFile(markdownPath, makeMarkdown(results));
  console.error(error);
  process.exitCode = 1;
});
