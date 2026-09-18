// @babel/register is mocked so the registration path can be exercised without
// installing a global require hook into the Jest process. The module also
// short-circuits when JEST_WORKER_ID is set, so these tests toggle that env var
// to reach both branches.
jest.mock('@babel/register', () => ({ default: jest.fn() }));

/**
 * Reset the module registry and re-require both the mock and the subject so the
 * internal `babelRegistered` memo starts fresh and both modules share the same
 * mock instance.
 */
function setup() {
  jest.resetModules();
  const babelRegister = require('@babel/register').default;
  babelRegister.mockReset();
  const { ensureBabelRegister } = require('./register-node-transforms');
  return { babelRegister, ensureBabelRegister };
}

describe('ensureBabelRegister', () => {
  const originalWorkerId = process.env.JEST_WORKER_ID;

  afterEach(() => {
    if (originalWorkerId === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = originalWorkerId;
    }
  });

  it('skips @babel/register when running inside a Jest worker', () => {
    process.env.JEST_WORKER_ID = '1';
    const { babelRegister, ensureBabelRegister } = setup();

    ensureBabelRegister();

    expect(babelRegister).not.toHaveBeenCalled();
  });

  it('registers the Babel transforms outside Jest', () => {
    delete process.env.JEST_WORKER_ID;
    const { babelRegister, ensureBabelRegister } = setup();

    ensureBabelRegister();

    expect(babelRegister).toHaveBeenCalledTimes(1);
    const options = babelRegister.mock.calls[0][0];
    expect(options).toMatchObject({
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      babelrc: false,
      configFile: false
    });
    expect(options.ignore).toEqual([/node_modules/]);
    // Babel 8 migration: register via the namespace `.default`, and pass
    // preset-typescript as a bare string (allowDeclareFields was removed).
    expect(options.presets).toEqual([
      ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
      ['@babel/preset-react', { runtime: 'automatic', importSource: 'preact' }],
      '@babel/preset-typescript'
    ]);
  });

  it('registers only once across repeated calls', () => {
    delete process.env.JEST_WORKER_ID;
    const { babelRegister, ensureBabelRegister } = setup();

    ensureBabelRegister();
    ensureBabelRegister();
    ensureBabelRegister();

    expect(babelRegister).toHaveBeenCalledTimes(1);
  });
});
