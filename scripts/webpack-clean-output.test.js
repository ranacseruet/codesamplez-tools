const fs = require('fs');
const os = require('os');
const path = require('path');
const createWebpackConfig = require('../webpack.config');

describe('webpack output clean', () => {
  let tempRoot;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cst-webpack-clean-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('removes files, nested directories, and dotfiles inside one output directory', () => {
    const outputPath = path.join(tempRoot, 'base64-converter');
    fs.mkdirSync(path.join(outputPath, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(outputPath, 'stale.txt'), 'stale');
    fs.writeFileSync(path.join(outputPath, '.dot-stale'), 'dot');
    fs.writeFileSync(path.join(outputPath, 'nested', 'inner.txt'), 'inner');

    createWebpackConfig.cleanOutputDirectory(outputPath);

    expect(fs.existsSync(outputPath)).toBe(true);
    expect(fs.readdirSync(outputPath)).toEqual([]);
  });

  it('skips a missing directory and cleans each compiler output once', () => {
    const outputPath = path.join(tempRoot, 'css-minifier');
    const siblingPath = path.join(tempRoot, 'js-minifier');
    fs.mkdirSync(outputPath);
    fs.mkdirSync(siblingPath);
    fs.writeFileSync(path.join(outputPath, 'stale.txt'), 'stale');
    fs.writeFileSync(path.join(siblingPath, 'keep-until-cleaned.txt'), 'sibling');

    createWebpackConfig.cleanCompilerOutputDirectories([
      { output: { path: outputPath } },
      { output: { path: outputPath } },
      { output: { path: path.join(tempRoot, 'missing') } },
      { output: {} },
      { output: { path: siblingPath } }
    ]);

    expect(fs.readdirSync(outputPath)).toEqual([]);
    expect(fs.readdirSync(siblingPath)).toEqual([]);
    expect(fs.existsSync(path.join(tempRoot, 'missing'))).toBe(false);
  });

  it('cleans only the selected compilers and leaves sibling output paths off a partial production build', () => {
    const rmSync = jest.spyOn(fs, 'rmSync').mockImplementation(() => {});

    try {
      const configs = createWebpackConfig({
        toolSelection: 'explicit',
        tools: 'base64-converter-tool'
      }, { mode: 'production' });
      const buildRoot = path.resolve(__dirname, '..', 'build');
      const outputPaths = configs.map((config) => config.output.path);

      expect(outputPaths).toEqual([path.join(buildRoot, 'base64-converter')]);
      configs.forEach((config) => {
        expect(config.plugins.some((plugin) => plugin.constructor.name === 'CleanWebpackPlugin')).toBe(false);
      });
      rmSync.mock.calls.forEach(([removedPath]) => {
        expect(String(removedPath).startsWith(path.join(buildRoot, 'base64-converter'))).toBe(true);
      });
    } finally {
      rmSync.mockRestore();
    }
  });

  it('uses build/ as the only output directory in development, where that compiler runs alone', () => {
    const rmSync = jest.spyOn(fs, 'rmSync').mockImplementation(() => {});

    try {
      const config = createWebpackConfig({}, { mode: 'development' });

      expect(Array.isArray(config)).toBe(false);
      expect(config.output.path).toBe(path.resolve(__dirname, '..', 'build'));
      expect(config.plugins.some((plugin) => plugin.constructor.name === 'CleanWebpackPlugin')).toBe(false);
    } finally {
      rmSync.mockRestore();
    }
  });
});
