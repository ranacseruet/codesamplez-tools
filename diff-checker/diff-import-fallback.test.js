import { jest } from '@jest/globals';

// Force the lazily-imported diff-runner chunk to fail to load (simulating a
// cache-skew deploy or transient network error). This must happen before
// `./script` is imported, hence the dynamic import below.
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
// Resolve the scheduler yield immediately so the test does not depend on a
// real 20ms timer firing within the poll loop.
jest.unstable_mockModule('../common/scheduler-utils', () => ({
    scheduleTask: jest.fn().mockResolvedValue(undefined),
    nextFrame: jest.fn().mockResolvedValue(undefined)
}));
jest.unstable_mockModule('./diff-runner', () => {
    throw new Error('chunk load failed');
});

describe('DiffChecker lazy-chunk import failure', () => {
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

    it('degrades to a main-thread diff when the diff-runner chunk fails to load', async () => {
        initializeDiffChecker();

        // Over the 20k-char threshold so the offload path (and thus the failing
        // dynamic import) is taken.
        const base = 'line of content here\n'.repeat(600);
        document.getElementById('text1').value = `${base}alpha`;
        document.getElementById('text2').value = `${base}omega`;
        document.getElementById('compare-button').click();

        // Despite the runner chunk failing to load, the catch-fallback still
        // produces a rendered diff rather than leaving the result empty.
        const result = document.getElementById('diff-result');
        for (let i = 0; i < 30 && result.children.length === 0; i += 1) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        expect(result.children.length).toBeGreaterThan(0);
    });
});
