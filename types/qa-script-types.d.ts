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

export interface CrossBrowserCheck {
  name: string;
  browser: string;
  scenario: string;
  status: 'passed' | 'failed';
  durationMs: number;
  url?: string;
  title?: string;
  workerUrl?: string;
  workerResponseId?: number;
  observations?: Record<string, unknown>;
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
