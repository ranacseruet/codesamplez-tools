import '@testing-library/jest-dom';
import { fireEvent, waitFor } from '@testing-library/dom';
import { render as preactRender } from 'preact';

jest.mock('../common/DownloadManager', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        downloadFile: jest.fn()
    }))
}));

jest.mock('../common/notification-manager', () => ({
    NotificationManager: { show: jest.fn() }
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
    mountToolShell: jest.fn()
}));

// NOTE: `../common/drop-zone` is intentionally NOT mocked here. This suite
// exercises the real picker wiring end to end: it guards against regressions
// where the file input unmounts (e.g. by living inside a conditional branch)
// and the re-rendered picker silently carries no change listener.
import { NotificationManager } from '../common/notification-manager';
import { ImageEditorToolUI } from './script';

interface FakeBitmap {
    width: number;
    height: number;
    close: jest.Mock;
}

describe('ImageEditor picker persistence (real drop-zone wiring)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '<div id="image-editor-app"></div>';

        const universalCtx = new Proxy(
            {},
            {
                get: () => () => undefined,
                set: () => true
            }
        );
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
            configurable: true,
            value: jest.fn(() => universalCtx)
        });
        Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
            configurable: true,
            value: jest.fn(function (this: HTMLCanvasElement, callback: (blob: Blob | null) => void) {
                callback(null);
            })
        });

        (globalThis as Record<string, unknown>).createImageBitmap = jest.fn(() =>
            Promise.resolve({ width: 1200, height: 800, close: jest.fn() })
        );
    });

    afterEach(() => {
        const root = document.getElementById('image-editor-app');
        if (root) {
            preactRender(null, root);
        }
        delete (globalThis as Record<string, unknown>).createImageBitmap;
    });

    function byId(id: string): HTMLElement {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Expected element #${id} to exist`);
        }
        return element;
    }

    function pickFile(name: string): void {
        const input = byId('image-editor-file');
        if (!(input instanceof HTMLInputElement)) {
            throw new Error('Expected #image-editor-file to be an input');
        }
        const file = new File(['fake-image-bytes'], name, { type: 'image/png' });
        Object.defineProperty(input, 'files', { configurable: true, value: [file] });
        fireEvent.change(input);
    }

    it('loads a picked file, and loads another picked file after Remove', async () => {
        new ImageEditorToolUI();

        // The mount effect registers picker + drop zone asynchronously; the
        // drop target attribute marks the effect as flushed (the input is
        // registered earlier in the same effect).
        await waitFor(() =>
            expect(byId('image-editor-stage').getAttribute('data-drop-target')).toBe('true')
        );

        pickFile('first.png');
        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                expect.stringContaining('Loaded first.png'),
                2000,
                { type: 'success' }
            )
        );
        expect(byId('image-editor-info')).toHaveTextContent('first.png');

        fireEvent.click(byId('image-editor-clear'));
        await waitFor(() => expect(byId('image-editor-empty')).toBeInTheDocument());

        pickFile('second.png');
        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                expect.stringContaining('Loaded second.png'),
                2000,
                { type: 'success' }
            )
        );
        expect(byId('image-editor-info')).toHaveTextContent('second.png');
    });

    it('discards a superseded load when the first decode resolves last', async () => {
        new ImageEditorToolUI();
        await waitFor(() =>
            expect(byId('image-editor-stage').getAttribute('data-drop-target')).toBe('true')
        );

        let resolveFirst!: (bitmap: FakeBitmap) => void;
        let resolveSecond!: (bitmap: FakeBitmap) => void;
        (globalThis.createImageBitmap as jest.Mock)
            .mockImplementationOnce(
                () => new Promise<FakeBitmap>((resolve) => { resolveFirst = resolve; })
            )
            .mockImplementationOnce(
                () => new Promise<FakeBitmap>((resolve) => { resolveSecond = resolve; })
            );

        pickFile('first.png');
        pickFile('second.png');

        // The newer load resolves first and wins.
        resolveSecond({ width: 1200, height: 800, close: jest.fn() });
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('second.png'));

        // The stale decode resolves last: its pixels are freed, nothing is
        // installed, and no toast describes the wrong file.
        const closeFirst = jest.fn();
        resolveFirst({ width: 640, height: 480, close: closeFirst });
        await waitFor(() => expect(closeFirst).toHaveBeenCalled());
        expect(byId('image-editor-info')).toHaveTextContent('second.png');
        expect(NotificationManager.show).not.toHaveBeenCalledWith(
            expect.stringContaining('first.png'),
            expect.anything(),
            expect.anything()
        );
    });

    it('discards an in-flight rotate when the image is replaced first', async () => {
        new ImageEditorToolUI();
        await waitFor(() =>
            expect(byId('image-editor-stage').getAttribute('data-drop-target')).toBe('true')
        );

        pickFile('first.png');
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('first.png'));

        // The rotate bake hangs on its bitmap render while a replacement
        // pick (immediate default stub) installs a new image.
        let resolveRotate!: (bitmap: FakeBitmap) => void;
        (globalThis.createImageBitmap as jest.Mock).mockImplementationOnce(
            () => new Promise<FakeBitmap>((resolve) => { resolveRotate = resolve; })
        );
        fireEvent.click(byId('image-editor-rotate-right'));
        pickFile('second.png');
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('second.png'));

        // The stale bake resolves last: its pixels are freed, the new image
        // keeps its own bitmap, and no 'Rotated' toast fires for an edit
        // that never landed.
        const closeRotate = jest.fn();
        resolveRotate({ width: 800, height: 1200, close: closeRotate });
        await waitFor(() => expect(closeRotate).toHaveBeenCalled());
        expect(byId('image-editor-info')).toHaveTextContent('second.png');
        expect(NotificationManager.show).not.toHaveBeenCalledWith(
            'Rotated',
            expect.anything(),
            expect.anything()
        );
    });

    it('reports a picked file that fails to decode', async () => {
        new ImageEditorToolUI();
        await waitFor(() =>
            expect(byId('image-editor-stage').getAttribute('data-drop-target')).toBe('true')
        );

        (globalThis.createImageBitmap as jest.Mock).mockRejectedValueOnce(new Error('no decode'));
        pickFile('bad.png');

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                expect.stringContaining('Could not decode “bad.png”'),
                3000,
                { type: 'error' }
            )
        );
        expect(byId('image-editor-empty')).toBeInTheDocument();
    });

    it('rejects picked files that decode past the megapixel budget', async () => {
        new ImageEditorToolUI();
        await waitFor(() =>
            expect(byId('image-editor-stage').getAttribute('data-drop-target')).toBe('true')
        );

        (globalThis.createImageBitmap as jest.Mock).mockImplementationOnce(() =>
            Promise.resolve({ width: 6000, height: 5000, close: jest.fn() })
        );
        pickFile('huge.png');

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                expect.stringContaining('25 megapixels'),
                3000,
                { type: 'error' }
            )
        );
        expect(byId('image-editor-empty')).toBeInTheDocument();
    });

    it('stays silent when a superseded load fails to decode', async () => {
        new ImageEditorToolUI();
        await waitFor(() =>
            expect(byId('image-editor-stage').getAttribute('data-drop-target')).toBe('true')
        );

        (globalThis.createImageBitmap as jest.Mock).mockRejectedValueOnce(new Error('no decode'));
        pickFile('first.png');
        pickFile('second.png');

        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('second.png'));
        expect(NotificationManager.show).not.toHaveBeenCalledWith(
            expect.stringContaining('first.png'),
            expect.anything(),
            expect.anything()
        );
    });

    it('discards a stale sample build when a picked file wins', async () => {
        new ImageEditorToolUI();
        await waitFor(() =>
            expect(byId('image-editor-stage').getAttribute('data-drop-target')).toBe('true')
        );

        // Sample builds paint before decoding, so the context stub must
        // tolerate chained canvas calls; toBlob yields a real blob here.
        const chainableCtx: unknown = new Proxy(() => undefined, {
            get: () => chainableCtx,
            apply: () => chainableCtx,
            set: () => true
        });
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
            configurable: true,
            value: jest.fn(() => chainableCtx as CanvasRenderingContext2D)
        });
        Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
            configurable: true,
            value: jest.fn(function (this: HTMLCanvasElement, callback: (blob: Blob | null) => void) {
                callback(new Blob(['sample-bytes'], { type: 'image/png' }));
            })
        });

        // Call order is fixed: the pick decodes synchronously while the
        // sample build awaits its toBlob first, so the first queued result
        // belongs to the pick and the deferred one to the sample.
        let resolveSample!: (bitmap: FakeBitmap) => void;
        (globalThis.createImageBitmap as jest.Mock)
            .mockImplementationOnce(() =>
                Promise.resolve({ width: 1600, height: 1200, close: jest.fn() })
            )
            .mockImplementationOnce(
                () => new Promise<FakeBitmap>((resolve) => { resolveSample = resolve; })
            );
        fireEvent.click(byId('image-editor-load-sample'));
        pickFile('picked.png');

        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('picked.png'));

        const closeSample = jest.fn();
        resolveSample({ width: 1200, height: 800, close: closeSample });
        await waitFor(() => expect(closeSample).toHaveBeenCalled());
        expect(byId('image-editor-info')).toHaveTextContent('picked.png');
        expect(NotificationManager.show).not.toHaveBeenCalledWith(
            'Sample image loaded',
            expect.anything(),
            expect.anything()
        );
    });
});
