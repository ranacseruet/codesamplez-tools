import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:8080';
const failOnViolations = process.env.QA_A11Y_FAIL_ON_VIOLATIONS === '1';
const outDir = path.resolve('qa-artifacts', 'a11y-reports', 'phase-d-foundation');
const reportPath = path.join(outDir, 'phase-d-foundation-a11y-results.json');

const results = {
  startedAt: new Date().toISOString(),
  baseUrl,
  suite: 'phase-d-foundation-a11y-baseline',
  mode: failOnViolations ? 'fail-on-violations' : 'report-only',
  checks: []
};

async function waitVisible(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

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

async function run() {
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const mobile = await browser.newContext({ ...devices['iPhone 12'] });

    const rootDesktop = await desktop.newPage();
    await record('root-index desktop a11y baseline', async () => {
      await rootDesktop.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
      await waitVisible(rootDesktop, '.cst-shell__header');
      await waitVisible(rootDesktop, '.main-container');
      const report = await analyzePageA11y(rootDesktop);
      return { page: '/', viewport: 'desktop', ...report };
    });

    const rootMobile = await mobile.newPage();
    await record('root-index mobile a11y baseline', async () => {
      await rootMobile.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
      await waitVisible(rootMobile, '.cst-shell__header');
      await waitVisible(rootMobile, '.main-container');
      const report = await analyzePageA11y(rootMobile);
      return { page: '/', viewport: 'mobile-iphone12', ...report };
    });

    const converterDesktop = await desktop.newPage();
    await record('data-format-converter desktop a11y baseline', async () => {
      await converterDesktop.goto(`${baseUrl}/data-format-converter/`, { waitUntil: 'networkidle' });
      await waitVisible(converterDesktop, '#app-shell-header .cst-shell__header');
      await waitVisible(converterDesktop, '#inputText');
      const report = await analyzePageA11y(converterDesktop);
      return { page: '/data-format-converter/', viewport: 'desktop', ...report };
    });

    const converterMobile = await mobile.newPage();
    await record('data-format-converter mobile a11y baseline', async () => {
      await converterMobile.goto(`${baseUrl}/data-format-converter/`, { waitUntil: 'networkidle' });
      await waitVisible(converterMobile, '#app-shell-header .cst-shell__header');
      await waitVisible(converterMobile, '#inputText');
      const report = await analyzePageA11y(converterMobile);
      return { page: '/data-format-converter/', viewport: 'mobile-iphone12', ...report };
    });

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
