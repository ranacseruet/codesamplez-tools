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
