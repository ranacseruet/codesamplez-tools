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

    it('renders a 5,000-line comparison in both views through the offload path', async () => {
        document.body.insertAdjacentHTML('beforeend', `
            <input type="radio" name="diff-view" value="unified" id="diff-view-unified" checked>
            <input type="radio" name="diff-view" value="split" id="diff-view-split">
        `);
        initializeDiffChecker();

        const prefix = 'const value = 1;\n'.repeat(5000);
        const original = `${prefix}alpha`;
        const modified = `${prefix}omega`;
        expect(original.length + modified.length).toBeGreaterThan(20000);
        document.getElementById('text1').value = original;
        document.getElementById('text2').value = modified;

        const started = Date.now();
        document.getElementById('compare-button').click();
        const result = document.getElementById('diff-result');
        for (let i = 0; i < 80 && result.querySelector('.diff-fold') === null; i += 1) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        expect(result.querySelector('.diff-fold')).not.toBeNull();
        expect(result.querySelectorAll('.diff-line').length).toBeLessThan(40);
        expect(result.dataset.resultView).toBe('unified');

        document.getElementById('diff-view-split').checked = true;
        document.getElementById('diff-view-split').dispatchEvent(new Event('change', { bubbles: true }));

        expect(result.dataset.resultView).toBe('split');
        expect(result.querySelector('.diff-split-row')).not.toBeNull();
        expect(result.querySelector('.diff-fold')).not.toBeNull();
        expect(result.querySelectorAll('.diff-line').length).toBeLessThan(40);
        expect(result.querySelector('.diff-marker').textContent).toMatch(/^[+-]$/);
        expect(Date.now() - started).toBeLessThan(8000);
    });
});
