export interface QaScreenshotCheck {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  screenshots?: string[];
  observations?: Record<string, unknown>;
  reason?: string;
  error?: string;
}

export interface QaVisualBaselineResults {
  startedAt: string;
  finishedAt?: string;
  baseUrl: string;
  suite: string;
  checks: QaScreenshotCheck[];
  passed?: boolean;
}

export interface A11yViolationNodeSummary {
  target: unknown[];
  html: string;
  failureSummary?: string;
}

export interface A11yViolationSummary {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  tags: string[];
  nodeCount: number;
  nodes: A11yViolationNodeSummary[];
}

export interface QaA11yCheck {
  name: string;
  status: 'passed' | 'failed';
  durationMs: number;
  page?: string;
  viewport?: string;
  violations?: A11yViolationSummary[];
  violationsCount?: number;
  passesCount?: number;
  incompleteCount?: number;
  inapplicableCount?: number;
  error?: string;
}

export interface QaA11yResults {
  startedAt: string;
  finishedAt?: string;
  baseUrl: string;
  suite: string;
  mode: 'report-only' | 'fail-on-violations';
  checks: QaA11yCheck[];
  totalViolations?: number;
  runtimePassed?: boolean;
  passed?: boolean;
  fatalError?: string;
}

export interface VisualDiffMissingItem {
  name: string;
  reason: string;
  checkName?: string;
}

export interface VisualDiffErrorItem {
  name: string;
  checkName?: string;
  status: 'error';
  message: string;
}

export interface VisualDiffChangedItem {
  name: string;
  checkName: string;
  baselineHash: string;
  currentHash: string;
  baselineBytes: number;
  currentBytes: number;
  sizeDeltaBytes: number;
  sizeDeltaPercent: number;
  sizeDeltaSign: string;
  status: 'changed';
}

export interface VisualDiffSummary {
  startedAt: string;
  finishedAt?: string;
  completed?: boolean;
  status?: 'clean' | 'changes-detected' | 'incomplete' | 'skipped';
  selectedChecks?: string[];
  baselineArtifactName?: string;
  baselineSourceSha?: string;
  baselineAvailable?: boolean;
  baselineResultsPath: string;
  currentResultsPath: string;
  totalScreenshots: number;
  matchedScreenshots: number;
  changedScreenshots: number;
  missingInBaseline: number;
  missingInCurrent: number;
  skipped: number;
  deltas: Array<VisualDiffChangedItem | VisualDiffErrorItem | VisualDiffMissingItem>;
  changed: VisualDiffChangedItem[];
  missing: VisualDiffMissingItem[];
  errors: VisualDiffErrorItem[];
}

export interface CrossBrowserCheck {
  name: string;
  browser: string;
  scenario: string;
  status: 'passed' | 'failed';
  durationMs: number;
  url?: string;
  title?: string;
  error?: string;
}

export interface CrossBrowserResults {
  startedAt: string;
  finishedAt?: string;
  baseUrl: string;
  suite: string;
  checks: CrossBrowserCheck[];
  passed?: boolean;
  error?: string;
}
