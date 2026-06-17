import { jest } from '@jest/globals';

// Exercises the large-input offload path end-to-end. jsdom provides no Worker,
// so the format worker runner falls back to a main-thread formatJson — the tree
// must still render. ESM file so the lazy `import('./format-runner')` resolves
// deterministically.
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
// Resolve scheduler yields immediately so the test does not depend on real timers.
jest.unstable_mockModule('../common/scheduler-utils', () => ({
    scheduleTask: jest.fn().mockResolvedValue(undefined),
    nextFrame: jest.fn().mockResolvedValue(undefined)
}));

describe('JSON formatter large-input offload', () => {
    let JSONFormatterToolUI;

    beforeAll(async () => {
        ({ JSONFormatterToolUI } = await import('./script'));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '<div id="json-formatter-app"></div>';
    });

    it('formats over-threshold input through the worker runner fallback', async () => {
        const tool = new JSONFormatterToolUI();

        // Build a valid JSON string over the 50k-char threshold.
        const large = {};
        for (let i = 0; i < 3000; i += 1) {
            large[`key${i}`] = `value-${i}`;
        }
        const input = document.querySelector('.c-input.c-input--textarea');
        input.value = JSON.stringify(large);
        expect(input.value.length).toBeGreaterThan(50_000);

        // Await the format directly (the button→formatJSON wiring is covered in
        // json-formatter.test.js). This drives the offload path deterministically:
        // lazy import the runner → no Worker in jsdom → main-thread formatJson
        // fallback → feed the tree renderer.
        await tool.formatter.formatJSON();

        // A populated tree (json-key spans) proves the offloaded compute resolved.
        const output = document.querySelector('.c-code-output code');
        expect(output.querySelectorAll('.json-key').length).toBe(3000);
        // Plain-view text is the stringified result.
        expect(tool.formatter.plainViewTextarea.value).toContain('"key0": "value-0"');
    });
});
