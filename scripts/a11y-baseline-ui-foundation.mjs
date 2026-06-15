// @ts-check

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium, devices } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

/** @typedef {import('../types/qa-script-types').A11yViolationSummary} A11yViolationSummary */
/** @typedef {import('../types/qa-script-types').QaA11yResults} QaA11yResults */

const require = createRequire(import.meta.url);
const { parseToolSelectionArgs } = require('./tool-manifest');
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:8080';
const failOnViolations = process.env.QA_A11Y_FAIL_ON_VIOLATIONS === '1';
const outDir = path.resolve('qa-artifacts', 'a11y-reports', 'phase-d-foundation');
const reportPath = path.join(outDir, 'phase-d-foundation-a11y-results.json');
const selection = parseToolSelectionArgs(process.argv.slice(2));
const selectedTools = new Set(selection.requestedTools);

/** @type {QaA11yResults} */
const results = {
  startedAt: new Date().toISOString(),
  baseUrl,
  suite: 'phase-d-foundation-a11y-baseline',
  mode: failOnViolations ? 'fail-on-violations' : 'report-only',
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
 * @param {Array<{
 *   id: string,
 *   impact?: string | null,
 *   help: string,
 *   helpUrl: string,
 *   tags: string[],
 *   nodes: Array<{ target: unknown[], html: string, failureSummary?: string }>
 * }>} violations
 * @returns {A11yViolationSummary[]}
 */
function summarizeViolations(violations) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    helpUrl: violation.helpUrl,
    tags: violation.tags,
    nodeCount: violation.nodes.length,
    nodes: violation.nodes.slice(0, 5).map((node) => ({
      target: node.target,
      html: node.html,
      failureSummary: node.failureSummary
    }))
  }));
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<Record<string, unknown>>}
 */
async function analyzePageA11y(page) {
  const axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);
  const analysis = await axe.analyze();
  return {
    violations: summarizeViolations(analysis.violations),
    passesCount: analysis.passes.length,
    violationsCount: analysis.violations.length,
    incompleteCount: analysis.incomplete.length,
    inapplicableCount: analysis.inapplicable.length
  };
}

/**
 * @param {string} name
 * @param {() => Promise<Record<string, unknown> | void>} fn
 * @returns {Promise<void>}
 */
async function record(name, fn) {
  const started = Date.now();
  try {
    const details = await fn();
    results.checks.push({
      name,
      status: 'passed',
      durationMs: Date.now() - started,
      ...(details || {})
    });
  } catch (error) {
    results.checks.push({
      name,
      status: 'failed',
      durationMs: Date.now() - started,
      error: error?.message || String(error)
    });
    throw error;
  }
}

/**
 * @param {string} toolId
 * @returns {boolean}
 */
function shouldRunTool(toolId) {
  return selectedTools.size === 0 || selectedTools.has(toolId);
}

function shouldRunRoot() {
  return selectedTools.size === 0;
}

async function run() {
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const mobile = await browser.newContext({ ...devices['iPhone 12'] });

    if (shouldRunRoot()) {
      const rootDesktop = await desktop.newPage();
      await record('root-index desktop a11y baseline', async () => {
        await rootDesktop.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await waitVisible(rootDesktop, '.cst-appbar');
        await waitVisible(rootDesktop, '.main-container');
        const report = await analyzePageA11y(rootDesktop);
        return { page: '/', viewport: 'desktop', ...report };
      });

      const rootMobile = await mobile.newPage();
      await record('root-index mobile a11y baseline', async () => {
        await rootMobile.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await waitVisible(rootMobile, '.cst-appbar');
        await waitVisible(rootMobile, '.main-container');
        const report = await analyzePageA11y(rootMobile);
        return { page: '/', viewport: 'mobile-iphone12', ...report };
      });
    }

    if (shouldRunTool('data-format-converter')) {
      const converterDesktop = await desktop.newPage();
      await record('data-format-converter desktop a11y baseline', async () => {
        await converterDesktop.goto(`${baseUrl}/data-format-converter/`, { waitUntil: 'networkidle' });
        await waitVisible(converterDesktop, '#app-shell-header .cst-appbar');
        await waitVisible(converterDesktop, '#inputText');
        const report = await analyzePageA11y(converterDesktop);
        return { page: '/data-format-converter/', viewport: 'desktop', ...report };
      });

      const converterMobile = await mobile.newPage();
      await record('data-format-converter mobile a11y baseline', async () => {
        await converterMobile.goto(`${baseUrl}/data-format-converter/`, { waitUntil: 'networkidle' });
        await waitVisible(converterMobile, '#app-shell-header .cst-appbar');
        await waitVisible(converterMobile, '#inputText');
        const report = await analyzePageA11y(converterMobile);
        return { page: '/data-format-converter/', viewport: 'mobile-iphone12', ...report };
      });
    }

    if (shouldRunTool('js-minifier-tool')) {
      const jsMinifierDesktop = await desktop.newPage();
      await record('js-minifier-tool desktop a11y baseline', async () => {
        await jsMinifierDesktop.goto(`${baseUrl}/js-minifier/`, { waitUntil: 'networkidle' });
        await waitVisible(jsMinifierDesktop, '#app-shell-header .cst-appbar');
        await waitVisible(jsMinifierDesktop, '#js-minifier-minify-btn');
        await waitVisible(jsMinifierDesktop, '#js-minifier-input');
        const report = await analyzePageA11y(jsMinifierDesktop);
        return { page: '/js-minifier/', viewport: 'desktop', ...report };
      });

      const jsMinifierMobile = await mobile.newPage();
      await record('js-minifier-tool mobile a11y baseline', async () => {
        await jsMinifierMobile.goto(`${baseUrl}/js-minifier/`, { waitUntil: 'networkidle' });
        await waitVisible(jsMinifierMobile, '#app-shell-header .cst-appbar');
        await waitVisible(jsMinifierMobile, '#js-minifier-minify-btn');
        await waitVisible(jsMinifierMobile, '#js-minifier-input');
        const report = await analyzePageA11y(jsMinifierMobile);
        return { page: '/js-minifier/', viewport: 'mobile-iphone12', ...report };
      });
    }

    if (shouldRunTool('base64-converter-tool')) {
      const base64Desktop = await desktop.newPage();
      await record('base64-converter-tool desktop a11y baseline', async () => {
        await base64Desktop.goto(`${baseUrl}/base64-converter/`, { waitUntil: 'networkidle' });
        await waitVisible(base64Desktop, '#app-shell-header .cst-appbar');
        await waitVisible(base64Desktop, '#base64converter-mode');
        await waitVisible(base64Desktop, '#base64converter-input');
        const report = await analyzePageA11y(base64Desktop);
        return { page: '/base64-converter/', viewport: 'desktop', ...report };
      });

      const base64Mobile = await mobile.newPage();
      await record('base64-converter-tool mobile a11y baseline', async () => {
        await base64Mobile.goto(`${baseUrl}/base64-converter/`, { waitUntil: 'networkidle' });
        await waitVisible(base64Mobile, '#app-shell-header .cst-appbar');
        await waitVisible(base64Mobile, '#base64converter-mode');
        await waitVisible(base64Mobile, '#base64converter-input');
        const report = await analyzePageA11y(base64Mobile);
        return { page: '/base64-converter/', viewport: 'mobile-iphone12', ...report };
      });
    }

    if (shouldRunTool('jwt-builder-tool')) {
      const jwtBuilderDesktop = await desktop.newPage();
      await record('jwt-builder-tool desktop a11y baseline', async () => {
        await jwtBuilderDesktop.goto(`${baseUrl}/jwt-builder/`, { waitUntil: 'networkidle' });
        await waitVisible(jwtBuilderDesktop, '#app-shell-header .cst-appbar');
        await waitVisible(jwtBuilderDesktop, '#jwtForm');
        await waitVisible(jwtBuilderDesktop, '#buildJwtBtn');
        const report = await analyzePageA11y(jwtBuilderDesktop);
        return { page: '/jwt-builder/', viewport: 'desktop', ...report };
      });

      const jwtBuilderMobile = await mobile.newPage();
      await record('jwt-builder-tool mobile a11y baseline', async () => {
        await jwtBuilderMobile.goto(`${baseUrl}/jwt-builder/`, { waitUntil: 'networkidle' });
        await waitVisible(jwtBuilderMobile, '#app-shell-header .cst-appbar');
        await waitVisible(jwtBuilderMobile, '#jwtForm');
        await waitVisible(jwtBuilderMobile, '#buildJwtBtn');
        const report = await analyzePageA11y(jwtBuilderMobile);
        return { page: '/jwt-builder/', viewport: 'mobile-iphone12', ...report };
      });
    }

    if (shouldRunTool('jwt-decoder-tool')) {
      const jwtDecoderDesktop = await desktop.newPage();
      await record('jwt-decoder-tool desktop a11y baseline', async () => {
        await jwtDecoderDesktop.goto(`${baseUrl}/jwt-decoder/`, { waitUntil: 'networkidle' });
        await waitVisible(jwtDecoderDesktop, '#app-shell-header .cst-appbar');
        await waitVisible(jwtDecoderDesktop, '#jwtInputToken');
        await waitVisible(jwtDecoderDesktop, '#jwtSecretKey');
        const report = await analyzePageA11y(jwtDecoderDesktop);
        return { page: '/jwt-decoder/', viewport: 'desktop', ...report };
      });

      const jwtDecoderMobile = await mobile.newPage();
      await record('jwt-decoder-tool mobile a11y baseline', async () => {
        await jwtDecoderMobile.goto(`${baseUrl}/jwt-decoder/`, { waitUntil: 'networkidle' });
        await waitVisible(jwtDecoderMobile, '#app-shell-header .cst-appbar');
        await waitVisible(jwtDecoderMobile, '#jwtInputToken');
        await waitVisible(jwtDecoderMobile, '#jwtSecretKey');
        const report = await analyzePageA11y(jwtDecoderMobile);
        return { page: '/jwt-decoder/', viewport: 'mobile-iphone12', ...report };
      });
    }

    if (shouldRunTool('json-formatter-tool')) {
      const jsonFormatterDesktop = await desktop.newPage();
      await record('json-formatter-tool desktop a11y baseline', async () => {
        await jsonFormatterDesktop.goto(`${baseUrl}/json-formatter/`, { waitUntil: 'networkidle' });
        await waitVisible(jsonFormatterDesktop, '#app-shell-header .cst-appbar');
        await waitVisible(jsonFormatterDesktop, '#formatJsonBtn');
        await waitVisible(jsonFormatterDesktop, '#treeView');
        const report = await analyzePageA11y(jsonFormatterDesktop);
        return { page: '/json-formatter/', viewport: 'desktop', ...report };
      });

      const jsonFormatterMobile = await mobile.newPage();
      await record('json-formatter-tool mobile a11y baseline', async () => {
        await jsonFormatterMobile.goto(`${baseUrl}/json-formatter/`, { waitUntil: 'networkidle' });
        await waitVisible(jsonFormatterMobile, '#app-shell-header .cst-appbar');
        await waitVisible(jsonFormatterMobile, '#formatJsonBtn');
        await waitVisible(jsonFormatterMobile, '#treeView');
        const report = await analyzePageA11y(jsonFormatterMobile);
        return { page: '/json-formatter/', viewport: 'mobile-iphone12', ...report };
      });
    }

    if (shouldRunTool('css-minifier-tool')) {
      const cssMinifierDesktop = await desktop.newPage();
      await record('css-minifier-tool desktop a11y baseline', async () => {
        await cssMinifierDesktop.goto(`${baseUrl}/css-minifier/`, { waitUntil: 'networkidle' });
        await waitVisible(cssMinifierDesktop, '#app-shell-header .cst-appbar');
        await waitVisible(cssMinifierDesktop, '#css-minifier-input');
        await waitVisible(cssMinifierDesktop, '#css-minifier-output');
        const report = await analyzePageA11y(cssMinifierDesktop);
        return { page: '/css-minifier/', viewport: 'desktop', ...report };
      });

      const cssMinifierMobile = await mobile.newPage();
      await record('css-minifier-tool mobile a11y baseline', async () => {
        await cssMinifierMobile.goto(`${baseUrl}/css-minifier/`, { waitUntil: 'networkidle' });
        await waitVisible(cssMinifierMobile, '#app-shell-header .cst-appbar');
        await waitVisible(cssMinifierMobile, '#css-minifier-input');
        await waitVisible(cssMinifierMobile, '#css-minifier-output');
        const report = await analyzePageA11y(cssMinifierMobile);
        return { page: '/css-minifier/', viewport: 'mobile-iphone12', ...report };
      });
    }

    if (shouldRunTool('text-analyzer-tool')) {
      const textAnalyzerDesktop = await desktop.newPage();
      await record('text-analyzer-tool desktop a11y baseline', async () => {
        await textAnalyzerDesktop.goto(`${baseUrl}/text-analyzer/`, { waitUntil: 'networkidle' });
        await waitVisible(textAnalyzerDesktop, '#app-shell-header .cst-appbar');
        await waitVisible(textAnalyzerDesktop, '#textInput');
        await waitVisible(textAnalyzerDesktop, '#wordFrequencyChart');
        const report = await analyzePageA11y(textAnalyzerDesktop);
        return { page: '/text-analyzer/', viewport: 'desktop', ...report };
      });

      const textAnalyzerMobile = await mobile.newPage();
      await record('text-analyzer-tool mobile a11y baseline', async () => {
        await textAnalyzerMobile.goto(`${baseUrl}/text-analyzer/`, { waitUntil: 'networkidle' });
        await waitVisible(textAnalyzerMobile, '#app-shell-header .cst-appbar');
        await waitVisible(textAnalyzerMobile, '#textInput');
        await waitVisible(textAnalyzerMobile, '#wordFrequencyChart');
        const report = await analyzePageA11y(textAnalyzerMobile);
        return { page: '/text-analyzer/', viewport: 'mobile-iphone12', ...report };
      });
    }

    if (shouldRunTool('qr-code-generator')) {
      const qrDesktop = await desktop.newPage();
      await record('qr-code-generator desktop a11y baseline', async () => {
        await qrDesktop.goto(`${baseUrl}/qr-code-generator/`, { waitUntil: 'networkidle' });
        await waitVisible(qrDesktop, '#app-shell-header .cst-appbar');
        await waitVisible(qrDesktop, '#qr-text');
        await waitVisible(qrDesktop, '#download-btn');
        const report = await analyzePageA11y(qrDesktop);
        return { page: '/qr-code-generator/', viewport: 'desktop', ...report };
      });

      const qrMobile = await mobile.newPage();
      await record('qr-code-generator mobile a11y baseline', async () => {
        await qrMobile.goto(`${baseUrl}/qr-code-generator/`, { waitUntil: 'networkidle' });
        await waitVisible(qrMobile, '#app-shell-header .cst-appbar');
        await waitVisible(qrMobile, '#qr-text');
        await waitVisible(qrMobile, '#download-btn');
        const report = await analyzePageA11y(qrMobile);
        return { page: '/qr-code-generator/', viewport: 'mobile-iphone12', ...report };
      });
    }

    if (shouldRunTool('diff-checker-tool')) {
      const diffCheckerDesktop = await desktop.newPage();
      await record('diff-checker-tool desktop a11y baseline', async () => {
        await diffCheckerDesktop.goto(`${baseUrl}/diff-checker/`, { waitUntil: 'networkidle' });
        await waitVisible(diffCheckerDesktop, '#app-shell-header .cst-appbar');
        await waitVisible(diffCheckerDesktop, '#text1');
        await waitVisible(diffCheckerDesktop, '#text2');
        await waitVisible(diffCheckerDesktop, '#diff-result');
        const report = await analyzePageA11y(diffCheckerDesktop);
        return { page: '/diff-checker/', viewport: 'desktop', ...report };
      });

      const diffCheckerMobile = await mobile.newPage();
      await record('diff-checker-tool mobile a11y baseline', async () => {
        await diffCheckerMobile.goto(`${baseUrl}/diff-checker/`, { waitUntil: 'networkidle' });
        await waitVisible(diffCheckerMobile, '#app-shell-header .cst-appbar');
        await waitVisible(diffCheckerMobile, '#text1');
        await waitVisible(diffCheckerMobile, '#text2');
        await waitVisible(diffCheckerMobile, '#diff-result');
        const report = await analyzePageA11y(diffCheckerMobile);
        return { page: '/diff-checker/', viewport: 'mobile-iphone12', ...report };
      });
    }

    await desktop.close();
    await mobile.close();
  } finally {
    await browser.close();
  }

  const totalViolations = results.checks.reduce(
    (sum, check) => sum + (typeof check.violationsCount === 'number' ? check.violationsCount : 0),
    0
  );
  results.finishedAt = new Date().toISOString();
  results.totalViolations = totalViolations;
  results.runtimePassed = results.checks.every((check) => check.status === 'passed');
  results.passed = results.runtimePassed && (!failOnViolations || totalViolations === 0);

  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));

  console.log(
    `[a11y-baseline] mode=${results.mode} checks=${results.checks.length} totalViolations=${totalViolations} report=${path.relative(path.resolve('.'), reportPath)}`
  );

  if (failOnViolations && totalViolations > 0) {
    process.exitCode = 1;
  }
}

run().catch(async (error) => {
  results.finishedAt = new Date().toISOString();
  results.runtimePassed = false;
  results.passed = false;
  results.fatalError = error?.message || String(error);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.error(error);
  process.exitCode = 1;
});
