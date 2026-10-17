import { jest } from '@jest/globals';
import { clearToolUsedDedupe } from '../common/analytics-events';
import { JWTDecoderUI } from './script';

jest.mock('../common/notification-manager', () => ({
  NotificationManager: { show: jest.fn() }
}));

jest.mock('../common/clear-button/ClearButton', () => jest.fn().mockImplementation(() => ({
  updateVisibility: jest.fn(),
  disconnect: jest.fn()
})));

jest.mock('../common/clipboard', () => ({
  copyTextToClipboard: jest.fn(() => Promise.resolve())
}));

const SAMPLE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const SECRET = 'user-secret-hmac-UNIQUE-94';

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
    <textarea id="jwtInputToken"></textarea>
    <input id="jwtSecretKey" />
    <textarea id="jwtDecodedOutput"></textarea>
    <div id="headerJson"></div>
    <div id="payloadJson"></div>
    <div id="rawJsonViewer"></div>
    <div id="jwtSignatureStatus"></div>
    <div id="jwtTokenValidityStatus"></div>
    <button id="jwt-decoder-copy-btn"></button>
    <button id="jwt-decoder-decode-btn"></button>
    <button id="jwt-decoder-validate-btn"></button>
    <button id="jwt-decoder-sample-btn"></button>
    <div class="jwt-decoder-tabs">
      <button class="jwt-decoder-tab active" data-tab="raw"></button>
      <button class="jwt-decoder-tab" data-tab="header"></button>
      <button class="jwt-decoder-tab" data-tab="payload"></button>
    </div>
    <div id="rawTab" class="jwt-decoder-tab-pane active"></div>
    <div id="headerTab" class="jwt-decoder-tab-pane"></div>
    <div id="payloadTab" class="jwt-decoder-tab-pane"></div>
  `;
}

describe('JWT Decoder tool_used', () => {
  beforeEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    jest.useFakeTimers();
    installDom();
  });

  afterEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  it('does not count the preloaded sample as an activation', async () => {
    const gtag = installGtag();
    const ui = new JWTDecoderUI();
    ui.initialize();
    await Promise.resolve();

    expect(toolUsedCalls(gtag)).toHaveLength(0);
    expect(ui.elements.jwtInput.value).toBe(SAMPLE_TOKEN);
  });

  it('fires one decode event and omits the token and decoded claims', async () => {
    const gtag = installGtag();
    const ui = new JWTDecoderUI();
    ui.initialize();
    await ui.decodeAndRender(false);

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2].tool_id).toBe('jwt-decoder');
    expect(calls[0][2].action).toBe('decode');
    expect(calls[0][2].trigger).toBe('user');
    expect(calls[0][2].outcome).toBe('success');
    const serialized = JSON.stringify(calls);
    expect(serialized).not.toContain(SAMPLE_TOKEN);
    expect(serialized).not.toContain('John Doe');
    expect(serialized).not.toContain('1234567890');
  });

  it('tags an invalid token as a decode error and omits it', async () => {
    const gtag = installGtag();
    const ui = new JWTDecoderUI();
    ui.initialize();
    const invalid = 'not-a-jwt-UNIQUE-94';
    ui.elements.jwtInput.value = invalid;
    await ui.decodeAndRender(false);

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2].action).toBe('decode');
    expect(calls[0][2].outcome).toBe('error');
    expect(JSON.stringify(calls)).not.toContain(invalid);
  });

  it('fires verify without sending the token or secret', async () => {
    const gtag = installGtag();
    const ui = new JWTDecoderUI();
    ui.initialize();
    ui.elements.jwtInput.value = SAMPLE_TOKEN;
    ui.elements.secretInput.value = SECRET;
    await ui.decodeAndRender(true);

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2].action).toBe('verify');
    expect(calls[0][2].trigger).toBe('user');
    expect(calls[0][2].outcome === 'success' || calls[0][2].outcome === 'error').toBe(true);
    const serialized = JSON.stringify(calls);
    expect(serialized).not.toContain(SAMPLE_TOKEN);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain('John Doe');
  });

  it('tags Load Sample as sample and omits the token', async () => {
    const gtag = installGtag();
    const ui = new JWTDecoderUI();
    ui.initialize();
    ui.elements.jwtInput.value = '';
    document.getElementById('jwt-decoder-sample-btn').click();
    await Promise.resolve();
    await Promise.resolve();

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2].trigger).toBe('sample');
    expect(calls[0][2].action).toBe('decode');
    expect(calls[0][2].outcome).toBe('success');
    expect(JSON.stringify(calls)).not.toContain(SAMPLE_TOKEN);
  });

  it('collapses live decode keystrokes inside the shared dedupe window', async () => {
    const gtag = installGtag();
    const ui = new JWTDecoderUI();
    ui.initialize();
    ui.elements.jwtInput.value = '';
    ui.elements.secretInput.value = '';
    clearToolUsedDedupe();

    ui.elements.jwtInput.value = SAMPLE_TOKEN;
    ui.elements.jwtInput.dispatchEvent(new Event('input'));
    jest.advanceTimersByTime(300);
    await Promise.resolve();
    await Promise.resolve();

    ui.elements.jwtInput.value = `${SAMPLE_TOKEN}x`;
    ui.elements.jwtInput.dispatchEvent(new Event('input'));
    jest.advanceTimersByTime(300);
    await Promise.resolve();

    expect(toolUsedCalls(gtag)).toHaveLength(1);
    expect(toolUsedCalls(gtag)[0][2].action).toBe('decode');
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain(SAMPLE_TOKEN);
  });
});
