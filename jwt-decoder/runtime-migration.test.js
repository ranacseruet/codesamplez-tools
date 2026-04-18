import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/dom';

const mockClearButtonInstances = [];

jest.mock('./JWTDecoder', () => ({
  JWTDecoder: jest.fn().mockImplementation((token) => ({
    isValidFormat: Boolean(token && token.split('.').length === 3),
    getHeader: jest.fn(() => ({ alg: 'HS256', typ: 'JWT' })),
    getPayload: jest.fn(() => ({ sub: '123', name: 'Test User' })),
    getParsingError: jest.fn(() => 'Invalid mock format'),
    verifySignature: jest.fn(async (secret) => token === 'valid.token.sig' && secret === 'secret')
  }))
}));

jest.mock('./JsonTreeViewRenderer', () => ({
  JsonTreeViewRenderer: jest.fn().mockImplementation(() => ({
    render: jest.fn((data, container) => {
      container.innerHTML = `<pre>${JSON.stringify(data)}</pre>`;
    })
  }))
}));

jest.mock('../common/notification-manager', () => ({
  NotificationManager: {
    show: jest.fn()
  }
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
  mountToolShell: jest.fn()
}));

jest.mock('../common/clear-button/ClearButton', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    const instance = {
      updateVisibility: jest.fn(),
      disconnect: jest.fn()
    };
    mockClearButtonInstances.push(instance);
    return instance;
  })
}));

import { mountToolShell } from '../common/app-shell/mountToolShell';
import { NotificationManager } from '../common/notification-manager';
import ClearButton from '../common/clear-button/ClearButton';
import { JWTDecoderToolUI } from './script';

describe('JWT Decoder Preact runtime', () => {
  const flush = () => Promise.resolve();
  const flushEffects = async () => {
    await flush();
    await flush();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockClearButtonInstances.length = 0;
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    document.body.innerHTML = '<div id="jwt-decoder-app"></div>';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders app markup and initializes preloaded token/secret', async () => {
    const ui = new JWTDecoderToolUI();
    await flushEffects();

    expect(ui.app).toBeTruthy();
    expect(document.getElementById('jwtInputToken')).not.toBeNull();
    expect(document.getElementById('jwt-decoder-decode-btn')).not.toBeNull();
    expect(document.getElementById('jwtSignatureStatus')?.textContent).toContain('Decoded successfully');
    expect(document.getElementById('jwtInputToken')?.value).toContain('eyJhbGciOiJIUzI1Ni');
    expect(document.getElementById('jwtSecretKey')?.value).toBe('your-256-bit-secret');
    expect(document.body.textContent).toContain('About This Tool');
    expect(document.body.textContent).toContain('What is a JSON Web Token (JWT)?');
    expect(document.body.textContent).toContain('JWT Decoder FAQs (Frequently Asked Questions)');
    expect(document.querySelector('#jwt-decoder-tool a[href="https://codesamplez.com/tools/"]')).not.toBeNull();
    expect(document.querySelector('#jwt-decoder-tool a[href="https://codesamplez.com/tools/jwt-builder"]')).not.toBeNull();
    expect(document.querySelector('#jwt-decoder-tool a[href="https://codesamplez.com/contact"]')).not.toBeNull();
    expect(window.jwtDecoderApp).toBe(ui.app);
  });

  it('decodes and validates through rendered controls', async () => {
    new JWTDecoderToolUI();
    await flushEffects();

    const tokenInput = document.getElementById('jwtInputToken');
    const secretInput = document.getElementById('jwtSecretKey');
    const decodeBtn = document.getElementById('jwt-decoder-decode-btn');
    const validateBtn = document.getElementById('jwt-decoder-validate-btn');
    const status = document.getElementById('jwtSignatureStatus');

    fireEvent.input(tokenInput, { target: { value: 'valid.token.sig' } });
    fireEvent.input(secretInput, { target: { value: '' } });
    fireEvent.click(decodeBtn);
    await flushEffects();
    await flushEffects();

    expect(document.getElementById('rawJsonViewer')?.innerHTML).toContain('header');
    expect(status?.textContent).toBe('Decoded successfully.');

    fireEvent.input(secretInput, { target: { value: 'secret' } });
    fireEvent.click(validateBtn);
    await flushEffects();
    await flushEffects();

    expect(status?.textContent).toContain('Signature is valid');
    expect(NotificationManager.show).toHaveBeenCalledWith(
      expect.stringContaining('Signature is valid'),
      2000,
      expect.objectContaining({ type: 'success' })
    );
  });

  it('uses prerendered root fallback and throws when mount root is missing', async () => {
    document.body.innerHTML = '<div id="jwt-decoder-tool"></div>';
    new JWTDecoderToolUI('#missing-root');
    await flushEffects();
    expect(document.getElementById('jwt-decoder-copy-btn')).not.toBeNull();

    document.body.innerHTML = '';
    expect(() => new JWTDecoderToolUI()).toThrow('JWT Decoder root element not found');
  });

  it('bootstraps shell and app on DOMContentLoaded', async () => {
    document.body.innerHTML = `
      <div id="app-shell-header"></div>
      <div id="jwt-decoder-app"></div>
      <div id="app-shell-footer"></div>
    `;

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushEffects();

    expect(mountToolShell).toHaveBeenCalledWith(expect.objectContaining({
      title: 'JWT Decoder & Validator'
    }));
    expect(document.getElementById('jwt-decoder-validate-btn')).not.toBeNull();
    expect(window.jwtDecoderApp).toBeTruthy();
  });

  it('logs and falls back when prerender bootstrap app construction fails once', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    ClearButton.mockImplementationOnce(() => {
      throw new Error('clear button init failed');
    });

    document.body.innerHTML = `
      <div id="app-shell-header"></div>
      <div id="jwt-decoder-app"></div>
      <div id="app-shell-footer"></div>
    `;

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushEffects();
    jest.runOnlyPendingTimers();
    await flushEffects();

    expect(consoleErrorSpy).toHaveBeenCalledWith('JWT decoder UI bootstrap failed:', expect.any(Error));
    expect(document.getElementById('jwt-decoder-validate-btn')).not.toBeNull();
    expect(window.jwtDecoderApp).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });
});
