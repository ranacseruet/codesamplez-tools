const {
  MIN_NODE_VERSION,
  compareDottedVersions,
  isNodeVersionSupported,
  main
} = require('./check-node-version');

describe('compareDottedVersions', () => {
  it('orders versions by major, then minor, then patch', () => {
    expect(compareDottedVersions('24.9.0', '24.9.0')).toBe(0);
    expect(compareDottedVersions('24.9.0', '24.8.0')).toBeGreaterThan(0);
    expect(compareDottedVersions('24.9.0', '25.0.0')).toBeLessThan(0);
    expect(compareDottedVersions('24.10.0', '24.9.0')).toBeGreaterThan(0);
    expect(compareDottedVersions('24.9.0', '24.9.1')).toBeLessThan(0);
  });

  it('compares versions with different part counts', () => {
    expect(compareDottedVersions('24', '24.0.0')).toBe(0);
    expect(compareDottedVersions('24.9', '24.9.0')).toBe(0);
    expect(compareDottedVersions('24.9', '24.9.1')).toBeLessThan(0);
  });
});

describe('isNodeVersionSupported', () => {
  it('accepts the minimum supported version and newer runtimes', () => {
    expect(MIN_NODE_VERSION).toBe('24.9.0');
    expect(isNodeVersionSupported('24.9.0')).toBe(true);
    expect(isNodeVersionSupported('24.15.0')).toBe(true);
    expect(isNodeVersionSupported('24.21.0')).toBe(true);
    expect(isNodeVersionSupported('25.0.0')).toBe(true);
  });

  it('rejects runtimes without native require(esm) support', () => {
    expect(isNodeVersionSupported('24.8.0')).toBe(false);
    expect(isNodeVersionSupported('23.9.0')).toBe(false);
    expect(isNodeVersionSupported('22.11.0')).toBe(false);
  });

  it('handles prerelease suffixes and malformed versions', () => {
    expect(isNodeVersionSupported('24.9.0-nightly.1')).toBe(true);
    expect(isNodeVersionSupported('24.8.0-rc.2')).toBe(false);
    expect(isNodeVersionSupported('')).toBe(false);
    expect(isNodeVersionSupported('v24.9.0')).toBe(false);
  });
});

describe('main', () => {
  it('passes without side effects on supported runtimes', () => {
    const exit = jest.fn();
    const log = jest.fn();

    main({ nodeVersion: '24.9.0', log, exit });

    expect(log).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('prints guidance and exits 1 on unsupported runtimes', () => {
    const exit = jest.fn();
    const log = jest.fn();

    main({ nodeVersion: '23.9.0', log, exit });

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('Node >= 24.9.0 is required');
    expect(log.mock.calls[0][0]).toContain('nvm use');
    expect(exit).toHaveBeenCalledWith(1);
  });
});