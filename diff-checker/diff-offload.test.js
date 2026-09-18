import { jest } from '@jest/globals';

// Exercises the large-input offload path end-to-end. jsdom provides no Worker,
// so the worker runner falls back to a main-thread computeDiff — the result
// must still render. ESM file so the lazy `import('./diff-runner')` resolves
// deterministically.
jest.unstable_mockModule('../common/notification-manager', () => ({
    NotificationManager: { show: jest.fn() }
}));
jest.unstable_mockModule('../common/app-shell/mountToolShell', () => ({
    mountToolShell: jest.fn()
}));
jest.unstable_mockModule('../common/clear-button/ClearButton', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        updateVisibility: jest.fn(),
        disconnect: jest.fn()
    }))
}));
// Resolve the scheduler yield immediately so the test does not depend on a real
// 20ms timer firing within the poll loop.
jest.unstable_mockModule('../common/scheduler-utils', () => ({
    scheduleTask: jest.fn().mockResolvedValue(undefined),
    nextFrame: jest.fn().mockResolvedValue(undefined)
}));

describe('DiffChecker large-input offload', () => {
    let initializeDiffChecker;

    beforeAll(async () => {
        ({ initializeDiffChecker } = await import('./script'));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = `
            <textarea id="text1"></textarea>
            <textarea id="text2"></textarea>
            <button id="compare-button">Compare</button>
            <div id="diff-result"></div>
            <button id="prev-diff-button"></button>
            <button id="next-diff-button"></button>
            <span id="diff-counter"></span>
            <input type="checkbox" id="ignore-whitespace">
            <div id="notification"></div>
        `;
    });

    it('renders a diff for over-threshold input through the worker runner fallback', async () => {
        initializeDiffChecker();

        // Over the 20k-char combined threshold so the offload path is taken.
        const base = 'line of content here\n'.repeat(600); // ~12.6k chars each
        document.getElementById('text1').value = `${base}alpha`;
        document.getElementById('text2').value = `${base}omega`;
        document.getElementById('compare-button').click();

        // A rendered diff (output children) is proof the offloaded compute
        // resolved via the runner's main-thread fallback (jsdom has no Worker).
        const result = document.getElementById('diff-result');
        for (let i = 0; i < 30 && result.children.length === 0; i += 1) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        expect(result.children.length).toBeGreaterThan(0);
    });
});
