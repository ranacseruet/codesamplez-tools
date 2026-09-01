// @ts-check

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium, firefox, webkit } from 'playwright';
import {
  DIFF_CHECKER_WORKER_CHAR_THRESHOLD,
  JSON_FORMATTER_WORKER_CHAR_THRESHOLD,
  TEXT_ANALYZER_WORKER_CHAR_THRESHOLD
} from '../common/worker-thresholds.mjs';

/** @typedef {import('../types/qa-script-types').CrossBrowserCheck} CrossBrowserCheck */
/** @typedef {import('../types/qa-script-types').CrossBrowserResults} CrossBrowserResults */
/**
 * @typedef {{
 *   name: string,
 *   url: string,
 *   waits: string[],
 *   toolId?: string,
 *   workerPath?: string,
 *   exercise?: (page: import('playwright').Page) => Promise<Record<string, unknown>>
 * }} SignoffScenario
 */
/**
 * @typedef {{ id: number, hasResult: boolean, hasError: boolean }} WorkerProbeResponse
 */
/**
 * @typedef {{
 *   url: string,
 *   requests: { id?: number }[],
 *   responses: WorkerProbeResponse[]
 * }} WorkerProbeRecord
 */

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

/** @type {SignoffScenario[]} */
const scenarios = [
  {
    name: 'root-index',
    url: '/',
    waits: ['.cst-appbar', '.main-container', '.tools-grid']
  },
  {
    name: 'data-format-converter',
    url: '/data-format-converter/',
    waits: ['#app-shell-header .cst-shell__header', '#inputText', '#outputText']
  },
  {
    name: 'js-minifier-tool',
    url: '/js-minifier/',
    waits: ['#app-shell-header .cst-shell__header', '#js-minifier-minify-btn', '#js-minifier-input', '#js-minifier-output']
  },
  {
    name: 'diff-checker-tool',
    url: '/diff-checker/',
    waits: ['#app-shell-header .cst-shell__header', '#text1', '#text2', '#compare-button']
  },
  {
    name: 'text-analyzer-worker',
    toolId: 'text-analyzer-tool',
    url: '/text-analyzer/',
    waits: ['#app-shell-header .cst-shell__header', '#textInput', '#charCount', '#wordCount'],
    workerPath: '/text-analyzer/',
    exercise: runTextAnalyzerWorkerScenario
  },
  {
    name: 'diff-checker-worker',
    toolId: 'diff-checker-tool',
    url: '/diff-checker/',
    waits: ['#app-shell-header .cst-shell__header', '#text1', '#text2', '#compare-button'],
    workerPath: '/diff-checker/',
    exercise: runDiffCheckerWorkerScenario
  },
  {
    name: 'jwt-builder-tool',
    url: '/jwt-builder/',
    waits: ['#app-shell-header .cst-shell__header', '#jwtForm', '#jwt-algorithm', '#buildJwtBtn'],
    exercise: runJwtBuilderScenario
  },
  {
    name: 'json-formatter-worker',
    toolId: 'json-formatter-tool',
    url: '/json-formatter/',
    waits: ['#app-shell-header .cst-shell__header', '.jsonf-input-textarea', '#formatJsonBtn'],
    workerPath: '/json-formatter/',
    exercise: runJsonFormatterWorkerScenario
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
 * @param {SignoffScenario} scenario
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
 * @param {SignoffScenario} scenario
 * @returns {boolean}
 */
function shouldRunScenario(scenario) {
  return selectedTools.size === 0
    || selectedTools.has(scenario.name)
    || (scenario.toolId !== undefined && selectedTools.has(scenario.toolId));
}

/**
 * Install a test-only Worker wrapper before the page's application code runs.
 * It records request/response ids without changing the production runner or
 * disabling its fallback behavior.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<void>}
 */
async function installWorkerProbe(page) {
  await page.addInitScript(() => {
    const nativeWorker = globalThis.Worker;
    if (typeof nativeWorker !== 'function') {
      return;
    }

    const probeRecords = [];
    const probeGlobal = /** @type {Record<string, unknown>} */ (globalThis);
    probeGlobal.__CST_WORKER_PROBE__ = probeRecords;

    const ProbedWorker = new Proxy(nativeWorker, {
      construct(target, args) {
        const worker = Reflect.construct(target, args);
        const record = {
          url: new URL(String(args[0]), document.baseURI).href,
          requests: [],
          responses: []
        };
        probeRecords.push(record);

        const nativePostMessage = worker.postMessage.bind(worker);
        worker.postMessage = (message, ...transfer) => {
          record.requests.push({ id: message?.id });
          return nativePostMessage(message, ...transfer);
        };
        worker.addEventListener('message', (event) => {
          const data = event.data;
          record.responses.push({
            id: data?.id,
            hasResult: data?.result !== undefined,
            hasError: data?.error !== undefined
          });
        });

        return worker;
      }
    });

    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: ProbedWorker,
      writable: true
    });
  });
}

/**
 * @param {string} url
 * @param {string} publicPath
 * @returns {boolean}
 */
function isWorkerPath(url, publicPath) {
  try {
    return new URL(url).pathname.startsWith(publicPath);
  } catch {
    return false;
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {SignoffScenario} scenario
 * @returns {Promise<Record<string, unknown>>}
 */
async function runWorkerScenario(page, scenario) {
  if (!scenario.exercise || !scenario.workerPath) {
    throw new Error(`Worker scenario is missing its exercise or public path: ${scenario.name}`);
  }

  const workers = [];
  const onWorker = (worker) => workers.push({ worker, url: worker.url() });
  page.on('worker', onWorker);

  try {
    const observations = await scenario.exercise(page);
    const workerEntry = workers.find(({ url }) => isWorkerPath(url, scenario.workerPath));
    const workerUrl = workerEntry?.url;

    if (!workerUrl) {
      throw new Error(
        `No worker started from ${scenario.workerPath}; observed: ${workers.map(({ url }) => url).join(', ') || 'none'}`
      );
    }

    const workerPath = new URL(workerUrl).pathname;
    if (!workerPath.endsWith('.bundle.main.js')) {
      throw new Error(`Worker did not resolve to a bundled chunk: ${workerUrl}`);
    }

    const probeRecords = /** @type {WorkerProbeRecord[]} */ (await page.evaluate(() => {
      const probeGlobal = /** @type {Record<string, unknown>} */ (globalThis);
      return probeGlobal.__CST_WORKER_PROBE__ || [];
    }));
    const probeRecord = probeRecords.find(({ url }) => isWorkerPath(url, scenario.workerPath));
    const requestIds = new Set(probeRecord?.requests.map(({ id }) => id));
    const workerResponse = probeRecord?.responses.find(({ id, hasResult, hasError }) => (
      requestIds.has(id) && hasResult && !hasError
    ));
    if (!workerResponse) {
      throw new Error(
        `Worker at ${workerUrl} did not return a result response; observed: ${JSON.stringify(probeRecord || null)}`
      );
    }

    const workerLiveness = await workerEntry.worker.evaluate(() => 1);
    if (workerLiveness !== 1) {
      throw new Error(`Worker at ${workerUrl} did not remain evaluable after its result response`);
    }

    return { observations, workerUrl, workerResponseId: workerResponse.id };
  } finally {
    page.off('worker', onWorker);
  }
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<Record<string, unknown>>}
 */
async function runTextAnalyzerWorkerScenario(page) {
  const largeText = 'worker-check '.repeat(500);
  if (largeText.length <= TEXT_ANALYZER_WORKER_CHAR_THRESHOLD) {
    throw new Error('Text Analyzer regression input no longer exceeds its worker threshold');
  }

  await page.fill('#textInput', largeText);
  await page.waitForFunction((expectedCharCount) => {
    const charCount = document.getElementById('charCount');
    const wordCount = document.getElementById('wordCount');
    return charCount?.textContent === String(expectedCharCount) && wordCount?.textContent === '500';
  }, largeText.length);

  return {
    inputLength: largeText.length,
    charCount: await page.locator('#charCount').innerText(),
    wordCount: await page.locator('#wordCount').innerText()
  };
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<Record<string, unknown>>}
 */
async function runDiffCheckerWorkerScenario(page) {
  const repeatedLines = 'same line\n'.repeat(1400);
  const original = `${repeatedLines}original`;
  const modified = `${repeatedLines}modified`;
  const combinedInputLength = original.length + modified.length;
  if (combinedInputLength <= DIFF_CHECKER_WORKER_CHAR_THRESHOLD) {
    throw new Error('Diff Checker regression input no longer exceeds its worker threshold');
  }

  await page.fill('#text1', original);
  await page.fill('#text2', modified);
  await page.click('#compare-button');
  await page.waitForFunction(() => (
    document.querySelectorAll('#diff-result .diff-line').length >= 2
    && document.querySelectorAll('#diff-result .diff-added, #diff-result .diff-removed').length >= 2
  ));

  return {
    inputLength: combinedInputLength,
    diffLineCount: await page.locator('#diff-result .diff-line').count(),
    changedLineCount: await page.locator('#diff-result .diff-added, #diff-result .diff-removed').count()
  };
}

/**
 * @param {import('playwright').Page} page
 * @param {'empty'|'populated'} state
 * @returns {Promise<Record<string, number>>}
 */
async function assertJsonFormatterLayout(page, state) {
  const layout = await page.evaluate(() => {
    const readBox = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;

      const rect = element.getBoundingClientRect();
      return {
        borderBottom: Number.parseFloat(getComputedStyle(element).borderBottomWidth) || 0,
        bottom: rect.bottom,
        display: getComputedStyle(element).display,
        height: rect.height,
      };
    };

    return {
      code: readBox('#treeView .jsonf-code-output'),
      empty: readBox('#jsonfEmptyState'),
      footer: readBox('.jsonf-output-footer'),
      input: readBox('.jsonf-input-textarea'),
      panel: readBox('.jsonf-output-panel'),
    };
  });

  const { code, empty, footer, input, panel } = layout;
  if (!code || !empty || !footer || !input || !panel) {
    throw new Error(`JSON Formatter ${state} layout is missing expected elements`);
  }

  const activeOutput = state === 'empty' ? empty : code;
  const panelContentBottom = panel.bottom - panel.borderBottom;
  const footerPanelGap = Math.abs(footer.bottom - panelContentBottom);
  const inputOutputGap = Math.abs(input.height - activeOutput.height);

  if (footerPanelGap > 1) {
    throw new Error(
      `JSON Formatter ${state} footer is ${footerPanelGap.toFixed(2)}px above the panel bottom`,
    );
  }

  if (inputOutputGap > 1) {
    throw new Error(
      `JSON Formatter ${state} output well differs from input well by ${inputOutputGap.toFixed(2)}px`,
    );
  }

  if (state === 'empty' && (empty.display === 'none' || code.display !== 'none')) {
    throw new Error('JSON Formatter empty state visibility is incorrect');
  }

  if (state === 'populated' && (empty.display !== 'none' || code.display === 'none')) {
    throw new Error('JSON Formatter populated state visibility is incorrect');
  }

  return {
    footerPanelGapPx: Number(footerPanelGap.toFixed(2)),
    inputWellHeightPx: Number(input.height.toFixed(2)),
    outputWellHeightPx: Number(activeOutput.height.toFixed(2)),
  };
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<Record<string, unknown>>}
 */
async function runJsonFormatterWorkerScenario(page) {
  const desktopInitialLayout = await assertJsonFormatterLayout(page, 'empty');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileInitialLayout = await assertJsonFormatterLayout(page, 'empty');
  await page.setViewportSize({ width: 1440, height: 900 });
  const payload = 'worker-regression-value-'.repeat(3000);
  const input = JSON.stringify({ z: 1, payload });
  if (input.length <= JSON_FORMATTER_WORKER_CHAR_THRESHOLD) {
    throw new Error('JSON Formatter regression input no longer exceeds its worker threshold');
  }

  await page.fill('.jsonf-input-textarea', input);
  await page.click('#formatJsonBtn');
  await page.waitForFunction(() => {
    const output = document.querySelector('#plainView .jsonf-plain-textarea');
    return output instanceof HTMLTextAreaElement
      && output.value.includes('"payload"')
      && output.value.length > 50_000;
  });

  const output = await page.locator('#plainView .jsonf-plain-textarea').inputValue();
  const copyOutputDisabled = await page.locator('#copyOutputBtn').isDisabled();
  if (copyOutputDisabled) {
    throw new Error('JSON Formatter did not enable Copy Output after formatting');
  }
  const initialWorkerCount = await page.evaluate(() => {
    const probe = /** @type {{ url: string }[] | undefined} */ (globalThis.__CST_WORKER_PROBE__);
    return probe?.length ?? 0;
  });
  if (initialWorkerCount !== 1) {
    throw new Error(`JSON Formatter started ${initialWorkerCount} workers before schema validation was activated`);
  }

  // Exercise every schema result family in the real browser. The disclosure is
  // collapsed by default, and schema work is separate from the formatter
  // worker tested above.
  await page.locator('.jsonf-schema-disclosure > summary').click();
  const exerciseSchemaStates = async () => {
    await page.fill('#jsonSchemaInput', JSON.stringify({
      $schema: 'https://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' } }
    }));
    await page.fill('.jsonf-input-textarea', '{"name":"Ada"}');
    await page.click('#formatJsonBtn');
    await page.waitForFunction(() => document.querySelector('#jsonSchemaStatus')?.textContent?.includes('Valid against Draft 7'));
    const valid = await page.locator('#jsonSchemaStatus').innerText();

    await page.fill('.jsonf-input-textarea', '{"name":42}');
    await page.click('#formatJsonBtn');
    await page.waitForFunction(() => document.querySelector('#jsonSchemaStatus')?.textContent?.includes('Invalid data at /name'));
    const violating = await page.locator('#jsonSchemaStatus').innerText();

    await page.fill('#jsonSchemaInput', '{"type":');
    await page.click('#formatJsonBtn');
    await page.waitForFunction(() => document.querySelector('#jsonSchemaStatus')?.textContent?.includes('Invalid schema:'));
    const malformed = await page.locator('#jsonSchemaStatus').innerText();

    const externalRefUrl = 'https://example.invalid/codesamplez-schema.json';
    const externalRequests = [];
    const captureExternalRequest = (request) => {
      if (request.url() === externalRefUrl) externalRequests.push(request.url());
    };
    page.on('request', captureExternalRequest);
    await page.fill('#jsonSchemaInput', JSON.stringify({ $ref: externalRefUrl }));
    await page.click('#formatJsonBtn');
    await page.waitForFunction(() => document.querySelector('#jsonSchemaStatus')?.textContent?.includes('External $ref'));
    page.off('request', captureExternalRequest);
    if (externalRequests.length > 0) {
      throw new Error('JSON Formatter attempted to fetch an external JSON Schema reference');
    }

    return { valid, violating, malformed, externalRefRequests: externalRequests.length };
  };

  const desktopSchema = await exerciseSchemaStates();
  const schemaWorkerCount = await page.evaluate(() => {
    const probe = /** @type {{ url: string }[] | undefined} */ (globalThis.__CST_WORKER_PROBE__);
    return probe?.length ?? 0;
  });
  if (schemaWorkerCount <= initialWorkerCount) {
    throw new Error('JSON Formatter did not lazy-load a dedicated schema worker after activation');
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileSchema = await exerciseSchemaStates();

  // Terminate the memoized runner and remove Worker only for this final probe;
  // production code must surface unavailable rather than validate on the main
  // thread when the worker cannot be constructed.
  await page.evaluate(() => {
    const formatter = globalThis.jsonFormatter;
    formatter?.lazySchemaRunner?.terminate?.();
    globalThis.Worker = undefined;
  });
  await page.fill('#jsonSchemaInput', '{"type":"object"}');
  await page.click('#formatJsonBtn');
  await page.waitForFunction(() => document.querySelector('#jsonSchemaStatus')?.textContent?.includes('unavailable'));
  const unavailableSchemaStatus = await page.locator('#jsonSchemaStatus').innerText();

  await page.setViewportSize({ width: 1440, height: 900 });
  const populatedLayout = await assertJsonFormatterLayout(page, 'populated');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('.jsonf-tab[data-view="tree"]');
  await page.waitForFunction(() => document.querySelector('#treeView')?.classList.contains('active'));
  const mobilePopulatedLayout = await assertJsonFormatterLayout(page, 'populated');

  return {
    inputLength: input.length,
    layout: {
      desktop: {
        initial: desktopInitialLayout,
        populated: populatedLayout,
      },
      mobile: {
        initial: mobileInitialLayout,
        populated: mobilePopulatedLayout,
      },
    },
    outputLength: output.length,
    copyOutputDisabled,
    workers: {
      initial: initialWorkerCount,
      afterSchemaActivation: schemaWorkerCount
    },
    schema: {
      desktop: desktopSchema,
      mobile: {
        ...mobileSchema,
        unavailable: unavailableSchemaStatus
      }
    }
  };
}

/**
 * Exercise both signing algorithms in a real browser. The key pair is
 * generated in-page so the scenario never embeds or transports a private key
 * outside the browser context.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<Record<string, unknown>>}
 */
async function runJwtBuilderScenario(page) {
  await page.fill('#key', 'cross-browser-hs256-secret');
  await page.selectOption('#jwt-algorithm', 'HS256');
  await page.click('#buildJwtBtn');
  await page.waitForFunction(() => {
    const result = document.getElementById('result');
    return Boolean(result?.textContent?.trim());
  });

  const hsToken = await page.locator('#result').textContent();
  if (!hsToken) {
    throw new Error('JWT Builder did not produce an HS256 token');
  }
  const hsHeader = decodeJwtPart(hsToken, 0);
  if (hsHeader.alg !== 'HS256') {
    throw new Error(`JWT Builder emitted ${hsHeader.alg} for the HS256 selection`);
  }

  const keyMaterial = await page.evaluate(async () => {
    const pair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['sign', 'verify']
    );
    const privateKey = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
    const publicKey = await crypto.subtle.exportKey('spki', pair.publicKey);
    const toPem = (label, data) => {
      const bytes = new Uint8Array(data);
      let binary = '';
      for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index]);
      }
      const base64 = btoa(binary);
      const lines = base64.match(/.{1,64}/g)?.join('\n') || '';
      return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
    };

    return {
      privateKeyPem: toPem('PRIVATE KEY', privateKey),
      publicKeyPem: toPem('PUBLIC KEY', publicKey),
      publicKeyBytes: Array.from(new Uint8Array(publicKey))
    };
  });

  await page.selectOption('#jwt-algorithm', 'RS256');
  await page.waitForSelector('#jwt-builder-rs256-key-panel:not([hidden])');
  await page.fill('#rsa-private-key', keyMaterial.privateKeyPem);
  await page.click('#buildJwtBtn');
  await page.waitForFunction(() => {
    const result = document.getElementById('result');
    return Boolean(result?.textContent?.trim());
  });

  const rsToken = await page.locator('#result').textContent();
  if (!rsToken) {
    throw new Error('JWT Builder did not produce an RS256 token');
  }
  const rsHeader = decodeJwtPart(rsToken, 0);
  if (rsHeader.alg !== 'RS256') {
    throw new Error(`JWT Builder emitted ${rsHeader.alg} for the RS256 selection`);
  }

  const rsSignatureVerified = await page.evaluate(async ({ token, publicKeyBytes }) => {
    const [header, payload, signature] = token.split('.');
    const base64UrlToBytes = (value) => {
      const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    };
    const publicKey = await crypto.subtle.importKey(
      'spki',
      new Uint8Array(publicKeyBytes),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    return crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      base64UrlToBytes(signature),
      new TextEncoder().encode(`${header}.${payload}`)
    );
  }, { token: rsToken, publicKeyBytes: keyMaterial.publicKeyBytes });
  if (!rsSignatureVerified) {
    throw new Error('JWT Builder produced an RS256 signature that did not verify');
  }

  await page.fill('#rsa-private-key', keyMaterial.publicKeyPem);
  await page.click('#buildJwtBtn');
  await page.waitForFunction(() => {
    const error = document.getElementById('jwt-builder-error-status');
    const result = document.getElementById('result');
    return Boolean(error?.textContent?.toLowerCase().includes('public')) && !result?.textContent?.trim();
  });
  const publicKeyError = await page.locator('#jwt-builder-error-status').innerText();

  await page.fill('#rsa-private-key', 'not a PEM key');
  await page.click('#buildJwtBtn');
  await page.waitForFunction(() => {
    const error = document.getElementById('jwt-builder-error-status');
    const result = document.getElementById('result');
    return Boolean(error?.textContent?.includes('PKCS#8')) && !result?.textContent?.trim();
  });
  const malformedKeyError = await page.locator('#jwt-builder-error-status').innerText();

  return {
    hsAlgorithm: hsHeader.alg,
    rsAlgorithm: rsHeader.alg,
    rsSignatureVerified,
    publicKeyError,
    malformedKeyError
  };
}

/**
 * @param {string} token
 * @param {number} index
 * @returns {Record<string, unknown>}
 */
function decodeJwtPart(token, index) {
  const segment = token.split('.')[index];
  if (!segment) {
    throw new Error(`JWT is missing segment ${index}`);
  }
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (segment.length % 4)) % 4);
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
}

/**
 * @param {string} browserName
 * @param {import('playwright').BrowserType} browserType
 * @param {SignoffScenario} scenario
 * @returns {Promise<void>}
 */
async function runScenario(browserName, browserType, scenario) {
  const browser = await browserType.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    if (scenario.exercise && scenario.workerPath) {
      await installWorkerProbe(page);
    }
    await record(browserName, scenario, async () => {
      await page.goto(`${baseUrl}${scenario.url}`, { waitUntil: 'networkidle' });
      for (const selector of scenario.waits) {
        await waitVisible(page, selector);
      }
      const exerciseDetails = scenario.exercise
        ? (scenario.workerPath
          ? await runWorkerScenario(page, scenario)
          : await scenario.exercise(page))
        : {};
      return {
        url: scenario.url,
        title: await page.title(),
        ...exerciseDetails
      };
    });
    await context.close();
  } finally {
    await browser.close();
  }
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  if (selectedTools.size > 0 && scenarios.every((scenario) => !shouldRunScenario(scenario))) {
    throw new Error(`No cross-browser scenarios matched the requested tools: ${Array.from(selectedTools).join(', ')}`);
  }

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
