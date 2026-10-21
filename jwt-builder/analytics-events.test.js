import { jest } from '@jest/globals';
import { clearToolUsedDedupe } from '../common/analytics-events';

const TOKEN = 'header.payload.user-secret-token-UNIQUE-94';
const SECRET_KEY = 'user-secret-hmac-key-UNIQUE-94';
const CLAIM = 'user-secret-claim-UNIQUE-94';

const mockBuilder = {
  parseDateTime: jest.fn((value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : Math.floor(date.getTime() / 1000);
  }),
  buildJWT: jest.fn().mockResolvedValue(TOKEN),
  getFormattedDate: jest.fn().mockReturnValue('2024-01-01T00:00:00Z'),
  generateRandomSecret: jest.fn().mockReturnValue('random-secret-key-32-chars-long!!')
};

jest.mock('./JWTBuilder', () => ({
  JWTBuilder: jest.fn(() => mockBuilder)
}));

jest.mock('../common/notification-manager', () => ({
  NotificationManager: { show: jest.fn() }
}));

jest.mock('../common/copy-button/CopyButton', () => jest.fn(() => ({
  updateVisibility: jest.fn(),
  forceUpdateVisibility: jest.fn()
})));

const { buildJWT, generateRandomSecret } = jest.requireActual('./script');

function installGtag() {
  const gtag = jest.fn();
  window.gtag = gtag;
  return gtag;
}

function toolUsedCalls(gtag) {
  return gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === 'tool_used');
}

function installDom() {
  document.body.innerHTML = `
    <div id="jwt-builder-error-status"></div>
    <div id="jwt-builder-empty-state"></div>
    <pre id="result"></pre>
    <select id="jwt-algorithm">
      <option value="HS256" selected>HS256</option>
      <option value="RS256">RS256</option>
    </select>
    <p id="jwt-builder-algorithm-help"></p>
    <div id="jwt-builder-hs256-key-panel"><input id="key" value="${SECRET_KEY}"></div>
    <div id="jwt-builder-rs256-key-panel" hidden><textarea id="rsa-private-key"></textarea></div>
    <input id="iss" value="${CLAIM}">
    <input id="sub" value="">
    <input id="aud" value="">
    <input id="exp" value="">
    <input id="nbf" value="">
    <input id="iat" value="">
    <input id="jti" value="">
    <div id="customClaims"></div>
  `;
}

describe('JWT Builder tool_used', () => {
  beforeEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    installDom();
    mockBuilder.buildJWT.mockClear();
    mockBuilder.buildJWT.mockResolvedValue(TOKEN);
  });

  afterEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    document.body.innerHTML = '';
  });

  it('fires one generate event with alg and omits claims, key, and token', async () => {
    const gtag = installGtag();
    await buildJWT();

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toEqual({
      tool_id: 'jwt-builder',
      action: 'generate',
      trigger: 'user',
      outcome: 'success',
      alg: 'HS256',
      input_size_bucket: '<1KB'
    });
    const serialized = JSON.stringify(calls);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain(SECRET_KEY);
    expect(serialized).not.toContain(CLAIM);
  });

  it('sends RS256 when that algorithm is selected', async () => {
    const gtag = installGtag();
    document.getElementById('jwt-algorithm').value = 'RS256';
    document.getElementById('rsa-private-key').value = '-----BEGIN PRIVATE KEY-----\nuser-secret-rsa-UNIQUE-94\n-----END PRIVATE KEY-----';
    await buildJWT();

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2].alg).toBe('RS256');
    expect(calls[0][2].outcome).toBe('success');
    expect(JSON.stringify(calls)).not.toContain('user-secret-rsa-UNIQUE-94');
    expect(JSON.stringify(calls)).not.toContain(TOKEN);
  });

  it('tags a missing key as error and still omits the claim', async () => {
    const gtag = installGtag();
    document.getElementById('key').value = '';
    await buildJWT();

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2].action).toBe('generate');
    expect(calls[0][2].alg).toBe('HS256');
    expect(calls[0][2].outcome).toBe('error');
    expect(JSON.stringify(calls)).not.toContain(CLAIM);
    expect(mockBuilder.buildJWT).not.toHaveBeenCalled();
  });

  it('does not treat random-secret generation as tool_used', () => {
    const gtag = installGtag();
    generateRandomSecret();
    expect(toolUsedCalls(gtag)).toHaveLength(0);
  });
});
