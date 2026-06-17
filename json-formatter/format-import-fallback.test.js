import { jest } from '@jest/globals';

// Force the lazily-imported format-runner chunk to fail to load (simulating a
// cache-skew deploy or transient network error). The dispatch must still
// produce a formatted tree via the main-thread fallback baked into
// createLazyRunner.
jest.unstable_mockModule('../common/notification-manager', () => ({
    NotificationManager: { show: jest.fn() }
}));
jest.unstable_mockModule('../common/format-utils', () => ({
    formatBytes: jest.fn((bytes) => `${bytes} bytes`)
}));
jest.unstable_mockModule('../common/DownloadManager', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({ downloadFile: jest.fn() }))
}));
jest.unstable_mockModule('../common/clear-button/ClearButton', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({ updateVisibility: jest.fn(), disconnect: jest.fn() }))
}));
jest.unstable_mockModule('../common/app-shell/mountToolShell', () => ({
    mountToolShell: jest.fn()
}));
jest.unstable_mockModule('../common/scheduler-utils', () => ({
    scheduleTask: jest.fn().mockResolvedValue(undefined),
    nextFrame: jest.fn().mockResolvedValue(undefined)
}));
jest.unstable_mockModule('./format-runner', () => {
    throw new Error('chunk load failed');
});

describe('JSON formatter lazy-chunk import failure', () => {
    let JSONFormatterToolUI;

    beforeAll(async () => {
        ({ JSONFormatterToolUI } = await import('./script'));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '<div id="json-formatter-app"></div>';
    });

    it('degrades to a main-thread format when the format-runner chunk fails to load', async () => {
        const tool = new JSONFormatterToolUI();

        const large = {};
        for (let i = 0; i < 3000; i += 1) {
            large[`key${i}`] = `value-${i}`;
        }
        const input = document.querySelector('.c-input.c-input--textarea');
        input.value = JSON.stringify(large);
        expect(input.value.length).toBeGreaterThan(50_000);

        await tool.formatter.formatJSON();

        // Despite the runner chunk failing to load (mocked to throw on import),
        // the catch-fallback in createLazyRunner still produces the full tree
        // rather than leaving the output empty.
        const output = document.querySelector('.c-code-output code');
        expect(output.querySelectorAll('.json-key').length).toBe(3000);
    });
});
