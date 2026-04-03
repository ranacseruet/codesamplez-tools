const fs = require('fs');
const os = require('os');
const path = require('path');
const { JSDOM } = require('jsdom');
const {
  assertBuildTargetsExist,
  filterBuildTools,
  getBuildTools,
  installBrowserLikeGlobals,
  main,
  parseArgs,
  verifyBuild,
  verifyToolBundle
} = require('./build-verification');

function withTempBuildDir(callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cst-build-verification-'));

  try {
    callback(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('build verification helpers', () => {
  it('lists only valid built tool directories', () => {
    withTempBuildDir((tempDir) => {
      fs.mkdirSync(path.join(tempDir, 'jwt-decoder'));
      fs.mkdirSync(path.join(tempDir, 'assets'));
      fs.mkdirSync(path.join(tempDir, 'common'));
      fs.writeFileSync(path.join(tempDir, 'README.md'), 'not a directory');

      expect(getBuildTools(tempDir)).toEqual(['jwt-decoder']);
    });
  });

  it('installs browser-like globals into a jsdom window', () => {
    const dom = new JSDOM('<!doctype html><body></body>');

    dom.window.TextEncoder = undefined;
    dom.window.TextDecoder = undefined;
    dom.window.matchMedia = undefined;

    installBrowserLikeGlobals(dom.window);

    expect(dom.window.process).toBeUndefined();
    expect(typeof dom.window.TextEncoder).toBe('function');
    expect(typeof dom.window.TextDecoder).toBe('function');
    expect(dom.window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(false);
    expect(dom.window.matchMedia('(prefers-color-scheme: dark)').dispatchEvent()).toBe(false);
  });

  it('returns all build tools when no selection is provided', () => {
    expect(filterBuildTools(
      ['jwt-decoder', 'json-formatter', 'root-shell'],
      {
        requestedTools: [],
        includeRootShell: false,
        includeRootAssets: false
      }
    )).toEqual(['jwt-decoder', 'json-formatter', 'root-shell']);
  });

  it('filters built tool directories to the requested tools and optional root shell', () => {
    expect(filterBuildTools(
      ['jwt-decoder', 'json-formatter', 'root-shell'],
      {
        requestedTools: ['jwt-decoder-tool'],
        includeRootShell: true,
        includeRootAssets: false
      }
    )).toEqual(['jwt-decoder', 'root-shell']);
  });

  it('passes through unknown requested tool ids when filtering a precomputed build list', () => {
    jest.resetModules();

    jest.isolateModules(() => {
      jest.doMock('./tool-manifest', () => {
        const actual = jest.requireActual('./tool-manifest');
        return {
          ...actual,
          getToolById: jest.fn((toolId) => {
            if (toolId === 'missing-tool') {
              return undefined;
            }

            return actual.getToolById(toolId);
          })
        };
      });

      const { filterBuildTools: filterBuildToolsWithMissingTool } = require('./build-verification');

      expect(filterBuildToolsWithMissingTool(
        ['missing-tool', 'jwt-decoder'],
        {
          requestedTools: ['missing-tool'],
          includeRootShell: false,
          includeRootAssets: false
        }
      )).toEqual(['missing-tool']);
    });

    jest.dontMock('./tool-manifest');
    jest.resetModules();
  });

  it('throws when no built targets are available to verify', () => {
    expect(() => assertBuildTargetsExist([], '/tmp/example-build')).toThrow(
      "No built tool bundles found in /tmp/example-build. Run 'npm run build' first."
    );
  });

  it('does not throw when built targets are present', () => {
    expect(() => assertBuildTargetsExist(['jwt-decoder'], '/tmp/example-build')).not.toThrow();
  });

  it('parses build verification arguments for targeted checks', () => {
    expect(parseArgs([
      '--build-dir', './dist',
      '--tool', 'jwt-decoder-tool',
      '--include-root-shell'
    ])).toEqual({
      buildDir: expect.stringMatching(/dist$/),
      selection: {
        requestedTools: ['jwt-decoder-tool'],
        includeRootShell: true,
        includeRootAssets: false
      }
    });
  });

  it('marks missing bundle files as skipped', () => {
    withTempBuildDir((tempDir) => {
      fs.mkdirSync(path.join(tempDir, 'jwt-decoder'));

      expect(verifyToolBundle(tempDir, 'jwt-decoder')).toEqual({
        tool: 'jwt-decoder',
        status: 'skipped',
        message: 'bundle.main.js not found'
      });
    });
  });

  it('marks runtime console errors as verification failures', () => {
    withTempBuildDir((tempDir) => {
      fs.mkdirSync(path.join(tempDir, 'jwt-decoder'));
      fs.writeFileSync(
        path.join(tempDir, 'jwt-decoder', 'bundle.main.js'),
        'console.error({ message: "runtime boom" });'
      );
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      expect(verifyToolBundle(tempDir, 'jwt-decoder')).toEqual({
        tool: 'jwt-decoder',
        status: 'failed',
        message: 'runtime boom'
      });

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  it('marks thrown process errors as verification failures and logs the polyfill hint', () => {
    withTempBuildDir((tempDir) => {
      fs.mkdirSync(path.join(tempDir, 'jwt-decoder'));
      fs.writeFileSync(
        path.join(tempDir, 'jwt-decoder', 'bundle.main.js'),
        'throw new Error("process is not defined");'
      );
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      expect(verifyToolBundle(tempDir, 'jwt-decoder')).toEqual({
        tool: 'jwt-decoder',
        status: 'failed',
        message: 'Error: process is not defined'
      });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Detected 'process is not defined' error! Polyfill missing."));

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  it('surfaces read failures as verification failures', () => {
    withTempBuildDir((tempDir) => {
      fs.mkdirSync(path.join(tempDir, 'jwt-decoder'));
      fs.writeFileSync(path.join(tempDir, 'jwt-decoder', 'bundle.main.js'), '');
      const readSpy = jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('read failed');
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      expect(verifyToolBundle(tempDir, 'jwt-decoder')).toEqual({
        tool: 'jwt-decoder',
        status: 'failed',
        message: 'read failed'
      });

      readSpy.mockRestore();
      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  it('verifies every discovered build tool', () => {
    withTempBuildDir((tempDir) => {
      fs.mkdirSync(path.join(tempDir, 'jwt-decoder'));
      fs.writeFileSync(path.join(tempDir, 'jwt-decoder', 'bundle.main.js'), '');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      expect(verifyBuild(tempDir)).toEqual([
        {
          tool: 'jwt-decoder',
          status: 'passed'
        }
      ]);

      logSpy.mockRestore();
    });
  });

  it('exits with failure when the build directory exists but contains no built tool bundles', () => {
    withTempBuildDir((tempDir) => {
      const previousArgv = process.argv;
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit:${code}`);
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      process.argv = ['node', 'build-verification.js', '--build-dir', tempDir];

      expect(() => main()).toThrow('process.exit:1');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`No built tool bundles found in ${tempDir}. Run 'npm run build' first.`)
      );

      process.argv = previousArgv;
      exitSpy.mockRestore();
      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  it('exits with failure when the build directory is missing', () => {
    const tempDir = path.join(os.tmpdir(), 'cst-build-verification-missing-dir');
    const previousArgv = process.argv;
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    process.argv = ['node', 'build-verification.js', '--build-dir', tempDir];

    expect(() => main()).toThrow('process.exit:1');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Build directory not found at ${tempDir}. Run 'npm run build' first.`)
    );

    process.argv = previousArgv;
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('exits successfully when at least one built tool bundle verifies cleanly', () => {
    withTempBuildDir((tempDir) => {
      fs.mkdirSync(path.join(tempDir, 'jwt-decoder'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'jwt-decoder', 'bundle.main.js'), '');

      const previousArgv = process.argv;
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit:${code}`);
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      process.argv = ['node', 'build-verification.js', '--build-dir', tempDir];

      expect(() => main()).toThrow('process.exit:0');

      process.argv = previousArgv;
      exitSpy.mockRestore();
      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  it('exits with failure when a built tool bundle fails verification', () => {
    withTempBuildDir((tempDir) => {
      fs.mkdirSync(path.join(tempDir, 'jwt-decoder'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'jwt-decoder', 'bundle.main.js'), 'throw new Error("boom");');

      const previousArgv = process.argv;
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit:${code}`);
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      process.argv = ['node', 'build-verification.js', '--build-dir', tempDir];

      expect(() => main()).toThrow('process.exit:1');

      process.argv = previousArgv;
      exitSpy.mockRestore();
      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });
});
