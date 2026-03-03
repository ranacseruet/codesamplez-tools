import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/dom';
import { render as preactRender } from 'preact';

jest.mock('qrcode', () => ({
    __esModule: true,
    default: {
        toCanvas: jest.fn((canvas, text, options, callback) => callback(null))
    }
}));

jest.mock('../common/DownloadManager', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        downloadFile: jest.fn()
    }))
}));

jest.mock('../common/clear-button/ClearButton', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        updateVisibility: jest.fn(),
        disconnect: jest.fn()
    }))
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
    mountToolShell: jest.fn()
}));

import { mountToolShell } from '../common/app-shell/mountToolShell';
import QRCode from 'qrcode';
import { QRCodeGeneratorToolUI } from './script';
import ClearButton from '../common/clear-button/ClearButton';

describe('QRCodeGenerator Preact runtime', () => {
    const flush = () => Promise.resolve();
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = async (predicate, timeoutMs = 1000) => {
        const start = Date.now();
        while (!predicate()) {
            if (Date.now() - start > timeoutMs) {
                throw new Error('Timed out waiting for condition');
            }
            await wait(20);
        }
    };
    const flushEffects = async () => {
        await flush();
        await flush();
    };

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '<div id="qr-code-generator-app"></div>';

        Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
            configurable: true,
            value: jest.fn(() => 'data:image/png;base64,mockdata')
        });
    });

    it('renders defaults and generates QR after debounce', async () => {
        new QRCodeGeneratorToolUI();
        await flushEffects();
        await waitFor(() => QRCode.toCanvas.mock.calls.length >= 1);
        await flushEffects();

        expect(document.getElementById('qr-text')?.value).toBe('https://codesamplez.com');
        expect(document.getElementById('size-label')?.textContent).toBe('256px');
        expect(QRCode.toCanvas).toHaveBeenCalledTimes(1);
    });

    it('shows error and hides canvas for empty input', async () => {
        new QRCodeGeneratorToolUI();
        await flushEffects();

        const input = document.getElementById('qr-text');
        fireEvent.input(input, { target: { value: '' } });
        await wait(300);
        await flushEffects();

        expect(document.getElementById('error-message')?.textContent).toContain('Please enter text or a URL');
        expect(document.getElementById('qr-canvas')?.style.display).toBe('none');
    });

    it('updates sliders and downloads generated QR image', async () => {
        new QRCodeGeneratorToolUI();
        await flushEffects();

        const sizeSlider = document.getElementById('qr-size');
        const marginSlider = document.getElementById('qr-margin');
        fireEvent.input(sizeSlider, { target: { value: '320' } });
        fireEvent.input(marginSlider, { target: { value: '4' } });
        await wait(300);
        await flushEffects();

        expect(document.getElementById('size-label')?.textContent).toBe('320px');
        expect(document.getElementById('margin-label')?.textContent).toBe('4');
        expect(QRCode.toCanvas).toHaveBeenLastCalledWith(
            expect.anything(),
            expect.any(String),
            expect.objectContaining({ width: 320, height: 320, margin: 4 }),
            expect.any(Function)
        );

        fireEvent.click(document.getElementById('download-btn'));
        expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/png');
    });

    it('updates error correction and shows QR library callback error state', async () => {
        new QRCodeGeneratorToolUI();
        await flushEffects();
        await wait(300);
        await flushEffects();

        QRCode.toCanvas.mockClear();
        QRCode.toCanvas.mockImplementationOnce((canvas, text, options, callback) => callback(new Error('Too long')));

        const errorCorrectionSelect = document.getElementById('error-correction');
        fireEvent.change(errorCorrectionSelect, { target: { value: 'H' } });
        await wait(300);
        await flushEffects();

        expect(QRCode.toCanvas).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(String),
            expect.objectContaining({ errorCorrectionLevel: 'H' }),
            expect.any(Function)
        );
        expect(document.getElementById('error-message')?.textContent).toContain('Input data is too long');
        expect(document.getElementById('qr-canvas')?.style.display).toBe('none');
    });

    it('handles textCleared event and disconnects clear button on unmount', async () => {
        new QRCodeGeneratorToolUI();
        await flushEffects();
        await wait(300);
        await flushEffects();

        const input = document.getElementById('qr-text');
        fireEvent.input(input, { target: { value: 'temporary value' } });
        await wait(300);
        await flushEffects();

        input.value = '';
        input.dispatchEvent(new CustomEvent('textCleared', { bubbles: true }));
        await wait(300);
        await flushEffects();

        expect(document.getElementById('qr-text')?.value).toBe('');

        const clearButtonInstance = ClearButton.mock.results.at(-1)?.value;
        preactRender(null, document.getElementById('qr-code-generator-app'));
        await flushEffects();
        expect(clearButtonInstance.disconnect).toHaveBeenCalled();
    });

    it('uses prerendered root fallback when explicit root selector is missing', async () => {
        document.body.innerHTML = '<div id="qr-code-generator-tool"></div>';

        new QRCodeGeneratorToolUI('#missing-root');
        await flushEffects();
        await wait(300);
        await flushEffects();

        expect(document.getElementById('qr-text')).not.toBeNull();
    });

    it('throws when no mount root is available', () => {
        document.body.innerHTML = '';
        expect(() => new QRCodeGeneratorToolUI()).toThrow('QR Code Generator root element not found');
    });

    it('bootstraps shell and app on DOMContentLoaded', async () => {
        document.body.innerHTML = `
            <div id="app-shell-header"></div>
            <div id="qr-code-generator-app"></div>
            <div id="app-shell-footer"></div>
        `;

        document.dispatchEvent(new Event('DOMContentLoaded'));
        await flushEffects();
        await wait(300);
        await flushEffects();

        expect(mountToolShell).toHaveBeenCalledWith(expect.objectContaining({
            title: 'QR Code Generator'
        }));
        expect(document.getElementById('qr-text')).not.toBeNull();
    });
});
