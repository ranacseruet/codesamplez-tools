import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/dom';

// Force the lazily-imported worker chunk to fail to load (simulating a
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
jest.unstable_mockModule('./analyzer-runner', () => {
    throw new Error('chunk load failed');
});

describe('TextAnalyzer lazy-chunk import failure', () => {
    let TextAnalyzerToolUI;

    const flushEffects = async () => {
        await Promise.resolve();
        await Promise.resolve();
    };

    beforeAll(async () => {
        ({ TextAnalyzerToolUI } = await import('./script'));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '<div id="text-analyzer-app"></div>';
    });

    it('degrades to main-thread analysis when the analyzer-runner chunk fails to load', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

        const largeText = 'word '.repeat(1100); // 5500 chars, 1100 words — async path
        const input = document.getElementById('textInput');
        fireEvent.input(input, { target: { value: largeText } });

        for (let i = 0; i < 20 && document.getElementById('wordCount')?.textContent !== '1100'; i += 1) {
            await flushEffects();
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        // Despite the worker chunk failing to load, the catch-fallback still
        // produces correct stats rather than leaving them stale/empty.
        expect(document.getElementById('wordCount')?.textContent).toBe('1100');
        expect(document.getElementById('charCount')?.textContent).toBe('5500');
    });
});
