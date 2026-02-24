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

    const jsMinifierDesktop = await desktop.newPage();
    await record('js-minifier-tool desktop baseline', async () => {
      await jsMinifierDesktop.goto(`${baseUrl}/js-minifier-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(jsMinifierDesktop, '#app-shell-header .cst-shell__header');
      await waitVisible(jsMinifierDesktop, '#js-minifier-minify-btn');
      await waitVisible(jsMinifierDesktop, '#js-minifier-input');
      await waitVisible(jsMinifierDesktop, '#js-minifier-output');
      const shot = await screenshot(jsMinifierDesktop, 'js-minifier-tool-desktop.png');

      const optionCount = await jsMinifierDesktop.$$eval('.js-minifier-options .c-checkbox-item', (els) => els.length);
      return { screenshots: [shot], observations: { optionCount } };
    });

    const jsMinifierMobile = await mobile.newPage();
    await record('js-minifier-tool mobile baseline', async () => {
      await jsMinifierMobile.goto(`${baseUrl}/js-minifier-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(jsMinifierMobile, '#app-shell-header .cst-shell__header');
      await waitVisible(jsMinifierMobile, '#js-minifier-minify-btn');
      await waitVisible(jsMinifierMobile, '#js-minifier-input');
      const shot = await screenshot(jsMinifierMobile, 'js-minifier-tool-mobile.png');
      return { screenshots: [shot] };
    });

    const base64Desktop = await desktop.newPage();
    await record('base64-converter-tool desktop baseline', async () => {
      await base64Desktop.goto(`${baseUrl}/base64-converter-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(base64Desktop, '#app-shell-header .cst-shell__header');
      await waitVisible(base64Desktop, '#base64converter-mode');
      await waitVisible(base64Desktop, '#base64converter-input');
      await waitVisible(base64Desktop, '#base64converter-convert');
      const shot = await screenshot(base64Desktop, 'base64-converter-tool-desktop.png');
      const selectCount = await base64Desktop.$$eval('.b64-settings-panel select', (els) => els.length);
      return { screenshots: [shot], observations: { selectCount } };
    });

    const base64Mobile = await mobile.newPage();
    await record('base64-converter-tool mobile baseline', async () => {
      await base64Mobile.goto(`${baseUrl}/base64-converter-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(base64Mobile, '#app-shell-header .cst-shell__header');
      await waitVisible(base64Mobile, '#base64converter-mode');
      await waitVisible(base64Mobile, '#base64converter-input');
      const shot = await screenshot(base64Mobile, 'base64-converter-tool-mobile.png');
      return { screenshots: [shot] };
    });

    const jwtBuilderDesktop = await desktop.newPage();
    await record('jwt-builder-tool desktop baseline', async () => {
      await jwtBuilderDesktop.goto(`${baseUrl}/jwt-builder-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(jwtBuilderDesktop, '#app-shell-header .cst-shell__header');
      await waitVisible(jwtBuilderDesktop, '#jwtForm');
      await waitVisible(jwtBuilderDesktop, '#buildJwtBtn');
      await waitVisible(jwtBuilderDesktop, '#result');
      const shot = await screenshot(jwtBuilderDesktop, 'jwt-builder-tool-desktop.png');
      const sectionCount = await jwtBuilderDesktop.$$eval('.jwt-builder-section', (els) => els.length);
      return { screenshots: [shot], observations: { sectionCount } };
    });

    const jwtBuilderMobile = await mobile.newPage();
    await record('jwt-builder-tool mobile baseline', async () => {
      await jwtBuilderMobile.goto(`${baseUrl}/jwt-builder-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(jwtBuilderMobile, '#app-shell-header .cst-shell__header');
      await waitVisible(jwtBuilderMobile, '#jwtForm');
      await waitVisible(jwtBuilderMobile, '#buildJwtBtn');
      const shot = await screenshot(jwtBuilderMobile, 'jwt-builder-tool-mobile.png');
      return { screenshots: [shot] };
    });

    const jwtDecoderDesktop = await desktop.newPage();
    await record('jwt-decoder-tool desktop baseline', async () => {
      await jwtDecoderDesktop.goto(`${baseUrl}/jwt-decoder-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(jwtDecoderDesktop, '#app-shell-header .cst-shell__header');
      await waitVisible(jwtDecoderDesktop, '#jwtInputToken');
      await waitVisible(jwtDecoderDesktop, '#jwtSecretKey');
      await waitVisible(jwtDecoderDesktop, '#jwtSignatureStatus');
      const shot = await screenshot(jwtDecoderDesktop, 'jwt-decoder-tool-desktop.png');
      const tabCount = await jwtDecoderDesktop.$$eval('.jwt-decoder-tab', (els) => els.length);
      return { screenshots: [shot], observations: { tabCount } };
    });

    const jwtDecoderMobile = await mobile.newPage();
    await record('jwt-decoder-tool mobile baseline', async () => {
      await jwtDecoderMobile.goto(`${baseUrl}/jwt-decoder-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(jwtDecoderMobile, '#app-shell-header .cst-shell__header');
      await waitVisible(jwtDecoderMobile, '#jwtInputToken');
      await waitVisible(jwtDecoderMobile, '#jwtSecretKey');
      const shot = await screenshot(jwtDecoderMobile, 'jwt-decoder-tool-mobile.png');
      return { screenshots: [shot] };
    });

    const jsonFormatterDesktop = await desktop.newPage();
    await record('json-formatter-tool desktop baseline', async () => {
      await jsonFormatterDesktop.goto(`${baseUrl}/json-formatter-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(jsonFormatterDesktop, '#app-shell-header .cst-shell__header');
      await waitVisible(jsonFormatterDesktop, '#formatJsonBtn');
      await waitVisible(jsonFormatterDesktop, '#jsonErrorStatus');
      await waitVisible(jsonFormatterDesktop, '#treeView');
      const shot = await screenshot(jsonFormatterDesktop, 'json-formatter-tool-desktop.png');
      const tabCount = await jsonFormatterDesktop.$$eval('.jsonf-tab', (els) => els.length);
      return { screenshots: [shot], observations: { tabCount } };
    });

    const jsonFormatterMobile = await mobile.newPage();
    await record('json-formatter-tool mobile baseline', async () => {
      await jsonFormatterMobile.goto(`${baseUrl}/json-formatter-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(jsonFormatterMobile, '#app-shell-header .cst-shell__header');
      await waitVisible(jsonFormatterMobile, '#formatJsonBtn');
      await waitVisible(jsonFormatterMobile, '#treeView');
      const shot = await screenshot(jsonFormatterMobile, 'json-formatter-tool-mobile.png');
      return { screenshots: [shot] };
    });

    const cssMinifierDesktop = await desktop.newPage();
    await record('css-minifier-tool desktop baseline', async () => {
      await cssMinifierDesktop.goto(`${baseUrl}/css-minifier-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(cssMinifierDesktop, '#app-shell-header .cst-shell__header');
      await waitVisible(cssMinifierDesktop, '#css-minifier-input');
      await waitVisible(cssMinifierDesktop, '#css-minifier-output');
      await waitVisible(cssMinifierDesktop, '#minify-btn');
      const shot = await screenshot(cssMinifierDesktop, 'css-minifier-tool-desktop.png');
      const optionCount = await cssMinifierDesktop.$$eval('.cssm-checkbox-item', (els) => els.length);
      return { screenshots: [shot], observations: { optionCount } };
    });

    const cssMinifierMobile = await mobile.newPage();
    await record('css-minifier-tool mobile baseline', async () => {
      await cssMinifierMobile.goto(`${baseUrl}/css-minifier-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(cssMinifierMobile, '#app-shell-header .cst-shell__header');
      await waitVisible(cssMinifierMobile, '#css-minifier-input');
      await waitVisible(cssMinifierMobile, '#minify-btn');
      const shot = await screenshot(cssMinifierMobile, 'css-minifier-tool-mobile.png');
      return { screenshots: [shot] };
    });

    const textAnalyzerDesktop = await desktop.newPage();
    await record('text-analyzer-tool desktop baseline', async () => {
      await textAnalyzerDesktop.goto(`${baseUrl}/text-analyzer-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(textAnalyzerDesktop, '#app-shell-header .cst-shell__header');
      await waitVisible(textAnalyzerDesktop, '#textInput');
      await waitVisible(textAnalyzerDesktop, '#wordFrequencyChart');
      await waitVisible(textAnalyzerDesktop, '#load-sample');
      const shot = await screenshot(textAnalyzerDesktop, 'text-analyzer-tool-desktop.png');
      const statCount = await textAnalyzerDesktop.$$eval('.ta-stats-panel .ta-stat-item', (els) => els.length);
      return { screenshots: [shot], observations: { statCount } };
    });

    const textAnalyzerMobile = await mobile.newPage();
    await record('text-analyzer-tool mobile baseline', async () => {
      await textAnalyzerMobile.goto(`${baseUrl}/text-analyzer-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(textAnalyzerMobile, '#app-shell-header .cst-shell__header');
      await waitVisible(textAnalyzerMobile, '#textInput');
      await waitVisible(textAnalyzerMobile, '#wordFrequencyChart');
      const shot = await screenshot(textAnalyzerMobile, 'text-analyzer-tool-mobile.png');
      return { screenshots: [shot] };
    });

    const qrDesktop = await desktop.newPage();
    await record('qr-code-generator desktop baseline', async () => {
      await qrDesktop.goto(`${baseUrl}/qr-code-generator/`, { waitUntil: 'networkidle' });
      await waitVisible(qrDesktop, '#app-shell-header .cst-shell__header');
      await waitVisible(qrDesktop, '#qr-text');
      await waitVisible(qrDesktop, '#download-btn');
      await waitVisible(qrDesktop, '#qr-canvas');
      const shot = await screenshot(qrDesktop, 'qr-code-generator-desktop.png');
      const sliderCount = await qrDesktop.$$eval('.qr-tool__slider', (els) => els.length);
      return { screenshots: [shot], observations: { sliderCount } };
    });

    const qrMobile = await mobile.newPage();
    await record('qr-code-generator mobile baseline', async () => {
      await qrMobile.goto(`${baseUrl}/qr-code-generator/`, { waitUntil: 'networkidle' });
      await waitVisible(qrMobile, '#app-shell-header .cst-shell__header');
      await waitVisible(qrMobile, '#qr-text');
      await waitVisible(qrMobile, '#download-btn');
      await waitVisible(qrMobile, '#qr-canvas');
      const shot = await screenshot(qrMobile, 'qr-code-generator-mobile.png');
      return { screenshots: [shot] };
    });

    const diffCheckerDesktop = await desktop.newPage();
    await record('diff-checker-tool desktop baseline', async () => {
      await diffCheckerDesktop.goto(`${baseUrl}/diff-checker-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(diffCheckerDesktop, '#app-shell-header .cst-shell__header');
      await waitVisible(diffCheckerDesktop, '#text1');
      await waitVisible(diffCheckerDesktop, '#text2');
      await waitVisible(diffCheckerDesktop, '#compare-button');
      await waitVisible(diffCheckerDesktop, '#diff-result');
      const shot = await screenshot(diffCheckerDesktop, 'diff-checker-tool-desktop.png');
      const navButtonCount = await diffCheckerDesktop.$$eval('.diff-navigation .c-button', (els) => els.length);
      return { screenshots: [shot], observations: { navButtonCount } };
    });

    const diffCheckerMobile = await mobile.newPage();
    await record('diff-checker-tool mobile baseline', async () => {
      await diffCheckerMobile.goto(`${baseUrl}/diff-checker-tool/`, { waitUntil: 'networkidle' });
      await waitVisible(diffCheckerMobile, '#app-shell-header .cst-shell__header');
      await waitVisible(diffCheckerMobile, '#text1');
      await waitVisible(diffCheckerMobile, '#text2');
      await waitVisible(diffCheckerMobile, '#compare-button');
      await waitVisible(diffCheckerMobile, '#diff-result');
      const shot = await screenshot(diffCheckerMobile, 'diff-checker-tool-mobile.png');
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
