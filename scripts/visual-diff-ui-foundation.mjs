// @ts-check

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

/** @typedef {import('../types/qa-script-types').QaVisualBaselineResults} QaVisualBaselineResults */
/** @typedef {import('../types/qa-script-types').VisualDiffChangedItem} VisualDiffChangedItem */
/** @typedef {import('../types/qa-script-types').VisualDiffErrorItem} VisualDiffErrorItem */
/** @typedef {import('../types/qa-script-types').VisualDiffMissingItem} VisualDiffMissingItem */
/** @typedef {import('../types/qa-script-types').VisualDiffSummary} VisualDiffSummary */

const baselineResultsPath = path.resolve(
  process.env.QA_VISUAL_BASELINE_RESULTS_PATH ||
    path.join('baseline', 'qa-artifacts', 'visual-baselines', 'phase-d-foundation', 'phase-d-foundation-visual-results.json')
);
const currentResultsPath = path.resolve(
  process.env.QA_VISUAL_CURRENT_RESULTS_PATH ||
    path.join('qa-artifacts', 'visual-baselines', 'phase-d-foundation', 'pr', 'phase-d-foundation-visual-results.json')
);
const baselineRunDir = path.resolve(process.env.QA_VISUAL_BASELINE_RUN_DIR || 'baseline');
const currentRunDir = path.resolve(process.env.QA_VISUAL_CURRENT_RUN_DIR || '.');
const outDir = path.resolve(process.env.QA_VISUAL_DIFF_OUT_DIR || path.join('qa-artifacts', 'visual-diffs', 'phase-h-pr'));
const summaryPath = path.resolve(
  process.env.QA_VISUAL_DIFF_SUMMARY_PATH ||
    path.join(outDir, 'phase-h-pr-visual-diff-summary.json')
);
const markdownPath = path.resolve(
  process.env.QA_VISUAL_DIFF_SUMMARY_MARKDOWN ||
    path.join(outDir, 'phase-h-pr-visual-diff-summary.md')
);
const allowedChecks = new Set(
  (process.env.QA_VISUAL_ALLOWED_CHECKS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);
const baselineArtifactName = process.env.QA_VISUAL_BASELINE_ARTIFACT_NAME || '';
const baselineSourceSha = process.env.QA_VISUAL_BASELINE_SOURCE_SHA || '';

/**
 * @typedef {{
 *   name: string,
 *   relativePath: string,
 *   checkName: string,
 *   status: string
 * }} ScreenshotEntry
 */

const fileIndexCache = new Map();

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function fileHash(filePath) {
  const data = await fs.readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}

/**
 * @param {string} filePath
 * @returns {Promise<number>}
 */
async function fileSize(filePath) {
  const stat = await fs.stat(filePath);
  return stat.size;
}

/**
 * @param {number} current
 * @param {number} baseline
 * @returns {number}
 */
function formatPercent(current, baseline) {
  if (!Number.isFinite(baseline) || baseline === 0) {
    return 0;
  }
  return ((current - baseline) / baseline) * 100;
}

/**
 * @param {number} value
 * @returns {string}
 */
function toPercentLabel(value) {
  return `${Math.abs(value).toFixed(2)}`;
}

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} rootDir
 * @returns {Promise<Map<string, string[]>>}
 */
async function buildFileIndex(rootDir) {
  const cached = fileIndexCache.get(rootDir);
  if (cached) {
    return cached;
  }

  /** @type {Map<string, string[]>} */
  const filesByBasename = new Map();

  /**
   * @param {string} currentDir
   * @returns {Promise<void>}
   */
  async function visit(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const list = filesByBasename.get(entry.name) || [];
      list.push(fullPath);
      filesByBasename.set(entry.name, list);
    }
  }

  if (await exists(rootDir)) {
    await visit(rootDir);
  }

  fileIndexCache.set(rootDir, filesByBasename);
  return filesByBasename;
}

/**
 * @param {string} runDir
 * @param {string} relativeScreenshotPath
 * @returns {Promise<string>}
 */
export async function resolveScreenshotPath(runDir, relativeScreenshotPath) {
  const directPath = path.resolve(runDir, relativeScreenshotPath);
  if (await exists(directPath)) {
    return directPath;
  }

  const fileIndex = await buildFileIndex(runDir);
  const basename = path.basename(relativeScreenshotPath);
  const basenameMatches = fileIndex.get(basename) || [];

  if (basenameMatches.length === 1) {
    return basenameMatches[0];
  }

  if (basenameMatches.length > 1) {
    const normalizedRelativePath = relativeScreenshotPath.replace(/\\/g, '/');
    const suffixMatches = basenameMatches.filter((candidate) => candidate.replace(/\\/g, '/').endsWith(normalizedRelativePath));
    if (suffixMatches.length === 1) {
      return suffixMatches[0];
    }
  }

  throw new Error(
    `Unable to locate screenshot ${relativeScreenshotPath} under ${runDir}. ` +
      'Confirm the artifact download and screenshot staging steps completed successfully.'
  );
}

/**
 * @param {QaVisualBaselineResults} results
 * @param {Set<string>} selectedChecks
 * @returns {Map<string, ScreenshotEntry>}
 */
function screenshotEntries(results, selectedChecks) {
  /** @type {Map<string, ScreenshotEntry>} */
  const entries = new Map();
  for (const check of results.checks || []) {
    if (selectedChecks.size > 0 && !selectedChecks.has(check.name)) {
      continue;
    }
    for (const screenshot of check.screenshots || []) {
      const logicalName = path.basename(screenshot);
      entries.set(logicalName, {
        name: logicalName,
        relativePath: screenshot,
        checkName: check.name,
        status: check.status
      });
    }
  }
  return entries;
}

/**
 * @param {VisualDiffSummary} summaryData
 * @returns {'clean' | 'changes-detected' | 'incomplete'}
 */
export function determineVisualDiffStatus(summaryData) {
  if (summaryData.errors.length > 0 || summaryData.missingInBaseline > 0 || summaryData.missingInCurrent > 0) {
    return 'incomplete';
  }
  if (summaryData.changedScreenshots > 0) {
    return 'changes-detected';
  }
  return 'clean';
}

/**
 * @param {'clean' | 'changes-detected' | 'incomplete' | 'skipped'} status
 * @returns {string}
 */
function statusLabel(status) {
  if (status === 'clean') {
    return 'clean';
  }
  if (status === 'changes-detected') {
    return 'changes detected';
  }
  if (status === 'incomplete') {
    return 'incomplete';
  }
  return 'skipped';
}

/**
 * @param {VisualDiffSummary} summaryData
 * @param {Array<Omit<VisualDiffChangedItem, 'sizeDeltaPercent'> & { sizeDeltaPercent: string }>} changedItems
 * @param {VisualDiffMissingItem[]} missingItems
 * @returns {string}
 */
function makeMarkdown(summaryData, changedItems, missingItems) {
  const lines = [];
  lines.push('# Visual Diff Summary');
  lines.push('');
  lines.push(`- Status: ${statusLabel(summaryData.status || 'incomplete')}`);
  if (summaryData.selectedChecks && summaryData.selectedChecks.length > 0) {
    lines.push(`- Selected checks: ${summaryData.selectedChecks.length}`);
  }
  if (summaryData.baselineArtifactName) {
    lines.push(`- Baseline artifact: \`${summaryData.baselineArtifactName}\``);
  }
  if (summaryData.baselineSourceSha) {
    lines.push(`- Baseline source SHA: \`${summaryData.baselineSourceSha}\``);
  }
  lines.push(`- Baseline run: \`${summaryData.baselineResultsPath}\``);
  lines.push(`- Current run: \`${summaryData.currentResultsPath}\``);
  lines.push(`- Total screenshots: ${summaryData.totalScreenshots}`);
  lines.push(`- Matched: ${summaryData.matchedScreenshots}`);
  lines.push(`- Changed: ${summaryData.changedScreenshots}`);
  lines.push(`- Missing in baseline: ${summaryData.missingInBaseline}`);
  lines.push(`- Missing in current: ${summaryData.missingInCurrent}`);
  lines.push(`- Comparison errors: ${summaryData.errors.length}`);
  lines.push('');
  lines.push('## Changed screenshots');
  if (!changedItems.length) {
    lines.push('- None (report-only)');
  } else {
    for (const item of changedItems) {
      lines.push(`- ${item.name} (${item.checkName})`);
      lines.push(`  - Base hash: ${item.baselineHash.slice(0, 8)}...`);
      lines.push(`  - Current hash: ${item.currentHash.slice(0, 8)}...`);
      lines.push(`  - Size: ${item.baselineBytes} -> ${item.currentBytes} bytes`);
      lines.push(`  - Size delta: ${item.sizeDeltaSign}${item.sizeDeltaBytes} (${item.sizeDeltaPercent}%)`);
    }
  }
  lines.push('');
  lines.push('## Comparison errors');
  if (!summaryData.errors.length) {
    lines.push('- None');
  } else {
    for (const item of summaryData.errors) {
      lines.push(`- ${item.name}: ${item.message}`);
    }
  }
  lines.push('');
  lines.push('## Missing screenshots');
  if (!missingItems.length) {
    lines.push('- None');
  } else {
    for (const item of missingItems) {
      lines.push(`- ${item.name}: ${item.reason}`);
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * @param {string} filePath
 * @returns {Promise<QaVisualBaselineResults>}
 */
async function loadResults(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    const label = filePath === baselineResultsPath ? 'baseline' : 'current';
    throw new Error(
      `Missing ${label} visual results file at ${filePath}. ` +
        `Confirm the screenshot capture or baseline artifact download step completed successfully.`
    );
  }
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

/**
 * @param {{
 *   baselineResultsPath?: string,
 *   currentResultsPath?: string,
 *   baselineRunDir?: string,
 *   currentRunDir?: string,
 *   allowedChecks?: Iterable<string>,
 *   baselineArtifactName?: string,
 *   baselineSourceSha?: string
 * }} [options]
 * @returns {Promise<{ summary: VisualDiffSummary, markdown: string }>}
 */
export async function generateVisualDiffReport(options = {}) {
  const selectedChecks = new Set(options.allowedChecks || allowedChecks);
  const resolvedBaselineResultsPath = path.resolve(options.baselineResultsPath || baselineResultsPath);
  const resolvedCurrentResultsPath = path.resolve(options.currentResultsPath || currentResultsPath);
  const resolvedBaselineRunDir = path.resolve(options.baselineRunDir || baselineRunDir);
  const resolvedCurrentRunDir = path.resolve(options.currentRunDir || currentRunDir);

  /** @type {VisualDiffSummary} */
  const summary = {
    startedAt: new Date().toISOString(),
    baselineResultsPath: resolvedBaselineResultsPath,
    currentResultsPath: resolvedCurrentResultsPath,
    totalScreenshots: 0,
    matchedScreenshots: 0,
    changedScreenshots: 0,
    missingInBaseline: 0,
    missingInCurrent: 0,
    skipped: 0,
    deltas: [],
    changed: [],
    missing: [],
    errors: [],
    selectedChecks: [...selectedChecks],
    baselineArtifactName: options.baselineArtifactName || baselineArtifactName || undefined,
    baselineSourceSha: options.baselineSourceSha || baselineSourceSha || undefined,
    baselineAvailable: true
  };

  const [baseResults, currentResults] = await Promise.all([
    loadResults(resolvedBaselineResultsPath),
    loadResults(resolvedCurrentResultsPath)
  ]);

  const baselineEntries = screenshotEntries(baseResults, selectedChecks);
  const currentEntries = screenshotEntries(currentResults, selectedChecks);

  const screenshotSet = new Set([...baselineEntries.keys(), ...currentEntries.keys()]);
  summary.totalScreenshots = screenshotSet.size;

  for (const screenshot of screenshotSet) {
    const base = baselineEntries.get(screenshot);
    const current = currentEntries.get(screenshot);

    if (!base) {
      summary.missingInBaseline += 1;
      summary.missing.push({ name: screenshot, reason: 'missing baseline capture', checkName: current?.checkName });
      continue;
    }
    if (!current) {
      summary.missingInCurrent += 1;
      summary.missing.push({ name: screenshot, reason: 'missing current PR capture', checkName: base.checkName });
      continue;
    }

    let baseBytes = 0;
    let currentBytes = 0;
    let baseHash = '';
    let currentHash = '';
    try {
      const [basePath, currentPath] = await Promise.all([
        resolveScreenshotPath(resolvedBaselineRunDir, base.relativePath),
        resolveScreenshotPath(resolvedCurrentRunDir, current.relativePath)
      ]);
      [baseHash, currentHash] = await Promise.all([fileHash(basePath), fileHash(currentPath)]);
      [baseBytes, currentBytes] = await Promise.all([fileSize(basePath), fileSize(currentPath)]);
    } catch (error) {
      summary.skipped += 1;
      /** @type {VisualDiffErrorItem} */
      const errorRecord = {
        name: screenshot,
        checkName: current.checkName,
        status: 'error',
        message: error instanceof Error ? error.message : String(error)
      };
      summary.errors.push(errorRecord);
      summary.deltas.push(errorRecord);
      continue;
    }

    const sizeDeltaBytes = currentBytes - baseBytes;
    const sizeDeltaPercent = formatPercent(currentBytes, baseBytes);
    const sizeDeltaSign = sizeDeltaBytes >= 0 ? '+' : '';

    if (baseHash === currentHash) {
      summary.matchedScreenshots += 1;
      continue;
    }

    summary.changedScreenshots += 1;
    /** @type {VisualDiffChangedItem} */
    const record = {
      name: screenshot,
      checkName: current.checkName,
      baselineHash: baseHash,
      currentHash,
      baselineBytes: baseBytes,
      currentBytes,
      sizeDeltaBytes,
      sizeDeltaPercent: Number(sizeDeltaPercent.toFixed(2)),
      sizeDeltaSign,
      status: 'changed'
    };
    summary.changed.push(record);
  }

  summary.deltas = [...summary.changed, ...summary.errors, ...summary.missing].sort((a, b) => {
    const leftStatus = 'status' in a ? a.status : 'missing';
    const rightStatus = 'status' in b ? b.status : 'missing';
    if (leftStatus === rightStatus) {
      return a.name.localeCompare(b.name);
    }
    if (leftStatus === 'changed') {
      return -1;
    }
    if (leftStatus === 'error') {
      return rightStatus === 'changed' ? 1 : -1;
    }
    return 1;
  });

  summary.status = determineVisualDiffStatus(summary);
  summary.finishedAt = new Date().toISOString();
  summary.completed = true;

  const markdown = makeMarkdown(
    summary,
    summary.changed.map((change) => ({
      ...change,
      sizeDeltaPercent: toPercentLabel(change.sizeDeltaPercent),
      sizeDeltaSign: change.sizeDeltaSign || ''
    })),
    summary.missing.map((missing) => ({
      ...missing,
      reason: missing.reason
    }))
  );

  return { summary, markdown };
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const { summary, markdown } = await generateVisualDiffReport();
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  await fs.writeFile(markdownPath, markdown);

  if (summary.errors.length > 0) {
    throw new Error(`Visual diff comparison encountered ${summary.errors.length} screenshot read errors.`);
  }
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
