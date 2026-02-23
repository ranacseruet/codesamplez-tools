import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:8080';
const outDir = path.resolve('qa-artifacts', 'visual-baselines', 'phase-d-foundation');
const resultsPath = path.join(outDir, 'phase-d-foundation-visual-results.json');

const results = {
  startedAt: new Date().toISOString(),
  baseUrl,
  suite: 'phase-d-foundation-visual-baseline',
  checks: []
};

async function record(name, fn) {
  const start = Date.now();
  try {
    const details = await fn();
    results.checks.push({
      name,
      status: 'passed',
      durationMs: Date.now() - start,
      ...(details || {})
    });
  } catch (error) {
    results.checks.push({
      name,
      status: 'failed',
      durationMs: Date.now() - start,
      error: error?.message || String(error)
    });
    throw error;
  }
}

async function waitVisible(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

async function screenshot(page, filename) {
  const fullPath = path.join(outDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return path.relative(path.resolve('.'), fullPath);
}

async function run() {
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const mobile = await browser.newContext({ ...devices['iPhone 12'] });

    const rootDesktop = await desktop.newPage();
    await record('root-index desktop baseline', async () => {
      await rootDesktop.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
      await waitVisible(rootDesktop, '.cst-shell__header');
      await waitVisible(rootDesktop, '.main-container');
      await waitVisible(rootDesktop, '.tools-grid');

      const shot = await screenshot(rootDesktop, 'root-index-desktop.png');
      const cardCount = await rootDesktop.$$eval('.tool-card', (els) => els.length);
      return { screenshots: [shot], observations: { cardCount } };
    });

    const rootMobile = await mobile.newPage();
    await record('root-index mobile baseline', async () => {
      await rootMobile.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
      await waitVisible(rootMobile, '.cst-shell__header');
      await waitVisible(rootMobile, '.main-container');
      const shot = await screenshot(rootMobile, 'root-index-mobile.png');
      return { screenshots: [shot] };
    });

    const converterDesktop = await desktop.newPage();
    await record('data-format-converter desktop baseline', async () => {
      await converterDesktop.goto(`${baseUrl}/data-format-converter/`, { waitUntil: 'networkidle' });
      await waitVisible(converterDesktop, '#app-shell-header .cst-shell__header');
      await waitVisible(converterDesktop, '#inputText');
      await waitVisible(converterDesktop, '#outputText');
      const shot = await screenshot(converterDesktop, 'data-format-converter-desktop.png');

      const buttonLabels = await converterDesktop.$$eval(
        '.c-button',
        (buttons) => buttons.slice(0, 6).map((button) => button.textContent?.trim() || '')
      );
      return { screenshots: [shot], observations: { buttonLabels } };
    });

    const converterMobile = await mobile.newPage();
    await record('data-format-converter mobile baseline', async () => {
      await converterMobile.goto(`${baseUrl}/data-format-converter/`, { waitUntil: 'networkidle' });
      await waitVisible(converterMobile, '#app-shell-header .cst-shell__header');
      await waitVisible(converterMobile, '#inputText');
      const shot = await screenshot(converterMobile, 'data-format-converter-mobile.png');
      return { screenshots: [shot] };
    });

    await desktop.close();
    await mobile.close();
  } finally {
    await browser.close();
    results.finishedAt = new Date().toISOString();
    results.passed = results.checks.every((check) => check.status === 'passed');
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
