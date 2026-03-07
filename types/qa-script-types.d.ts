export type VisualViewportPreset = 'desktop' | 'mobile';

export interface VisualRegressionSelectionConfig {
  sharedPrefixes?: string[];
  sharedExact?: string[];
}

export interface VisualRegressionRouteConfig {
  id: string;
  path: string;
  viewport: VisualViewportPreset;
  changePaths?: string[];
}

export interface VisualRegressionConfig {
  baselineArtifactName: string;
  workingDirectory: string;
  baseUrl: string;
  readyUrl: string;
  readyTimeoutSeconds: number;
  resultsFile: string;
  manifestFile: string;
  screenshotsRoot: string;
  routes: VisualRegressionRouteConfig[];
  diff: {
    threshold: number;
    mode: 'report-only' | 'fail-on-changes' | 'fail-on-incomplete' | 'strict';
  };
  selection?: VisualRegressionSelectionConfig;
}

export interface VisualBaselineRouteResult {
  id: string;
  path: string;
  viewport: VisualViewportPreset;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  imagePath?: string;
  width?: number;
  height?: number;
  error?: string;
}

export interface VisualScreenshotManifestEntry {
  id: string;
  path: string;
  viewport: VisualViewportPreset;
  imagePath: string;
  width: number;
  height: number;
}

export interface VisualScreenshotManifest {
  generatedAt: string;
  baseUrl: string;
  screenshots: VisualScreenshotManifestEntry[];
}

export interface VisualBaselineResults {
  startedAt: string;
  finishedAt?: string;
  baseUrl: string;
  suite: string;
  configPath?: string;
  manifestPath?: string;
  screenshotsRoot?: string;
  routes: VisualBaselineRouteResult[];
  passed?: boolean;
}

export type QaScreenshotCheck = VisualBaselineRouteResult;
export type QaVisualBaselineResults = VisualBaselineResults;

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
  id: string;
  reason: string;
  path?: string;
  viewport?: VisualViewportPreset;
  location: 'baseline' | 'current';
}

export interface VisualDiffErrorItem {
  id: string;
  path?: string;
  viewport?: VisualViewportPreset;
  status: 'error';
  message: string;
}

export interface VisualDiffDimensionItem {
  id: string;
  path?: string;
  viewport?: VisualViewportPreset;
  baselineWidth: number;
  baselineHeight: number;
  currentWidth: number;
  currentHeight: number;
  status: 'dimension-changed';
}

export interface VisualDiffChangedItem {
  id: string;
  path: string;
  viewport: VisualViewportPreset;
  baselineImagePath: string;
  currentImagePath: string;
  width: number;
  height: number;
  differentPixels: number;
  totalPixels: number;
  mismatchRatio: number;
  status: 'changed';
}

export interface VisualDiffSummary {
  startedAt: string;
  finishedAt?: string;
  completed?: boolean;
  status?: 'clean' | 'changes-detected' | 'incomplete' | 'skipped';
  selectedRoutes?: string[];
  baselineArtifactName?: string;
  baselineSourceSha?: string;
  baselineAvailable?: boolean;
  baselineManifestPath: string;
  currentManifestPath: string;
  diffMode: 'report-only' | 'fail-on-changes' | 'fail-on-incomplete' | 'strict';
  threshold: number;
  baselineResultsPath: string;
  currentResultsPath: string;
  totalScreenshots: number;
  matchedScreenshots: number;
  changedScreenshots: number;
  missingInBaseline: number;
  missingInCurrent: number;
  changed: VisualDiffChangedItem[];
  missing: VisualDiffMissingItem[];
  errors: VisualDiffErrorItem[];
  dimensionChanges: VisualDiffDimensionItem[];
  message?: string;
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
