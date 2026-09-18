const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'cross-browser-signoff.mjs');
const WORKFLOW_PATH = path.join(REPO_ROOT, '.github', 'workflows', 'cross-browser-signoff.yml');

describe('Cross-browser overflow sweep contract', () => {
  const script = fs.readFileSync(SCRIPT_PATH, 'utf8');

  it('asserts horizontal overflow from documentElement scrollWidth', () => {
    // The sweep's whole value is this assertion. A layout viewport widened by
    // unbreakable content reports innerWidth === scrollWidth, so comparing
    // those (or reading innerWidth alone) cannot detect the bug in issue #549.
    expect(script).toMatch(/scrollWidth\s*>\s*metrics\.clientWidth\s*\+\s*1/);
    expect(script).toMatch(/clientWidth:\s*root\.clientWidth/);
  });

  it('uses a plain narrow viewport, never mobile emulation', () => {
    // `isMobile: true` makes Chromium widen the layout viewport to fit the
    // overflowing content instead of reporting it, which is exactly how the
    // bug hid from the mobile visual captures. The sweep must not opt into it.
    const sweepStart = script.indexOf('async function runOverflowSweep');
    const sweepEnd = script.indexOf('async function runScenario');
    expect(sweepStart).toBeGreaterThan(-1);
    expect(sweepEnd).toBeGreaterThan(sweepStart);
    const sweepBody = script.slice(sweepStart, sweepEnd);

    expect(sweepBody).toMatch(/newContext\(\{\s*viewport:\s*\{\s*width:\s*390/);
    expect(sweepBody).not.toMatch(/isMobile:\s*true/);
  });

  it('derives its routes from the tool manifest and runs inside main()', () => {
    expect(script).toMatch(/getToolDefinitions\(\)/);
    expect(script).toMatch(/\.map\(\(tool\)\s*=>\s*tool\.publicPath\)/);
    // Wired into the browser loop, not just defined.
    expect(script).toMatch(/for \(const browser of browserMatrix\) \{\s*await runOverflowSweep\(browser\.name, browser\.type\)/);
  });

  it('does not abort a scoped sweep for a tool that has no legacy scenario', () => {
    // Regression: a guard compared the selection against `scenarios` only and
    // threw "No cross-browser scenarios matched" before the sweep ran, so
    // `--tools base64-converter-tool` (and css-minifier-tool, jwt-decoder-tool,
    // qr-code-generator — none of which have a scenario) could never be
    // checked. Unknown ids are already rejected by `parseToolSelectionArgs`.
    const guard = /scenarios\.every\(\(scenario\) => !shouldRunScenario\(scenario\)\)/;
    expect(script).not.toMatch(guard);
    expect(script).toMatch(/function getOverflowSweepRoutes/);
  });

  it('covers every manifest tool with a sweep route', () => {
    // The sweep is the only coverage for tools without a scenario, so assert the
    // derived route set matches the manifest exactly rather than trusting it.
    const { getToolDefinitions } = require('./tool-manifest');
    const scenarioNames = new Set([...script.matchAll(/name:\s*'([a-z0-9-]+)'/g)].map((match) => match[1]));
    const toolsWithoutScenario = getToolDefinitions().filter((tool) => (
      !scenarioNames.has(tool.id) && !scenarioNames.has(`${tool.sourceRoot}-tool`) && !scenarioNames.has(tool.sourceRoot)
    ));

    // If every tool had a scenario this test would pass vacuously; assert both
    // that scenario-less tools exist and that the route list is manifest-derived.
    expect(toolsWithoutScenario.map((tool) => tool.id)).toEqual(
      expect.arrayContaining(['base64-converter-tool', 'css-minifier-tool', 'jwt-decoder-tool', 'qr-code-generator'])
    );
    expect(script).toMatch(/getToolDefinitions\(\)[\s\S]{0,200}\.map\(\(tool\) => tool\.publicPath\)/);
  });

  it('builds the served artifacts against the local origin before sweeping', () => {
    // Without this override the generated HTML points at the production CDN, so
    // the sweep would load deployed CSS and pass regardless of this commit.
    const workflow = yaml.load(fs.readFileSync(WORKFLOW_PATH, 'utf8'));
    const buildStep = workflow.jobs['cross-browser-signoff'].steps
      .find((step) => step.name === 'Build production artifacts');

    expect(buildStep.env.CST_SITE_STATIC_ROOT_URI).toBe('http://127.0.0.1:8080');
  });
});
