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

    const candidateStep = findStep(job, 'Verify current main baseline candidate');
    expect(candidateStep.run).toMatch(/git ls-remote origin refs\/heads\/main/);
    expect(candidateStep.run).toMatch(/GITHUB_SHA/);
    expect(candidateStep.run).toMatch(/current=true/);

    const currentStep = findStep(job, 'Verify current main before publication');
    expect(currentStep.run).toMatch(/git ls-remote origin refs\/heads\/main/);
    expect(currentStep.run).toMatch(/::notice::Skipping baseline publication/);
  });

  it('keeps the canonical hosted baseline at the full 24-identity configuration', () => {
    const config = JSON.parse(fs.readFileSync(SNAPDRIFT_CONFIG_PATH, 'utf8'));
    const routeIds = config.routes.map((route) => route.id);

    expect(config.provider).toBe('snap');
    expect(routeIds).toHaveLength(24);
    expect(new Set(routeIds).size).toBe(routeIds.length);
    expect(config.diff.comparisonPolicy).toEqual({
      version: 1,
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
    'js-minifier-mobile',
    'jwt-builder-mobile',
    'jwt-decoder-mobile',
    'json-editor-mobile',
    'text-analyzer-mobile',
    'qr-code-generator-mobile',
    'diff-checker-mobile',
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
