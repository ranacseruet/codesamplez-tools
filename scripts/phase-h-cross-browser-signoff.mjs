import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:8080';
const outDir = path.resolve(process.env.QA_CROSS_BROWSER_OUT_DIR || path.join('qa-artifacts', 'cross-browser-signoff'));
const resultsPath = path.resolve(
  process.env.QA_CROSS_BROWSER_RESULTS_FILE || path.join(outDir, 'phase-h-cross-browser-signoff-results.json')
);
const markdownPath = path.resolve(
  process.env.QA_CROSS_BROWSER_RESULTS_MARKDOWN || path.join(outDir, 'phase-h-cross-browser-signoff-results.md')
);

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

const results = {
  startedAt: new Date().toISOString(),
  baseUrl,
  suite: 'phase-h-cross-browser-signoff',
  checks: []
};

async function waitVisible(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

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

function makeMarkdown(summary) {
  const lines = [];
  lines.push('# Phase H Cross-Browser Signoff');
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
    for (const scenario of scenarios) {
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
