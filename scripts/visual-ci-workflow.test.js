const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const REPO_ROOT = path.resolve(__dirname, '..');
const WORKFLOW_ROOT = path.join(REPO_ROOT, '.github', 'workflows');
const SNAPDRIFT_CONFIG_PATH = path.join(REPO_ROOT, '.github', 'snapdrift.json');

function readWorkflow(name) {
  return yaml.load(fs.readFileSync(path.join(WORKFLOW_ROOT, name), 'utf8'));
}

function findStep(job, name) {
  return job.steps.find((step) => step.name === name);
}

describe('Visual CI workflow contract', () => {
  it('publishes an unscoped complete baseline after every successful main build', () => {
    const workflow = readWorkflow('ci.yml');
    const job = workflow.jobs['publish-baseline'];

    expect(workflow.on.push.branches).toContain('main');
    expect(job.needs).toBe('test-and-build');
    expect(job.if).toBe("github.ref == 'refs/heads/main'");
    expect(job.concurrency).toEqual({
      group: 'visual-baseline-main-${{ github.repository }}',
      'cancel-in-progress': false,
    });

    const buildStep = findStep(job, 'Build app');
    expect(buildStep.run.trim()).toBe('npm run build');
    expect(buildStep.run).not.toMatch(/--tools?\b/);

    const publishStep = findStep(job, 'Publish main visual baseline');
    expect(publishStep.uses).toMatch(/^ranacseruet\/snapdrift\/actions\/baseline@[0-9a-f]{40}$/);
    expect(publishStep.if).toContain("steps.baseline_candidate.outputs.current == 'true'");
    expect(publishStep.if).toContain("steps.baseline_current.outputs.current == 'true'");
    expect(publishStep.with).not.toHaveProperty('route-ids');
    // Hosted publication does not upload ui-foundation-visual-baseline. The
    // pinned baseline action stages that GitHub artifact only for the local
    // provider, so turning this on would not give PR diffs an artifact to find.
    expect(publishStep.with['upload-artifact']).toBe('false');

    const candidateStep = findStep(job, 'Verify current main baseline candidate');
    expect(candidateStep.run).toMatch(/git ls-remote origin refs\/heads\/main/);
    expect(candidateStep.run).toMatch(/GITHUB_SHA/);
    expect(candidateStep.run).toMatch(/current=true/);

    const currentStep = findStep(job, 'Verify current main before publication');
    expect(currentStep.run).toMatch(/git ls-remote origin refs\/heads\/main/);
    expect(currentStep.run).toMatch(/::notice::Skipping baseline publication/);
  });

  // These mobile-preset routes are excluded. Their hosted baseline captures are
  // already over SnapDrift's 33,554,432-pixel union canvas, so every comparison
  // returns comparison_too_large and the summary stays incomplete (PR #119 run
  // 39315713571, and the same baseline dimensions on PR #126):
  //   js-minifier-mobile      1170×30414 (35,584,380)
  //   jwt-builder-mobile      1170×28785 (33,678,450)
  //   text-analyzer-mobile    1170×30063 (35,173,710)
  //   diff-checker-mobile     1170×31785 (37,188,450)
  // A custom {width:390,height:844} viewport is the DPR-1 escape hatch and would
  // fit the CSS height, but the union still includes that oversized baseline
  // image until main publishes a baseline that no longer has it. Publishing
  // happens only after the config is on main, so this pull request cannot both
  // switch the viewport and finish a complete comparison. Exclusion is what
  // lets a normal PR reach one. Desktop routes for the same tools stay.
  const EXCLUDED_OVERSIZED_MOBILE_ROUTES = [
    'js-minifier-mobile',
    'jwt-builder-mobile',
    'text-analyzer-mobile',
    'diff-checker-mobile'
  ];

  it('keeps the canonical hosted baseline at the comparable route configuration', () => {
    const config = JSON.parse(fs.readFileSync(SNAPDRIFT_CONFIG_PATH, 'utf8'));
    const routeIds = config.routes.map((route) => route.id);

    expect(config.provider).toBe('snap');
    expect(config.diff.mode).toBe('fail-on-incomplete');
    expect(routeIds).toHaveLength(20);
    expect(new Set(routeIds).size).toBe(routeIds.length);
    EXCLUDED_OVERSIZED_MOBILE_ROUTES.forEach((routeId) => {
      expect(routeIds).not.toContain(routeId);
    });
    expect(config.selection.sharedExact).toContain('.github/snapdrift.json');
    // SnapDrift v0.17.0 keeps policy v1 as the deprecated coordinate default.
    // v2 is the vertical row alignment that suppresses mobile rendering noise.
    expect(config.diff.comparisonPolicy).toEqual({
      version: 2,
      threshold: config.diff.threshold,
    });
  });

  // The `mobile` preset is 390x844 at deviceScaleFactor 3, which caps the
  // comparable full-page CSS height at ~9,559px (32 x 1024 x 1024 union-canvas
  // pixels). Routes whose page is taller than that cannot be diffed at all —
  // they report `comparison_too_large` on every run. A custom viewport object is
  // DPR 1 and removes the raster inflation, so it is the documented escape hatch
  // (snapdrift docs/contracts.md -> "Screenshot size budget").
  const CUSTOM_VIEWPORT_BUDGET_VERIFIED = [
    'json-formatter-mobile', // #529
    'css-minifier-mobile', // #542
    'base64-converter-mobile', // #553
    'data-format-converter-mobile', // #553
  ];

  // Routes still on the DPR-3 preset, each confirmed by capture to fit the
  // budget (all are within ~2-3% of the cap, so re-measure when content grows).
  const MOBILE_PRESET_BUDGET_VERIFIED = [
    'root-index-mobile',
    'jwt-decoder-mobile',
    'json-editor-mobile',
    'qr-code-generator-mobile',
  ];

  it.each(CUSTOM_VIEWPORT_BUDGET_VERIFIED)(
    'keeps the %s capture within the hosted comparison limit',
    (routeId) => {
      const config = JSON.parse(fs.readFileSync(SNAPDRIFT_CONFIG_PATH, 'utf8'));
      const route = config.routes.find((candidate) => candidate.id === routeId);

      expect(route).toBeDefined();
      expect(route.viewport).toEqual({ width: 390, height: 844 });
    }
  );

  it('captures every route at a viewport whose raster budget has been verified', () => {
    // A unit test cannot measure a rendered page, so a route's budget can only be
    // confirmed by an actual capture. These two lists are that record, and the
    // assertions below are bidirectional on purpose: a route added to, removed
    // from, or moved between either bucket fails until the decision is recorded
    // here — rather than silently shipping an undiffable route (a `mobile`
    // preset capture over the cap) or an undocumented deviation (a custom
    // viewport nobody knows the reason for).
    const config = JSON.parse(fs.readFileSync(SNAPDRIFT_CONFIG_PATH, 'utf8'));
    const presetMobileRoutes = config.routes
      .filter((route) => route.viewport === 'mobile')
      .map((route) => route.id);
    const customViewportRoutes = config.routes
      .filter((route) => typeof route.viewport === 'object')
      .map((route) => route.id);

    expect(presetMobileRoutes.sort()).toEqual([...MOBILE_PRESET_BUDGET_VERIFIED].sort());
    expect(customViewportRoutes.sort()).toEqual([...CUSTOM_VIEWPORT_BUDGET_VERIFIED].sort());
  });

  it('never passes route scoping to a baseline action', () => {
    const baselineSteps = fs.readdirSync(WORKFLOW_ROOT)
      .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
      .flatMap((name) => Object.values(readWorkflow(name).jobs))
      .flatMap((job) => job.steps || [])
      .filter((step) => step.uses?.startsWith('ranacseruet/snapdrift/actions/baseline@'));

    expect(baselineSteps).toHaveLength(1);
    baselineSteps.forEach((step) => {
      expect(step.with || {}).not.toHaveProperty('route-ids');
    });
  });

  it('keeps scheduled health capture local and read-only for the canonical Snap baseline', () => {
    const workflow = readWorkflow('health-monitoring.yml');
    const step = findStep(workflow.jobs['health-check'], 'Local visual smoke capture (scheduled, report-only)');

    expect(step.uses).toMatch(/^ranacseruet\/snapdrift\/actions\/capture@[0-9a-f]{40}$/);
    expect(step.env).toBeUndefined();
  });

  it('fails visual-diff unless SnapDrift finished a baseline comparison', () => {
    ['ci.yml', 'pr-visual-diff.yml'].forEach((name) => {
      const job = readWorkflow(name).jobs['visual-diff'];
      const diffStep = job.steps.find((step) => step.uses?.includes('/actions/pr-diff@'));
      const guard = findStep(job, 'Require a completed baseline comparison');

      expect(diffStep.id).toBe('visual_diff');
      expect(guard.if).toBe("always() && steps.visual_diff.outcome != 'skipped'");
      expect(guard.run).toBe('node scripts/require-visual-comparison.js');
      expect(guard.env).toEqual({
        SHOULD_RUN: '${{ steps.visual_diff.outputs.should-run }}',
        SCOPE_REASON: '${{ steps.visual_diff.outputs.scope-reason }}',
        STATUS: '${{ steps.visual_diff.outputs.status }}',
        SUMMARY_PATH: '${{ steps.visual_diff.outputs.summary-path }}',
        BASELINE_FOUND: '${{ steps.visual_diff.outputs.baseline-found }}',
        BASELINE_RESOLUTION_STATUS: '${{ steps.visual_diff.outputs.baseline-resolution-status }}'
      });
    });
  });

  it('queues manual visual-diff runs and retries a Snap API 429 without changing the pull-request job', () => {
    const manual = readWorkflow('pr-visual-diff.yml');
    const manualDiff = manual.jobs['visual-diff'].steps.find((step) => step.uses?.includes('/actions/pr-diff@'));
    const pullRequestDiff = readWorkflow('ci.yml').jobs['visual-diff'].steps
      .find((step) => step.uses?.includes('/actions/pr-diff@'));

    expect(manual.concurrency).toEqual({
      group: 'pr-visual-diff-manual-${{ github.repository }}',
      'cancel-in-progress': false
    });
    expect(manualDiff.env).toEqual({
      SNAP_API_KEY: '${{ secrets.SNAP_API_KEY }}',
      NODE_OPTIONS: '--require ${{ github.workspace }}/scripts/retry-snap-429.js'
    });
    expect(manualDiff.with['force-run']).toBe(true);
    expect(pullRequestDiff.env).toEqual({
      SNAP_API_KEY: '${{ secrets.SNAP_API_KEY }}'
    });
    expect(pullRequestDiff.env.NODE_OPTIONS).toBeUndefined();
    expect(readWorkflow('ci.yml').concurrency.group).toBe('ci-${{ github.workflow }}-${{ github.head_ref || github.run_id }}');
  });

  it('keeps Dependabot pull requests off the secret-gated visual-diff job', () => {
    const job = readWorkflow('ci.yml').jobs['visual-diff'];

    expect(job.if).toContain("github.event.pull_request.user.login != 'dependabot[bot]'");
    expect(job.if).toContain('github.event.pull_request.draft == false');
    expect(job.if).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(job.if).toContain("github.event_name == 'pull_request'");
  });

  it('pins every SnapDrift consumer action to one immutable release commit', () => {
    const workflowSources = fs.readdirSync(WORKFLOW_ROOT)
      .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
      .map((name) => fs.readFileSync(path.join(WORKFLOW_ROOT, name), 'utf8'));
    const refs = workflowSources.flatMap((source) =>
      [...source.matchAll(/uses:\s+ranacseruet\/snapdrift\/actions\/(?:baseline|capture|pr-diff)@([^\s#]+)/g)]
        .map((match) => match[1])
    );

    expect(refs).toHaveLength(4);
    expect(new Set(refs).size).toBe(1);
    expect(refs[0]).toMatch(/^[0-9a-f]{40}$/);
  });
});
