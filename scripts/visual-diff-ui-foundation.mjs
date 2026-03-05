import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

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

const summary = {
  startedAt: new Date().toISOString(),
  baselineResultsPath,
  currentResultsPath,
  totalScreenshots: 0,
  matchedScreenshots: 0,
  changedScreenshots: 0,
  missingInBaseline: 0,
  missingInCurrent: 0,
  skipped: 0,
  deltas: [],
  changed: [],
  missing: [],
  errors: []
};

function toAbsoluteScreenshotPath(runDir, relativeScreenshotPath) {
  return path.resolve(runDir, relativeScreenshotPath);
}

function screenshotEntries(results, runDir) {
  const entries = new Map();
  for (const check of results.checks || []) {
    if (allowedChecks.size > 0 && !allowedChecks.has(check.name)) {
      continue;
    }
    for (const screenshot of check.screenshots || []) {
      entries.set(screenshot, {
        name: screenshot,
        checkName: check.name,
        status: check.status,
        absolutePath: toAbsoluteScreenshotPath(runDir, screenshot)
      });
    }
  }
  return entries;
}

async function fileHash(filePath) {
  const data = await fs.readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}

async function fileSize(filePath) {
  const stat = await fs.stat(filePath);
  return stat.size;
}

function formatPercent(current, baseline) {
  if (!Number.isFinite(baseline) || baseline === 0) {
    return 0;
  }
  return ((current - baseline) / baseline) * 100;
}

function makeMarkdown(summaryData, changedItems, missingItems) {
  const lines = [];
  lines.push('# Phase H PR Visual Diff Summary');
  lines.push('');
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

function toPercentLabel(value) {
  return `${Math.abs(value).toFixed(2)}`;
}

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

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const [baseResults, currentResults] = await Promise.all([
    loadResults(baselineResultsPath),
    loadResults(currentResultsPath)
  ]);

  const baselineEntries = screenshotEntries(baseResults, baselineRunDir);
  const currentEntries = screenshotEntries(currentResults, currentRunDir);

  const screenshotSet = new Set([...baselineEntries.keys(), ...currentEntries.keys()]);
  summary.totalScreenshots = screenshotSet.size;

  for (const screenshot of screenshotSet) {
    const base = baselineEntries.get(screenshot);
    const current = currentEntries.get(screenshot);

    if (!base) {
      summary.missingInBaseline += 1;
      summary.missing.push({ name: screenshot, reason: 'missing baseline capture', checkName: current.checkName });
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
      [baseHash, currentHash] = await Promise.all([fileHash(base.absolutePath), fileHash(current.absolutePath)]);
      [baseBytes, currentBytes] = await Promise.all([fileSize(base.absolutePath), fileSize(current.absolutePath)]);
    } catch (error) {
      summary.skipped += 1;
      const errorRecord = {
        name: screenshot,
        checkName: current.checkName,
        status: 'error',
        message: error.message
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
    const record = {
      name: screenshot,
      checkName: current.checkName,
      baselineHash: baseHash,
      currentHash: currentHash,
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
    if (a.status === b.status) {
      return a.name.localeCompare(b.name);
    }
    if (a.status === 'changed') {
      return -1;
    }
    if (a.status === 'error') {
      return b.status === 'changed' ? 1 : -1;
    }
    return 1;
  });

  const markdownLines = makeMarkdown(
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

  summary.finishedAt = new Date().toISOString();
  summary.completed = true;
  await fs.writeFile(
    summaryPath,
    JSON.stringify(
      {
        ...summary,
        changed: summary.changed,
        missing: summary.missing,
        errors: summary.errors,
        deltas: summary.deltas
      },
      null,
      2
    )
  );
  await fs.writeFile(markdownPath, markdownLines);

  if (summary.errors.length > 0) {
    throw new Error(`Visual diff comparison encountered ${summary.errors.length} screenshot read errors.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
