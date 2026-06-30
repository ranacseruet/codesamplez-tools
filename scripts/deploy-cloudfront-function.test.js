const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const {
  DEFAULT_FUNCTION_NAME,
  createTestEventFile,
  describeFunction,
  deployCloudFrontFunction,
  ensureDistributionAssociation,
  ensureDefaultFunctionAssociation,
  normalizeSource,
  parseJsonOutput,
  parseArgs,
  runCommand,
  verifyLiveSource
} = require('./deploy-cloudfront-function');

function loadCloudFrontFunctionHandler() {
  const sourcePath = path.resolve(__dirname, '../infrastructure/cloudfront-functions/codesamplez-tools-rewrite-static-urls.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.handler = handler;`, context);
  return context.handler;
}

function createEvent(uri, querystring = {}) {
  return {
    request: {
      uri,
      querystring
    }
  };
}

describe('codesamplez-tools-rewrite-static-urls CloudFront Function', () => {
  const handler = loadCloudFrontFunctionHandler();

  it('rewrites the root path to index.html', () => {
    expect(handler(createEvent('/')).uri).toBe('/index.html');
  });

  it('rewrites tool directory paths to their index.html object', () => {
    expect(handler(createEvent('/jwt-decoder/')).uri).toBe('/jwt-decoder/index.html');
  });

  it('redirects extensionless tool paths to their canonical directory URL', () => {
    expect(handler(createEvent('/jwt-decoder'))).toEqual({
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: {
          value: '/jwt-decoder/'
        }
      }
    });
  });

  it('preserves query string parameters when redirecting extensionless tool paths', () => {
    expect(handler(createEvent('/jwt-decoder', {
      utm_source: { value: 'twitter' },
      search: { value: 'hello world' },
      filter: {
        value: 'first',
        multiValue: [
          { value: 'first' },
          { value: 'second' }
        ]
      }
    })).headers.location.value).toBe('/jwt-decoder/?utm_source=twitter&search=hello%20world&filter=first&filter=second');
  });

  it('leaves asset paths with file extensions unchanged', () => {
    expect(handler(createEvent('/jwt-decoder/bundle.main.js')).uri).toBe('/jwt-decoder/bundle.main.js');
  });
});

describe('deploy-cloudfront-function helpers', () => {
  it('parses default deployment arguments', () => {
    expect(parseArgs([])).toEqual(expect.objectContaining({
      name: DEFAULT_FUNCTION_NAME,
      runtime: 'cloudfront-js-2.0',
      eventType: 'viewer-request',
      dryRun: false,
      skipAssociation: false
    }));
  });

  it('parses explicit deployment arguments', () => {
    expect(parseArgs([
      '--name', 'CustomFunction',
      '--source', 'custom/function.js',
      '--distribution-id', 'DIST123',
      '--runtime', 'cloudfront-js-1.0',
      '--event-type', 'viewer-response',
      '--comment', 'Custom comment',
      '--skip-association',
      '--dry-run'
    ])).toEqual(expect.objectContaining({
      name: 'CustomFunction',
      sourcePath: path.resolve(process.cwd(), 'custom/function.js'),
      distributionId: 'DIST123',
      runtime: 'cloudfront-js-1.0',
      eventType: 'viewer-response',
      comment: 'Custom comment',
      dryRun: true,
      skipAssociation: true
    }));
  });

  it('prints help and exits for help flags', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    try {
      expect(() => parseArgs(['--help'])).toThrow('process.exit');
      const output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('Usage: node scripts/deploy-cloudfront-function.js');
      expect(output).toContain('--distribution-id <id>');
    } finally {
      exitSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it('normalizes source line endings and surrounding whitespace for live-source comparisons', () => {
    expect(normalizeSource('function handler() {\r\n}\r\n')).toBe('function handler() {\n}');
  });

  it('parses empty JSON command output as an empty object', () => {
    expect(parseJsonOutput('')).toEqual({});
  });

  it('creates a test-function event object for the root rewrite smoke test', () => {
    const eventFile = createTestEventFile('function handler(event) { return event.request; }');
    try {
      const event = JSON.parse(fs.readFileSync(eventFile.eventPath, 'utf8'));

      expect(event.context.eventType).toBe('viewer-request');
      expect(event.request.uri).toBe('/');
      expect(event.request.headers.host.value).toBe('tools.codesamplez.com');
    } finally {
      fs.rmSync(eventFile.tempDir, { recursive: true, force: true });
    }
  });

  it('retries live source verification and removes temporary exports', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesamplez-cloudfront-test-'));
    const sourcePath = path.join(tempDir, 'RewriteStaticURLs.js');
    const exportDirs = [];
    let calls = 0;

    fs.writeFileSync(sourcePath, 'function handler(event) {\n    return event.request;\n}\n', 'utf8');

    try {
      verifyLiveSource('RewriteStaticURLs', sourcePath, false, (command, args) => {
        expect(command).toBe('aws');
        const outputPath = args[args.indexOf('LIVE') + 1];
        exportDirs.push(path.dirname(outputPath));
        fs.writeFileSync(outputPath, calls === 0 ? 'stale source' : fs.readFileSync(sourcePath, 'utf8'), 'utf8');
        calls += 1;
        return { status: 0, stdout: '{}', stderr: '' };
      });

      expect(calls).toBe(2);
      expect(exportDirs).toHaveLength(2);
      exportDirs.forEach((exportDir) => {
        expect(fs.existsSync(exportDir)).toBe(false);
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('runs the dry-run deploy flow without calling AWS', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesamplez-cloudfront-dry-run-'));
    const sourcePath = path.join(tempDir, 'RewriteStaticURLs.js');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    fs.writeFileSync(sourcePath, 'function handler(event) {\n    return event.request;\n}\n', 'utf8');

    try {
      deployCloudFrontFunction({
        name: 'RewriteStaticURLs',
        sourcePath,
        distributionId: 'DIST123',
        runtime: 'cloudfront-js-2.0',
        eventType: 'viewer-request',
        comment: 'Dry run',
        dryRun: true,
        skipAssociation: false
      });

      const output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('[dry-run] aws cloudfront update-function');
      expect(output).toContain('[dry-run] aws cloudfront test-function');
      expect(output).toContain('[dry-run] aws cloudfront publish-function');
      expect(output).toContain('[dry-run] aws cloudfront get-distribution-config --id DIST123');
    } finally {
      logSpy.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('creates a missing development function before publishing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesamplez-cloudfront-create-'));
    const sourcePath = path.join(tempDir, 'RewriteStaticURLs.js');
    const commands = [];

    fs.writeFileSync(sourcePath, 'function handler(event) {\n    return event.request;\n}\n', 'utf8');

    try {
      deployCloudFrontFunction({
        name: 'RewriteStaticURLs',
        sourcePath,
        distributionId: 'DIST123',
        runtime: 'cloudfront-js-2.0',
        eventType: 'viewer-request',
        comment: 'Create path',
        dryRun: false,
        skipAssociation: false
      }, {
        describeFunction: (name, stage) => {
          return stage === 'DEVELOPMENT'
            ? null
            : { FunctionSummary: { FunctionMetadata: { FunctionARN: `arn:aws:cloudfront::123:function/${name}` } } };
        },
        runCommand: (command, args) => {
          commands.push([command, ...args].join(' '));
          return { status: 0, stdout: '{"ETag":"NEXT"}', stderr: '' };
        },
        verifyLiveSource: jest.fn(),
        ensureDistributionAssociation: jest.fn()
      });

      expect(commands.some((command) => command.includes('cloudfront create-function'))).toBe(true);
      expect(commands.some((command) => command.includes('cloudfront test-function'))).toBe(true);
      expect(commands.some((command) => command.includes('cloudfront publish-function'))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('skips distribution association when requested', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesamplez-cloudfront-skip-'));
    const sourcePath = path.join(tempDir, 'RewriteStaticURLs.js');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    fs.writeFileSync(sourcePath, 'function handler(event) {\n    return event.request;\n}\n', 'utf8');

    try {
      deployCloudFrontFunction({
        name: 'RewriteStaticURLs',
        sourcePath,
        distributionId: null,
        runtime: 'cloudfront-js-2.0',
        eventType: 'viewer-request',
        comment: 'Dry run',
        dryRun: true,
        skipAssociation: true
      });

      const output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('[dry-run] aws cloudfront publish-function');
      expect(output).not.toContain('get-distribution-config');
    } finally {
      logSpy.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('requires existing CloudFront Function source before deploying', () => {
    expect(() => deployCloudFrontFunction({
      name: 'RewriteStaticURLs',
      sourcePath: path.join(os.tmpdir(), 'missing-cloudfront-function.js'),
      distributionId: 'DIST123',
      runtime: 'cloudfront-js-2.0',
      eventType: 'viewer-request',
      comment: 'Dry run',
      dryRun: true,
      skipAssociation: false
    })).toThrow('CloudFront Function source not found');
  });

  it('requires a distribution id when association is enabled', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesamplez-cloudfront-missing-dist-'));
    const sourcePath = path.join(tempDir, 'RewriteStaticURLs.js');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    fs.writeFileSync(sourcePath, 'function handler(event) {\n    return event.request;\n}\n', 'utf8');

    try {
      expect(() => deployCloudFrontFunction({
        name: 'RewriteStaticURLs',
        sourcePath,
        distributionId: null,
        runtime: 'cloudfront-js-2.0',
        eventType: 'viewer-request',
        comment: 'Dry run',
        dryRun: true,
        skipAssociation: false
      })).toThrow('Missing required --distribution-id value');
    } finally {
      logSpy.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('requires handler(event) in the generated test event source', () => {
    expect(() => createTestEventFile('function nope(event) { return event; }')).toThrow('handler(event)');
  });

  it('throws when live source verification still mismatches after retries', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesamplez-cloudfront-mismatch-'));
    const sourcePath = path.join(tempDir, 'RewriteStaticURLs.js');

    fs.writeFileSync(sourcePath, 'function handler(event) {\n    return event.request;\n}\n', 'utf8');

    try {
      expect(() => verifyLiveSource('RewriteStaticURLs', sourcePath, false, (command, args) => {
        const outputPath = args[args.indexOf('LIVE') + 1];
        fs.writeFileSync(outputPath, 'stale source', 'utf8');
        return { status: 0, stdout: '{}', stderr: '' };
      })).toThrow('does not match');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('throws when the LIVE function ARN cannot be resolved', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesamplez-cloudfront-no-arn-'));
    const sourcePath = path.join(tempDir, 'RewriteStaticURLs.js');

    fs.writeFileSync(sourcePath, 'function handler(event) {\n    return event.request;\n}\n', 'utf8');

    try {
      expect(() => deployCloudFrontFunction({
        name: 'RewriteStaticURLs',
        sourcePath,
        distributionId: 'DIST123',
        runtime: 'cloudfront-js-2.0',
        eventType: 'viewer-request',
        comment: 'No ARN',
        dryRun: false,
        skipAssociation: false
      }, {
        describeFunction: () => ({ ETag: 'ETAG' }),
        runCommand: () => ({ status: 0, stdout: '{"ETag":"NEXT"}', stderr: '' }),
        verifyLiveSource: jest.fn()
      })).toThrow('Could not resolve LIVE FunctionARN');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('runs shell commands and returns captured output', () => {
    const result = runCommand(process.execPath, ['-e', 'process.stdout.write("ok")']);

    expect(result).toEqual({ status: 0, stdout: 'ok', stderr: '' });
  });

  it('returns non-zero command results when failures are allowed', () => {
    const result = runCommand(process.execPath, ['-e', 'process.stderr.write("nope"); process.exit(7)'], { allowFailure: true });

    expect(result).toEqual({ status: 7, stdout: '', stderr: 'nope' });
  });

  it('returns spawn errors when command failures are allowed', () => {
    const result = runCommand('definitely-not-a-real-command-codesamplez', [], { allowFailure: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('definitely-not-a-real-command-codesamplez');
  });

  it('throws spawn errors by default', () => {
    expect(() => runCommand('definitely-not-a-real-command-codesamplez', [])).toThrow();
  });

  it('exits on command failures by default', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    try {
      expect(() => runCommand(process.execPath, ['-e', 'process.stderr.write("nope"); process.exit(7)'])).toThrow('process.exit');
      expect(stderrSpy).toHaveBeenCalledWith('nope');
      expect(exitSpy).toHaveBeenCalledWith(7);
    } finally {
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });

  it('returns null for dry-run function descriptions', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(describeFunction('RewriteStaticURLs', 'LIVE', true)).toBeNull();
    } finally {
      logSpy.mockRestore();
    }
  });

  it('adds a viewer-request function association to an empty default cache behavior', () => {
    const result = ensureDefaultFunctionAssociation({
      DefaultCacheBehavior: {
        TargetOriginId: 's3-origin',
        ViewerProtocolPolicy: 'redirect-to-https',
        FunctionAssociations: {
          Quantity: 0
        }
      }
    }, 'arn:aws:cloudfront::123:function/RewriteStaticURLs');

    expect(result.changed).toBe(true);
    expect(result.config.DefaultCacheBehavior.FunctionAssociations).toEqual({
      Quantity: 1,
      Items: [{
        EventType: 'viewer-request',
        FunctionARN: 'arn:aws:cloudfront::123:function/RewriteStaticURLs'
      }]
    });
    expect(result.config.DefaultCacheBehavior.ViewerProtocolPolicy).toBe('redirect-to-https');
  });

  it('keeps an existing matching viewer-request association unchanged', () => {
    const result = ensureDefaultFunctionAssociation({
      DefaultCacheBehavior: {
        ViewerProtocolPolicy: 'redirect-to-https',
        FunctionAssociations: {
          Quantity: 1,
          Items: [{
            EventType: 'viewer-request',
            FunctionARN: 'arn:aws:cloudfront::123:function/RewriteStaticURLs'
          }]
        }
      }
    }, 'arn:aws:cloudfront::123:function/RewriteStaticURLs');

    expect(result.changed).toBe(false);
    expect(result.config.DefaultCacheBehavior.FunctionAssociations.Quantity).toBe(1);
    expect(result.config.DefaultCacheBehavior.ViewerProtocolPolicy).toBe('redirect-to-https');
  });

  it('enforces redirect-to-https when the function association already matches', () => {
    const result = ensureDefaultFunctionAssociation({
      DefaultCacheBehavior: {
        ViewerProtocolPolicy: 'allow-all',
        FunctionAssociations: {
          Quantity: 1,
          Items: [{
            EventType: 'viewer-request',
            FunctionARN: 'arn:aws:cloudfront::123:function/RewriteStaticURLs'
          }]
        }
      }
    }, 'arn:aws:cloudfront::123:function/RewriteStaticURLs');

    expect(result.changed).toBe(true);
    expect(result.config.DefaultCacheBehavior.ViewerProtocolPolicy).toBe('redirect-to-https');
  });

  it('replaces a different viewer-request function association while preserving other event associations', () => {
    const result = ensureDefaultFunctionAssociation({
      DefaultCacheBehavior: {
        ViewerProtocolPolicy: 'redirect-to-https',
        FunctionAssociations: {
          Quantity: 2,
          Items: [{
            EventType: 'viewer-request',
            FunctionARN: 'arn:aws:cloudfront::123:function/OldFunction'
          }, {
            EventType: 'viewer-response',
            FunctionARN: 'arn:aws:cloudfront::123:function/ResponseFunction'
          }]
        }
      }
    }, 'arn:aws:cloudfront::123:function/RewriteStaticURLs');

    expect(result.changed).toBe(true);
    expect(result.config.DefaultCacheBehavior.FunctionAssociations).toEqual({
      Quantity: 2,
      Items: [{
        EventType: 'viewer-request',
        FunctionARN: 'arn:aws:cloudfront::123:function/RewriteStaticURLs'
      }, {
        EventType: 'viewer-response',
        FunctionARN: 'arn:aws:cloudfront::123:function/ResponseFunction'
      }]
    });
  });

  it('requires a default cache behavior before updating associations', () => {
    expect(() => ensureDefaultFunctionAssociation({}, 'arn:aws:cloudfront::123:function/RewriteStaticURLs')).toThrow('DefaultCacheBehavior');
  });

  it('updates the distribution when the default function association changes', () => {
    const calls = [];
    ensureDistributionAssociation(
      'DIST123',
      'arn:aws:cloudfront::123:function/RewriteStaticURLs',
      'viewer-request',
      false,
      (command, args) => {
        calls.push([command, ...args]);
        if (args[1] === 'get-distribution-config') {
          return {
            status: 0,
            stdout: JSON.stringify({
              ETag: 'DIST_ETAG',
              DistributionConfig: {
                CallerReference: 'ref',
                DefaultCacheBehavior: {
                  ViewerProtocolPolicy: 'redirect-to-https',
                  FunctionAssociations: { Quantity: 0 }
                }
              }
            }),
            stderr: ''
          };
        }
        return { status: 0, stdout: '{}', stderr: '' };
      }
    );

    const updateCall = calls.find((call) => call.includes('update-distribution'));
    expect(updateCall).toEqual(expect.arrayContaining(['--if-match', 'DIST_ETAG']));
  });

  it('updates the distribution when only the viewer protocol policy is stale', () => {
    const calls = [];
    ensureDistributionAssociation(
      'DIST123',
      'arn:aws:cloudfront::123:function/RewriteStaticURLs',
      'viewer-request',
      false,
      (command, args) => {
        calls.push([command, ...args]);
        if (args[1] === 'get-distribution-config') {
          return {
            status: 0,
            stdout: JSON.stringify({
              ETag: 'DIST_ETAG',
              DistributionConfig: {
                CallerReference: 'ref',
                DefaultCacheBehavior: {
                  ViewerProtocolPolicy: 'allow-all',
                  FunctionAssociations: {
                    Quantity: 1,
                    Items: [{
                      EventType: 'viewer-request',
                      FunctionARN: 'arn:aws:cloudfront::123:function/RewriteStaticURLs'
                    }]
                  }
                }
              }
            }),
            stderr: ''
          };
        }
        return { status: 0, stdout: '{}', stderr: '' };
      }
    );

    const updateCall = calls.find((call) => call.includes('update-distribution'));
    expect(updateCall).toEqual(expect.arrayContaining(['--if-match', 'DIST_ETAG']));
  });

  it('does not update the distribution when the association already matches', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const calls = [];

    try {
      ensureDistributionAssociation(
        'DIST123',
        'arn:aws:cloudfront::123:function/RewriteStaticURLs',
        'viewer-request',
        false,
        (command, args) => {
          calls.push([command, ...args]);
          return {
            status: 0,
            stdout: JSON.stringify({
              ETag: 'DIST_ETAG',
              DistributionConfig: {
                DefaultCacheBehavior: {
                  ViewerProtocolPolicy: 'redirect-to-https',
                  FunctionAssociations: {
                    Quantity: 1,
                    Items: [{
                      EventType: 'viewer-request',
                      FunctionARN: 'arn:aws:cloudfront::123:function/RewriteStaticURLs'
                    }]
                  }
                }
              }
            }),
            stderr: ''
          };
        }
      );

      expect(calls.some((call) => call.includes('update-distribution'))).toBe(false);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('already has viewer-request association'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('redirect-to-https viewer policy'));
    } finally {
      logSpy.mockRestore();
    }
  });
});
