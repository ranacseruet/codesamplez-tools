import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/dom';

var mockBuilder = {
  parseDateTime: jest.fn((value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : Math.floor(date.getTime() / 1000);
  }),
  buildJWT: jest.fn().mockResolvedValue('header.payload.signature'),
  getFormattedDate: jest.fn().mockReturnValue('2024-01-01T00:00:00Z'),
  generateRandomSecret: jest.fn().mockReturnValue('random-secret-key-32-chars-long!!')
};

const mockCopyButtons = [];

jest.mock('./JWTBuilder', () => ({
  JWTBuilder: jest.fn(() => mockBuilder)
}));

jest.mock('../common/notification-manager', () => ({
  NotificationManager: {
    show: jest.fn()
  }
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
  mountToolShell: jest.fn()
}));

jest.mock('../common/copy-button/CopyButton', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((target) => {
    const instance = {
      target,
      updateVisibility: jest.fn(),
      forceUpdateVisibility: jest.fn(),
      disconnect: jest.fn()
    };
    mockCopyButtons.push(instance);
    return instance;
  })
}));

import { mountToolShell } from '../common/app-shell/mountToolShell';
import { NotificationManager } from '../common/notification-manager';
import CopyButton from '../common/copy-button/CopyButton';
import { SITE_BASE_URL, buildSiteHref } from '../common/siteBaseUrl';
import { JWTBuilderToolUI, jwtBuilder as scriptJwtBuilder } from './script';

describe('JWT Builder Preact runtime', () => {
  const flush = () => Promise.resolve();
  const flushEffects = async () => {
    await flush();
    await flush();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCopyButtons.length = 0;
    mockBuilder.parseDateTime.mockImplementation((value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : Math.floor(date.getTime() / 1000);
    });
    mockBuilder.buildJWT.mockResolvedValue('header.payload.signature');
    mockBuilder.getFormattedDate.mockReturnValue('2024-01-01T00:00:00Z');
    mockBuilder.generateRandomSecret.mockReturnValue('random-secret-key-32-chars-long!!');
    scriptJwtBuilder.parseDateTime = mockBuilder.parseDateTime;
    scriptJwtBuilder.buildJWT = mockBuilder.buildJWT;
    scriptJwtBuilder.getFormattedDate = mockBuilder.getFormattedDate;
    scriptJwtBuilder.generateRandomSecret = mockBuilder.generateRandomSecret;
    Object.assign(window, { jwtBuilder: mockBuilder });
    document.body.innerHTML = '<div id="jwt-builder-app"></div>';
  });

  afterEach(() => {
    delete window.jwtBuilder;
  });

  it('renders app markup and initializes defaults/copy buttons', async () => {
    const ui = new JWTBuilderToolUI();
    await flushEffects();

    expect(ui.builder).toBeTruthy();
    expect(document.getElementById('jwtForm')).not.toBeNull();
    expect(document.getElementById('buildJwtBtn')).not.toBeNull();
    expect(document.getElementById('iss')?.value).toBe('codesamplez.com');
    expect(document.getElementById('sub')?.value).toBe('your-subject');
    expect(document.getElementById('aud')?.value).toBe('your-audience');
    expect(document.getElementById('jti')?.value).toBe('your-identifier');
    expect(document.getElementById('jwt-algorithm')?.value).toBe('HS256');
    expect(document.getElementById('jwt-builder-hs256-key-panel')?.hidden).toBe(false);
    expect(document.getElementById('jwt-builder-rs256-key-panel')?.hidden).toBe(true);
    expect(document.getElementById('rsa-private-key')).toBeInstanceOf(HTMLTextAreaElement);
    expect(document.getElementById('rsa-private-key')?.disabled).toBe(true);
    expect(document.querySelectorAll('#jwt-builder-tool h1')).toHaveLength(0);
    expect(CopyButton).toHaveBeenCalledTimes(2);
  });

  it('builds JWT and updates the result pre through rendered controls', async () => {
    new JWTBuilderToolUI();
    await flushEffects();

    document.getElementById('key').value = 'secret';
    document.getElementById('iss').value = 'issuer';
    document.getElementById('exp').value = '2025-01-01T00:00:00Z';

    fireEvent.click(document.getElementById('buildJwtBtn'));
    await flushEffects();
    await flushEffects();

    expect(mockBuilder.buildJWT).toHaveBeenCalled();
    expect(document.getElementById('result')?.textContent).toBe('header.payload.signature');
    expect(NotificationManager.show).toHaveBeenCalledWith('JWT successfully built', 2000, { type: 'success' });
  });

  it('renders accessible algorithm controls and routes RS256 through the private key', async () => {
    new JWTBuilderToolUI();
    await flushEffects();

    const algorithm = document.getElementById('jwt-algorithm');
    const privateKey = document.getElementById('rsa-private-key');
    const hsPanel = document.getElementById('jwt-builder-hs256-key-panel');
    const rsPanel = document.getElementById('jwt-builder-rs256-key-panel');

    expect(document.querySelector('label[for="jwt-algorithm"]')?.textContent).toContain('Signing Algorithm');
    expect(document.querySelector('label[for="key"]')?.textContent).toContain('Shared Secret');
    expect(document.querySelector('label[for="rsa-private-key"]')?.textContent).toContain('Private Key');
    expect(algorithm?.getAttribute('aria-describedby')).toBe('jwt-builder-algorithm-help');
    expect(privateKey?.getAttribute('aria-describedby')).toContain('jwt-builder-rs256-key-help');
    expect(document.getElementById('jwt-builder-error-status')?.getAttribute('aria-atomic')).toBe('true');

    document.getElementById('result').textContent = 'stale.jwt.token';
    fireEvent.change(algorithm, { target: { value: 'RS256' } });
    await flushEffects();

    expect(hsPanel.hidden).toBe(true);
    expect(rsPanel.hidden).toBe(false);
    expect(document.getElementById('key').disabled).toBe(true);
    expect(privateKey.disabled).toBe(false);
    expect(document.getElementById('result')?.textContent).toBe('');
    expect(document.querySelector('button[aria-label="Generate a random secret key"]')?.closest('[hidden]')).toBe(hsPanel);

    privateKey.value = '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----';
    document.getElementById('iss').value = 'issuer';
    document.getElementById('exp').value = '2025-01-01T00:00:00Z';
    fireEvent.click(document.getElementById('buildJwtBtn'));
    await flushEffects();
    await flushEffects();

    expect(mockBuilder.buildJWT).toHaveBeenLastCalledWith(
      expect.objectContaining({ iss: 'issuer' }),
      '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
      'RS256'
    );
  });

  it('Load Sample resets claims and the secret via the rendered button', async () => {
    new JWTBuilderToolUI();
    await flushEffects();

    document.getElementById('iss').value = 'edited-issuer';
    document.getElementById('key').value = 'edited-secret';
    fireEvent.change(document.getElementById('jwt-algorithm'), { target: { value: 'RS256' } });
    document.getElementById('rsa-private-key').value = 'edited-private-key';

    fireEvent.click(document.getElementById('jwt-builder-sample-btn'));
    await flushEffects();

    expect(document.getElementById('iss')?.value).toBe('codesamplez.com');
    expect(document.getElementById('key')?.value).toBe('your-jwt-secret-key');
    expect(document.getElementById('rsa-private-key')?.value).toBe('');
    expect(document.getElementById('jwt-algorithm')?.value).toBe('HS256');
    expect(NotificationManager.show).toHaveBeenCalledWith('Sample claims loaded', 2000, { type: 'success' });
  });

  it('supports UI helpers from rendered buttons (add claim and random secret)', async () => {
    new JWTBuilderToolUI();
    await flushEffects();

    fireEvent.click(document.querySelector('.add-claim'));
    await flushEffects();
    expect(document.querySelector('.custom-claim-row')).not.toBeNull();

    fireEvent.click(document.querySelector('button[aria-label="Generate a random secret key"]'));
    await flushEffects();
    expect(document.getElementById('key')?.value).toBe('random-secret-key-32-chars-long!!');
    expect(NotificationManager.show).toHaveBeenCalledWith('Random secret generated', 2000, { type: 'success' });
  });

  it('wires submit and quick-set button handlers from rendered JSX', async () => {
    new JWTBuilderToolUI();
    await flushEffects();

    const form = document.getElementById('jwtForm');
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);
    expect(submitEvent.defaultPrevented).toBe(true);

    fireEvent.click(document.querySelector('button[aria-label="Set expiration to 1 hour from now"]'));
    fireEvent.click(document.querySelector('button[aria-label="Set expiration to 24 hours from now"]'));
    fireEvent.click(document.querySelector('button[aria-label="Set expiration to 7 days from now"]'));
    fireEvent.click(document.querySelector('button[aria-label="Set issued at to now"]'));
    fireEvent.click(document.querySelector('button[aria-label="Set not before to now"]'));
    await flushEffects();

    expect(mockBuilder.getFormattedDate).toHaveBeenCalled();
    expect(document.getElementById('exp')?.value).toBe('2024-01-01T00:00:00Z');
    expect(document.getElementById('iat')?.value).toBe('2024-01-01T00:00:00Z');
    expect(document.getElementById('nbf')?.value).toBe('2024-01-01T00:00:00Z');
  });

  it('uses prerendered root fallback and throws when no root exists', async () => {
    document.body.innerHTML = '<div id="jwt-builder-tool"></div>';
    new JWTBuilderToolUI('#missing-root');
    await flushEffects();
    expect(document.getElementById('buildJwtBtn')).not.toBeNull();

    document.body.innerHTML = '';
    expect(() => new JWTBuilderToolUI()).toThrow('JWT Builder root element not found');
  });

  it('bootstraps shell and app on DOMContentLoaded', async () => {
    document.body.innerHTML = `
      <div id="app-shell-header"></div>
      <div id="jwt-builder-app"></div>
      <div id="app-shell-footer"></div>
    `;

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushEffects();

    expect(mountToolShell).toHaveBeenCalledWith(expect.objectContaining({ title: 'JWT Builder' }));
    expect(document.getElementById('buildJwtBtn')).not.toBeNull();
  });

  it('logs and falls back when app bootstrap throws once', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockBuilder.getFormattedDate
      .mockImplementationOnce(() => { throw new Error('bootstrap date failure'); })
      .mockReturnValue('2024-01-01T00:00:00Z');

    document.body.innerHTML = `
      <div id="app-shell-header"></div>
      <div id="jwt-builder-app"></div>
      <div id="app-shell-footer"></div>
    `;

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushEffects();

    expect(consoleErrorSpy).toHaveBeenCalledWith('JWT builder UI bootstrap failed:', expect.any(Error));
    expect(document.getElementById('buildJwtBtn')).not.toBeNull();

    consoleErrorSpy.mockRestore();
  });
});
