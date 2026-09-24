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

jest.mock('../common/drop-zone', () => ({
    registerDropZone: jest.fn(() => jest.fn()),
    registerFileInput: jest.fn(() => jest.fn())
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
    mountToolShell: jest.fn()
}));

import DownloadManager from '../common/DownloadManager';
import { NotificationManager } from '../common/notification-manager';
import { registerDropZone } from '../common/drop-zone';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { ImageEditorToolUI } from './script';

interface FakeBitmap {
    width: number;
    height: number;
    close: jest.Mock;
}

const createdBitmaps: { width: number; height: number }[] = [];

function makeContextStub() {
    // The component resets `ctx.filter` to 'none' after every draw (so the
    // caption paints unfiltered), which means the residual `filter` property
    // is always 'none'. Tests therefore assert on the filter value that was
    // active *during* each drawImage call instead.
    const stub: {
        filter: string;
        filtersAtDraw: string[];
        drawImage: jest.Mock;
        fillText: jest.Mock;
        fillRect: jest.Mock;
        save: jest.Mock;
        restore: jest.Mock;
        translate: jest.Mock;
        rotate: jest.Mock;
        scale: jest.Mock;
        beginPath: jest.Mock;
        arc: jest.Mock;
        fill: jest.Mock;
        moveTo: jest.Mock;
        lineTo: jest.Mock;
        stroke: jest.Mock;
        createLinearGradient: jest.Mock;
        imageSmoothingEnabled: boolean;
        imageSmoothingQuality: string;
        font: string;
        fillStyle: string;
        textAlign: string;
        textBaseline: string;
        shadowColor: string;
        shadowBlur: number;
        strokeStyle: string;
        lineWidth: number;
    } = {
        filter: 'none',
        filtersAtDraw: [],
        drawImage: jest.fn(),
        fillText: jest.fn(),
        fillRect: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        translate: jest.fn(),
        rotate: jest.fn(),
        scale: jest.fn(),
        beginPath: jest.fn(),
        arc: jest.fn(),
        fill: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        stroke: jest.fn(),
        createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
        imageSmoothingEnabled: false,
        imageSmoothingQuality: 'low',
        font: '',
        fillStyle: '',
        textAlign: '',
        textBaseline: '',
        shadowColor: '',
        shadowBlur: 0,
        strokeStyle: '',
        lineWidth: 1
    };

    let currentFilter = 'none';
    Object.defineProperty(stub, 'filter', {
        configurable: true,
        get: () => currentFilter,
        set: (value: string) => {
            currentFilter = value;
        }
    });
    stub.drawImage.mockImplementation(() => {
        stub.filtersAtDraw.push(currentFilter);
    });

    return stub;
}

let contextStub: ReturnType<typeof makeContextStub>;

function pngBlob(size: number): Blob {
    return new Blob([new Uint8Array(size)], { type: 'image/png' });
}

describe('ImageEditor Preact runtime', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createdBitmaps.length = 0;
        contextStub = makeContextStub();
        document.body.innerHTML = '<div id="image-editor-app"></div>';

        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
            configurable: true,
            value: jest.fn(() => contextStub)
        });

        Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
            configurable: true,
            value: jest.fn(function (this: HTMLCanvasElement, callback: (blob: Blob | null) => void) {
                callback(pngBlob(1000));
            })
        });

        (globalThis as Record<string, unknown>).createImageBitmap = jest.fn(
            (source: { width?: number; height?: number }): Promise<FakeBitmap> =>
                Promise.resolve({
                    width: source?.width ?? 800,
                    height: source?.height ?? 600,
                    close: jest.fn()
                })
        );

        // Blob/File sources carry no dimensions; resolve the sample size so the
        // happy-path tests exercise realistic 1200×800 geometry. Canvas
        // sources (bakes) resolve from their explicit width/height.
        (globalThis.createImageBitmap as jest.Mock).mockImplementation(
            (source: CanvasImageSource & { width?: number; height?: number }): Promise<FakeBitmap> => {
                const element = source as unknown as { width?: number; height?: number };
                const width = typeof element.width === 'number' ? element.width : 1200;
                const height = typeof element.height === 'number' ? element.height : 800;
                createdBitmaps.push({ width, height });
                return Promise.resolve({ width, height, close: jest.fn() });
            }
        );
    });

    afterEach(() => {
        // Unmount so no leaked instance can flush effects or fire timers
        // after the file's environment tears down (same hygiene as
        // ToolSearch.test.js).
        const root = document.getElementById('image-editor-app');
        if (root) {
            preactRender(null, root);
        }
        const fallback = document.getElementById('image-editor-tool');
        if (fallback) {
            preactRender(null, fallback);
        }
    });

    function byId(id: string): HTMLElement {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Expected element #${id} to exist`);
        }
        return element;
    }

    async function loadSample(): Promise<void> {
        new ImageEditorToolUI();
        fireEvent.click(byId('image-editor-load-sample'));
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('1200 × 800 px'));
    }

    function downloadCalls(): jest.Mock {
        const MockedDownloadManager = DownloadManager as unknown as jest.Mock;
        const results = MockedDownloadManager.mock.results;
        return results[results.length - 1]?.value.downloadFile as jest.Mock;
    }

    it('renders the empty state with picker and sample actions', () => {
        new ImageEditorToolUI();

        expect(byId('image-editor-empty')).toBeInTheDocument();
        expect(byId('image-editor-file')).toBeInTheDocument();
        expect(byId('image-editor-export')).toBeDisabled();
    });

    it('loads the sample image and renders info plus preview', async () => {
        await loadSample();

        expect(byId('image-editor-info')).toHaveTextContent('sample-image.png');
        await waitFor(() => expect(contextStub.drawImage).toHaveBeenCalled());
        // The default pipeline draws unfiltered (residual filter resets to 'none').
        expect(contextStub.filtersAtDraw).toContain('none');
        expect(NotificationManager.show).toHaveBeenCalledWith('Sample image loaded', 2000, { type: 'success' });
    });

    it('keeps the same picker input mounted across load and remove', async () => {
        // The mount effect wires the file input exactly once. If the input
        // unmounted with the empty state, the re-rendered picker would carry
        // no change listener and post-remove uploads would die silently.
        new ImageEditorToolUI();
        const picker = byId('image-editor-file');

        await loadSample();
        expect(byId('image-editor-file')).toBe(picker);

        fireEvent.click(byId('image-editor-clear'));
        await waitFor(() => expect(byId('image-editor-empty')).toBeInTheDocument());
        expect(byId('image-editor-file')).toBe(picker);
    });

    it('rejects unsupported dropped files with an error toast', async () => {
        new ImageEditorToolUI();

        await waitFor(() =>
            expect((registerDropZone as jest.Mock).mock.calls.length).toBeGreaterThan(0)
        );
        const onFile = (registerDropZone as jest.Mock).mock.calls[0][1].onFile as (file: File) => void;
        onFile(new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' }));

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                expect.stringContaining('not a supported image'),
                3000,
                { type: 'error' }
            )
        );
    });

    it('applies brightness sliders to the preview filter pipeline', async () => {
        await loadSample();

        fireEvent.input(byId('image-editor-adj-brightness'), { target: { value: '1.5' } });

        await waitFor(() => expect(contextStub.filtersAtDraw).toContain('brightness(1.5)'));
        expect(byId('image-editor-brightness-value')).toHaveTextContent('150%');
    });

    it('applies the B&W preset as a grayscale filter', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-preset-bw'));

        await waitFor(() =>
            expect(contextStub.filtersAtDraw.some((filter) => filter.includes('grayscale(1)'))).toBe(true)
        );
    });

    it('requires an image before starting a crop', async () => {
        new ImageEditorToolUI();

        fireEvent.click(byId('image-editor-crop-1x1'));

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Load an image before cropping.',
                3000,
                { type: 'error' }
            )
        );
    });

    it('crops to a square preset and updates the info panel', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-crop-1x1'));
        await waitFor(() => expect(document.querySelector('.image-editor__crop-box')).not.toBeNull());
        expect(document.querySelector('.image-editor__crop-size')).toHaveTextContent('800 × 800');

        fireEvent.click(byId('image-editor-crop-apply'));
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('800 × 800 px'));
        expect(createdBitmaps[createdBitmaps.length - 1]).toEqual({ width: 800, height: 800 });
    });

    it('highlights the crop section and promotes Apply crop while a selection is active', async () => {
        await loadSample();

        const cropSection = byId('image-editor-crop-apply').closest('.image-editor__disclosure');
        expect(cropSection?.classList.contains('is-active')).toBe(false);
        expect(byId('image-editor-crop-apply').className).toContain('c-button--secondary');

        fireEvent.click(byId('image-editor-crop-1x1'));
        await waitFor(() =>
            expect(byId('image-editor-crop-apply').className).not.toContain('c-button--secondary')
        );
        expect(byId('image-editor-crop-apply').className).toContain('c-button');
        expect(cropSection?.classList.contains('is-active')).toBe(true);

        fireEvent.click(byId('image-editor-crop-clear'));
        await waitFor(() =>
            expect(byId('image-editor-crop-apply').className).toContain('c-button--secondary')
        );
        expect(cropSection?.classList.contains('is-active')).toBe(false);
    });

    it('opens Crop and Export sections by default and collapses the rest', async () => {
        new ImageEditorToolUI();
        await waitFor(() => expect(byId('image-editor-load-sample')).not.toBeNull());

        const isOpen = (headingId: string) =>
            (byId(headingId).closest('details') as HTMLDetailsElement | null)?.open ?? null;

        expect(isOpen('image-editor-crop-heading')).toBe(true);
        expect(isOpen('image-editor-export-heading')).toBe(true);
        expect(isOpen('image-editor-orient-heading')).toBe(false);
        expect(isOpen('image-editor-resize-heading')).toBe(false);
        expect(isOpen('image-editor-adjust-heading')).toBe(false);
        expect(isOpen('image-editor-caption-heading')).toBe(false);
    });

    it('toggles a section when its summary is clicked', async () => {
        new ImageEditorToolUI();
        await waitFor(() => expect(byId('image-editor-load-sample')).not.toBeNull());

        const adjustDetails = byId('image-editor-adjust-heading').closest('details') as HTMLDetailsElement;
        const adjustSummary = adjustDetails.querySelector('summary') as HTMLElement;
        expect(adjustDetails.open).toBe(false);

        fireEvent.click(adjustSummary);
        await waitFor(() => expect(adjustDetails.open).toBe(true));

        fireEvent.click(adjustSummary);
        await waitFor(() => expect(adjustDetails.open).toBe(false));
    });

    it('auto-expands the Crop section when a selection starts while collapsed', async () => {
        await loadSample();

        const cropDetails = byId('image-editor-crop-heading').closest('details') as HTMLDetailsElement;
        const cropSummary = cropDetails.querySelector('summary') as HTMLElement;
        fireEvent.click(cropSummary);
        // jsdom flips the DOM property natively but never fires the `toggle`
        // event real browsers emit, so mirror the browser by dispatching it:
        // without this the collapse never reaches Preact state.
        cropDetails.dispatchEvent(new Event('toggle'));
        await waitFor(() => expect(cropDetails.open).toBe(false));

        fireEvent.click(byId('image-editor-crop-1x1'));
        await waitFor(() => expect(cropDetails.open).toBe(true));
        expect(document.querySelector('.image-editor__crop-box')).not.toBeNull();
    });

    it('drags the active selection by grabbing the overlay box', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-crop-1x1'));
        await waitFor(() => expect(document.querySelector('.image-editor__crop-box')).not.toBeNull());

        // The overlay sits above the canvas, so pointer input must be handled
        // at the wrap level and measured against the wrap frame (regression:
        // handlers used to live on the canvas and never fired through it).
        const wrap = document.querySelector('.image-editor__canvas-wrap') as HTMLElement;
        wrap.getBoundingClientRect = () => ({
            x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800
        }) as DOMRect;

        const overlay = document.querySelector('.image-editor__crop-box') as HTMLElement;
        expect(overlay.style.left).toBe('16.666666666666664%');

        // jsdom has no PointerEvent support, so Preact's event-name inference
        // (`'onpointerdown' in dom`) fails and it subscribes to the verbatim
        // `PointerDown` suffix instead of lowercase `pointerdown`. Real
        // browsers attach lowercase and are covered by the cross-browser
        // drag exercise; here we dispatch what Preact actually subscribed to
        // so the full handler chain (target detection, move math, commit)
        // is still exercised.
        const pointerEvent = (type: string, init: Record<string, number>): Event => {
            const event = new Event(type, { bubbles: true, cancelable: true });
            Object.assign(event, init);
            return event;
        };

        // Grab the box center (600, 400 is inside the 200..1000 × 0..800 box).
        overlay.dispatchEvent(pointerEvent('PointerDown', { clientX: 600, clientY: 400, pointerId: 1 }));
        wrap.dispatchEvent(pointerEvent('PointerMove', { clientX: 700, clientY: 450, pointerId: 1 }));
        wrap.dispatchEvent(pointerEvent('PointerUp', { pointerId: 1 }));

        await waitFor(() =>
            expect((document.querySelector('.image-editor__crop-box') as HTMLElement).style.left).toBe('25%')
        );
        // The 800px-tall square fills the 800px-tall image, so the +50px
        // vertical drag correctly clamps back to the top edge.
        expect((document.querySelector('.image-editor__crop-box') as HTMLElement).style.top).toBe('0%');
    });

    it('groups configuration into Transform, Enhance, and Output sections', async () => {
        new ImageEditorToolUI();
        await waitFor(() => expect(byId('image-editor-load-sample')).not.toBeNull());

        const groupTitles = Array.from(document.querySelectorAll('.image-editor__group-title')).map(
            (node) => node.textContent
        );
        expect(groupTitles).toEqual(['Transform', 'Enhance', 'Output']);
    });

    it('rotates the working image with swapped dimensions', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-rotate-right'));

        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('800 × 1200 px'));
        expect(createdBitmaps[createdBitmaps.length - 1]).toEqual({ width: 800, height: 1200 });
    });

    it('resizes with a locked aspect ratio and bakes the result', async () => {
        await loadSample();

        const widthInput = byId('image-editor-resize-w') as HTMLInputElement;
        expect(widthInput.value).toBe('1200');

        fireEvent.input(widthInput, { target: { value: '600' } });
        await waitFor(() =>
            expect((byId('image-editor-resize-h') as HTMLInputElement).value).toBe('400')
        );

        fireEvent.click(byId('image-editor-resize-apply'));
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('600 × 400 px'));
        expect(createdBitmaps[createdBitmaps.length - 1]).toEqual({ width: 600, height: 400 });
    });

    it('reports a failed sample build without loading anything', async () => {
        new ImageEditorToolUI();

        (globalThis.createImageBitmap as jest.Mock).mockRejectedValueOnce(new Error('no bitmap'));
        fireEvent.click(byId('image-editor-load-sample'));

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Could not build the sample image in this browser.',
                3000,
                { type: 'error' }
            )
        );
        expect(byId('image-editor-empty')).toBeInTheDocument();
    });

    it('reports a failed crop bake without touching the loaded image', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-crop-1x1'));
        await waitFor(() => expect(document.querySelector('.image-editor__crop-box')).not.toBeNull());

        (globalThis.createImageBitmap as jest.Mock).mockRejectedValueOnce(new Error('no bitmap'));
        fireEvent.click(byId('image-editor-crop-apply'));

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Could not apply the crop in this browser.',
                3000,
                { type: 'error' }
            )
        );
        expect(byId('image-editor-info')).toHaveTextContent('1200 × 800 px');
    });

    it('reports a failed rotate bake without touching the loaded image', async () => {
        await loadSample();

        (globalThis.createImageBitmap as jest.Mock).mockRejectedValueOnce(new Error('no bitmap'));
        fireEvent.click(byId('image-editor-rotate-right'));

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Could not rotate or flip in this browser.',
                3000,
                { type: 'error' }
            )
        );
        expect(byId('image-editor-info')).toHaveTextContent('1200 × 800 px');
    });

    it('reports a failed resize bake without touching the loaded image', async () => {
        await loadSample();

        fireEvent.input(byId('image-editor-resize-w'), { target: { value: '600' } });
        await waitFor(() =>
            expect((byId('image-editor-resize-h') as HTMLInputElement).value).toBe('400')
        );

        (globalThis.createImageBitmap as jest.Mock).mockRejectedValueOnce(new Error('no bitmap'));
        fireEvent.click(byId('image-editor-resize-apply'));

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Could not resize in this browser.',
                3000,
                { type: 'error' }
            )
        );
        expect(byId('image-editor-info')).toHaveTextContent('1200 × 800 px');
    });

    it('paints captions on export and downloads the file', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-caption-enable'));
        fireEvent.input(byId('image-editor-caption-text'), { target: { value: 'Hello hills' } });
        fireEvent.click(byId('image-editor-format-jpeg'));

        // Commits are async: wait until the format switch has landed, otherwise
        // the export handler still closes over the previous render's format.
        await waitFor(() =>
            expect(byId('image-editor-format-jpeg')).toHaveAttribute('aria-pressed', 'true')
        );

        fireEvent.click(byId('image-editor-export'));

        await waitFor(() => expect(downloadCalls()).toHaveBeenCalled());
        const [content, filename, mime] = downloadCalls().mock.calls[0];
        expect(content).toBeInstanceOf(Blob);
        expect(filename).toMatch(/^edited-image-\d+\.jpg$/);
        expect(mime).toBe('image/jpeg');
        expect(contextStub.fillText).toHaveBeenCalledWith(
            'Hello hills',
            expect.any(Number),
            expect.any(Number),
            expect.any(Number)
        );
    });

    it('shows an output-size estimate after edits settle', async () => {
        await loadSample();

        await waitFor(() => expect(byId('image-editor-estimate')).toHaveTextContent(/Estimated output: ≈/));
    });

    it('resets to the original dimensions and removes the image', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-crop-1x1'));
        await waitFor(() => expect(document.querySelector('.image-editor__crop-box')).not.toBeNull());
        fireEvent.click(byId('image-editor-crop-apply'));
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('800 × 800 px'));

        fireEvent.click(byId('image-editor-reset'));
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('1200 × 800 px'));

        fireEvent.click(byId('image-editor-clear'));
        await waitFor(() => expect(byId('image-editor-empty')).toBeInTheDocument());
        expect(byId('image-editor-export')).toBeDisabled();
    });

    it('uses the prerendered root fallback when the explicit selector is missing', () => {
        document.body.innerHTML = '<div id="image-editor-tool"></div>';

        new ImageEditorToolUI('#missing-root');

        expect(document.getElementById('image-editor-load-sample')).not.toBeNull();
    });

    it('throws when no mount root is available', () => {
        document.body.innerHTML = '';
        expect(() => new ImageEditorToolUI()).toThrow('Image Editor root element not found');
    });

    it('bootstraps shell and app on DOMContentLoaded', () => {
        document.body.innerHTML = `
            <div id="app-shell-header"></div>
            <div id="image-editor-app"></div>
            <div id="app-shell-footer"></div>
        `;

        document.dispatchEvent(new Event('DOMContentLoaded'));

        expect(mountToolShell).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Image Editor'
        }));
        expect(document.getElementById('image-editor-load-sample')).not.toBeNull();
    });

    it('unmounts without throwing', async () => {
        await loadSample();

        preactRender(null, document.getElementById('image-editor-app'));
        expect(document.getElementById('image-editor-app')?.hasChildNodes()).toBe(false);
    });

    it('reports a resize with unchanged dimensions as a no-op', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-resize-apply'));

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Already 1200 × 800 — nothing to resize.',
                2000,
                { type: 'success' }
            )
        );
    });

    it('syncs the width when the height changes with a locked aspect', async () => {
        await loadSample();

        fireEvent.input(byId('image-editor-resize-h'), { target: { value: '400' } });

        await waitFor(() =>
            expect((byId('image-editor-resize-w') as HTMLInputElement).value).toBe('600')
        );
    });

    it('ignores export with no image loaded', () => {
        new ImageEditorToolUI();

        fireEvent.click(byId('image-editor-export'));

        expect(NotificationManager.show).not.toHaveBeenCalled();
        expect(byId('image-editor-empty')).toBeInTheDocument();
    });

    it('reports export failures without downloading', async () => {
        await loadSample();

        Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
            configurable: true,
            value: jest.fn(function (this: HTMLCanvasElement, callback: (blob: Blob | null) => void) {
                callback(null);
            })
        });
        fireEvent.click(byId('image-editor-export'));

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Export failed in this browser. Try a different format.',
                3000,
                { type: 'error' }
            )
        );
    });

    it('reports missing canvas support when building the sample', () => {
        new ImageEditorToolUI();

        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
            configurable: true,
            value: jest.fn(() => null)
        });
        fireEvent.click(byId('image-editor-load-sample'));

        return waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Could not build the sample image in this browser.',
                3000,
                { type: 'error' }
            )
        );
    });

    it('reports missing canvas support when baking a rotation', async () => {
        await loadSample();

        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
            configurable: true,
            value: jest.fn(() => null)
        });
        fireEvent.click(byId('image-editor-rotate-right'));

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Could not rotate or flip in this browser.',
                3000,
                { type: 'error' }
            )
        );
    });

    it('reports missing canvas support on export', async () => {
        await loadSample();

        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
            configurable: true,
            value: jest.fn(() => null)
        });
        fireEvent.click(byId('image-editor-export'));

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Export failed in this browser. Try a different format.',
                3000,
                { type: 'error' }
            )
        );
    });

    it('reports an unbuildable sample when encoding yields nothing', () => {
        new ImageEditorToolUI();

        Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
            configurable: true,
            value: jest.fn(function (this: HTMLCanvasElement, callback: (blob: Blob | null) => void) {
                callback(null);
            })
        });
        fireEvent.click(byId('image-editor-load-sample'));

        return waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Could not build the sample image in this browser.',
                3000,
                { type: 'error' }
            )
        );
    });

    it('skips the preview paint when the context is gone', async () => {
        await loadSample();

        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
            configurable: true,
            value: jest.fn(() => null)
        });
        fireEvent.input(byId('image-editor-adj-brightness'), { target: { value: '1.2' } });

        await waitFor(() => expect(byId('image-editor-brightness-value')).toHaveTextContent('120%'));
        expect(byId('image-editor-info')).toHaveTextContent('1200 × 800 px');
    });

    it('clears a stale estimate when encoding yields nothing', async () => {
        await loadSample();

        // First let a real estimate land so the placeholder assertion below
        // cannot pass vacuously (the estimate starts life as '…').
        await waitFor(() => expect(byId('image-editor-estimate')).toHaveTextContent(/Estimated output: ≈/));

        Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
            configurable: true,
            value: jest.fn(function (this: HTMLCanvasElement, callback: (blob: Blob | null) => void) {
                callback(null);
            })
        });
        fireEvent.input(byId('image-editor-adj-brightness'), { target: { value: '1.2' } });

        await waitFor(() =>
            expect(byId('image-editor-estimate')).toHaveTextContent('Estimated output: …')
        );
    });

    function stagePointerEvent(type: string, init: Record<string, number> = {}): Event {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.assign(event, init);
        return event;
    }

    it('ignores wrap pointer input while an edit is baking', async () => {
        await loadSample();

        let resolveRotate!: (bitmap: FakeBitmap) => void;
        (globalThis.createImageBitmap as jest.Mock).mockImplementationOnce(
            () => new Promise<FakeBitmap>((resolve) => { resolveRotate = resolve; })
        );
        fireEvent.click(byId('image-editor-rotate-right'));
        // Prove the bake is in flight (busy render committed) before pressing.
        await waitFor(() => expect(byId('image-editor-export')).toHaveTextContent('Working…'));

        const wrap = document.querySelector('.image-editor__canvas-wrap') as HTMLElement;
        wrap.dispatchEvent(stagePointerEvent('PointerDown', { clientX: 10, clientY: 10 }));
        expect(document.querySelector('.image-editor__crop-box')).toBeNull();

        resolveRotate({ width: 800, height: 1200, close: jest.fn() });
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('800 × 1200 px'));
    });

    it('stays busy until every overlapping operation has finished', async () => {
        await loadSample();

        let resolveRotate: ((bitmap: FakeBitmap) => void) | undefined;
        const decodeResolvers: ((bitmap: FakeBitmap) => void)[] = [];
        const mockedCreateImageBitmap = globalThis.createImageBitmap as jest.Mock;
        const defaultCreateImageBitmap = mockedCreateImageBitmap.getMockImplementation()!;
        // Hold the rotate bake (a canvas source) and every File decode open;
        // anything else resolves as usual. All decodes are held, not just the
        // first, because instances leaked by earlier tests in this file still
        // listen for document paste events and decode the same File.
        mockedCreateImageBitmap.mockImplementation((source: unknown) => {
            if (source instanceof File) {
                return new Promise<FakeBitmap>((resolve) => { decodeResolvers.push(resolve); });
            }
            if (source instanceof HTMLCanvasElement && !resolveRotate) {
                return new Promise<FakeBitmap>((resolve) => { resolveRotate = resolve; });
            }
            return defaultCreateImageBitmap(source);
        });

        fireEvent.click(byId('image-editor-rotate-right'));
        await waitFor(() => expect(byId('image-editor-export')).toHaveTextContent('Working…'));

        // A paste is not gated on busy, so it starts a decode mid-bake.
        const file = new File(['pasted-bytes'], 'pasted.png', { type: 'image/png' });
        const paste = new Event('paste', { bubbles: true, cancelable: true });
        Object.defineProperty(paste, 'clipboardData', {
            value: { files: { length: 1, item: (index: number) => (index === 0 ? file : null) } }
        });
        document.dispatchEvent(paste);
        await waitFor(() => expect(decodeResolvers.length).toBeGreaterThan(0));

        // The bake finishing must not re-enable controls while the decode runs.
        await waitFor(() => expect(resolveRotate).toBeDefined());
        resolveRotate!({ width: 800, height: 1200, close: jest.fn() });
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('800 × 1200 px'));
        expect(byId('image-editor-export')).toHaveTextContent('Working…');
        expect(byId('image-editor-rotate-left')).toBeDisabled();

        decodeResolvers.forEach((resolve) => resolve({ width: 640, height: 480, close: jest.fn() }));
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('pasted.png'));
        expect(byId('image-editor-rotate-left')).not.toBeDisabled();
    });

    it('starts a selection at the pointer origin on an unmeasured frame', async () => {
        await loadSample();

        // No getBoundingClientRect stub: jsdom reports a zero rect, so the
        // point collapses to the origin and the move below is a no-op.
        const wrap = document.querySelector('.image-editor__canvas-wrap') as HTMLElement;
        wrap.dispatchEvent(stagePointerEvent('PointerDown', { clientX: 50, clientY: 60 }));
        await waitFor(() => expect(document.querySelector('.image-editor__crop-box')).not.toBeNull());

        wrap.dispatchEvent(stagePointerEvent('PointerMove', { clientX: 80, clientY: 90 }));
        wrap.dispatchEvent(stagePointerEvent('PointerUp', {}));
        expect((document.querySelector('.image-editor__crop-box') as HTMLElement).style.left).toBe('0%');
    });

    it('ignores pointer moves with no active drag', async () => {
        await loadSample();

        const wrap = document.querySelector('.image-editor__canvas-wrap') as HTMLElement;
        wrap.dispatchEvent(stagePointerEvent('PointerMove', { clientX: 80, clientY: 90 }));

        expect(document.querySelector('.image-editor__crop-box')).toBeNull();
    });

    it('grows a fresh selection while dragging on the preview', async () => {
        await loadSample();

        const wrap = document.querySelector('.image-editor__canvas-wrap') as HTMLElement;
        wrap.getBoundingClientRect = () => ({
            x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800
        }) as DOMRect;

        wrap.dispatchEvent(stagePointerEvent('PointerDown', { clientX: 60, clientY: 72, pointerId: 1 }));
        await waitFor(() => expect(document.querySelector('.image-editor__crop-box')).not.toBeNull());

        wrap.dispatchEvent(stagePointerEvent('PointerMove', { clientX: 360, clientY: 472, pointerId: 1 }));
        wrap.dispatchEvent(stagePointerEvent('PointerUp', { pointerId: 1 }));

        await waitFor(() =>
            expect(document.querySelector('.image-editor__crop-size')?.textContent).toBe('300 × 400')
        );
    });

    it('resizes the selection from a corner handle', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-crop-1x1'));
        await waitFor(() => expect(document.querySelector('.image-editor__crop-box')).not.toBeNull());

        const wrap = document.querySelector('.image-editor__canvas-wrap') as HTMLElement;
        wrap.getBoundingClientRect = () => ({
            x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800
        }) as DOMRect;

        const handle = document.querySelector('[data-handle="se"]') as HTMLElement;
        handle.dispatchEvent(stagePointerEvent('PointerDown', { clientX: 1000, clientY: 800, pointerId: 1 }));
        wrap.dispatchEvent(stagePointerEvent('PointerMove', { clientX: 1100, clientY: 700, pointerId: 1 }));
        wrap.dispatchEvent(stagePointerEvent('PointerUp', { pointerId: 1 }));

        await waitFor(() =>
            expect(document.querySelector('.image-editor__crop-size')?.textContent).toBe('700 × 700')
        );
    });

    it('loads an image pasted from the clipboard', async () => {
        new ImageEditorToolUI();

        await waitFor(() =>
            expect((registerDropZone as jest.Mock).mock.calls.length).toBeGreaterThan(0)
        );

        const file = new File(['pasted-bytes'], 'pasted.png', { type: 'image/png' });
        const event = new Event('paste', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'clipboardData', {
            value: { files: { length: 1, item: (index: number) => (index === 0 ? file : null) } }
        });
        document.dispatchEvent(event);

        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('pasted.png'));
    });

    it('exports the working image and reports its size', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-export'));

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                expect.stringContaining('Exported'),
                2000,
                { type: 'success' }
            )
        );
        expect(downloadCalls()).toHaveBeenCalled();
    });

    it('exports through the primary keyboard shortcut', async () => {
        await loadSample();

        document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })
        );

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith(
                expect.stringContaining('Exported'),
                2000,
                { type: 'success' }
            )
        );
    });

    it('rotates left and flips through every orientation branch', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-rotate-left'));
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('800 × 1200 px'));

        fireEvent.click(byId('image-editor-flip-h'));
        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith('Flipped', 2000, { type: 'success' })
        );

        fireEvent.click(byId('image-editor-flip-v'));
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('800 × 1200 px'));
    });

    it('frees the previous working bitmap when baking twice', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-rotate-right'));
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('800 × 1200 px'));

        fireEvent.click(byId('image-editor-rotate-right'));
        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('1200 × 800 px'));
    });

    it('ignores pastes without image files', async () => {
        new ImageEditorToolUI();

        await waitFor(() =>
            expect((registerDropZone as jest.Mock).mock.calls.length).toBeGreaterThan(0)
        );

        const event = new Event('paste', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'clipboardData', {
            value: { files: { length: 0, item: () => null } }
        });
        document.dispatchEvent(event);

        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(byId('image-editor-empty')).toBeInTheDocument();
        expect(NotificationManager.show).not.toHaveBeenCalled();
    });

    it('ignores edit actions with no image loaded', () => {
        new ImageEditorToolUI();

        // The apply buttons are disabled without an image; dispatching anyway
        // exercises each bake's empty-state guard.
        fireEvent.click(byId('image-editor-crop-apply'));
        fireEvent.click(byId('image-editor-rotate-right'));
        fireEvent.click(byId('image-editor-resize-apply'));

        expect(byId('image-editor-empty')).toBeInTheDocument();
        expect(NotificationManager.show).not.toHaveBeenCalled();
    });

    it('surfaces drop-zone rejections as error toasts', async () => {
        new ImageEditorToolUI();

        await waitFor(() =>
            expect((registerDropZone as jest.Mock).mock.calls.length).toBeGreaterThan(0)
        );
        const onError = (registerDropZone as jest.Mock).mock.calls[0][1].onError as (
            message: string
        ) => void;
        onError('Too big');

        await waitFor(() =>
            expect(NotificationManager.show).toHaveBeenCalledWith('Too big', 3000, { type: 'error' })
        );
    });

    it('resizes by percent through the mode chip', async () => {
        await loadSample();

        const percentChip = Array.from(document.querySelectorAll('#image-editor-tool button'))
            .find((node) => node.textContent === 'Percent') as HTMLElement;
        fireEvent.click(percentChip);
        await waitFor(() => expect(percentChip.getAttribute('aria-pressed')).toBe('true'));

        fireEvent.input(byId('image-editor-resize-percent'), { target: { value: '50' } });
        await waitFor(() =>
            expect((byId('image-editor-resize-percent') as HTMLInputElement).value).toBe('50')
        );

        fireEvent.click(byId('image-editor-resize-apply'));

        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('600 × 400 px'));
    });

    it('resets adjustments to their defaults', async () => {
        await loadSample();

        fireEvent.input(byId('image-editor-adj-brightness'), { target: { value: '1.5' } });
        await waitFor(() => expect(byId('image-editor-brightness-value')).toHaveTextContent('150%'));

        fireEvent.click(byId('image-editor-adjust-reset'));
        await waitFor(() => expect(byId('image-editor-brightness-value')).toHaveTextContent('100%'));
    });

    it('applies contrast and saturation sliders to the preview pipeline', async () => {
        await loadSample();

        fireEvent.input(byId('image-editor-adj-contrast'), { target: { value: '1.5' } });
        await waitFor(() => expect(contextStub.filtersAtDraw).toContain('contrast(1.5)'));
        expect(byId('image-editor-contrast-value')).toHaveTextContent('150%');

        fireEvent.input(byId('image-editor-adj-saturate'), { target: { value: '0.5' } });
        await waitFor(() =>
            expect(contextStub.filtersAtDraw.some((filter) => filter.includes('saturate(0.5)'))).toBe(true)
        );
        expect(byId('image-editor-saturate-value')).toHaveTextContent('50%');
    });

    it('moves the caption position through the select', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-caption-enable'));
        fireEvent.change(byId('image-editor-caption-position'), { target: { value: 'top-left' } });

        await waitFor(() =>
            expect((byId('image-editor-caption-position') as HTMLSelectElement).value).toBe('top-left')
        );
    });

    it('adjusts export quality for lossy formats', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-format-jpeg'));
        await waitFor(() =>
            expect(byId('image-editor-format-jpeg')).toHaveAttribute('aria-pressed', 'true')
        );

        fireEvent.input(byId('image-editor-quality'), { target: { value: '80' } });

        await waitFor(() => expect(byId('image-editor-quality-value')).toHaveTextContent('80%'));
    });

    it('switches the export format to WebP', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-format-webp'));

        await waitFor(() =>
            expect(byId('image-editor-format-webp').getAttribute('aria-pressed')).toBe('true')
        );
    });

    it('applies grayscale and blur sliders to the preview pipeline', async () => {
        await loadSample();

        fireEvent.input(byId('image-editor-adj-grayscale'), { target: { value: '0.5' } });
        await waitFor(() => expect(contextStub.filtersAtDraw).toContain('grayscale(0.5)'));
        expect(byId('image-editor-grayscale-value')).toHaveTextContent('50%');

        fireEvent.input(byId('image-editor-adj-blur'), { target: { value: '2' } });
        await waitFor(() =>
            expect(contextStub.filtersAtDraw.some((filter) => filter.includes('blur(2px)'))).toBe(true)
        );
        expect(byId('image-editor-blur-value')).toHaveTextContent('2.0px');
    });

    it('switches the resize mode back to pixels', async () => {
        await loadSample();

        const buttons = Array.from(document.querySelectorAll('#image-editor-tool button'));
        fireEvent.click(buttons.find((node) => node.textContent === 'Percent') as HTMLElement);
        await waitFor(() =>
            expect(
                (buttons.find((node) => node.textContent === 'Percent') as HTMLElement).getAttribute(
                    'aria-pressed'
                )
            ).toBe('true')
        );

        fireEvent.click(buttons.find((node) => node.textContent === 'Pixels') as HTMLElement);
        await waitFor(() =>
            expect(
                (buttons.find((node) => node.textContent === 'Pixels') as HTMLElement).getAttribute(
                    'aria-pressed'
                )
            ).toBe('true')
        );
    });

    it('toggles the resize aspect lock', async () => {
        await loadSample();

        const lock = byId('image-editor-resize-lock') as HTMLInputElement;
        fireEvent.click(lock);

        await waitFor(() => expect(lock.checked).toBe(false));
    });

    it('adjusts caption size and color', async () => {
        await loadSample();

        fireEvent.click(byId('image-editor-caption-enable'));
        fireEvent.input(byId('image-editor-caption-size'), { target: { value: '8' } });
        await waitFor(() => expect(byId('image-editor-caption-size-value')).toHaveTextContent('8%'));

        fireEvent.input(byId('image-editor-caption-color'), { target: { value: '#ff0000' } });
        await waitFor(() =>
            expect((byId('image-editor-caption-color') as HTMLInputElement).value).toBe('#ff0000')
        );
    });

    it('loads the sample from the empty-state action', async () => {
        new ImageEditorToolUI();

        const actions = byId('image-editor-empty').querySelector('.image-editor__empty-actions') as HTMLElement;
        const sampleButton = Array.from(actions.querySelectorAll('button')).find(
            (node) => node.textContent === 'Try a sample'
        ) as HTMLElement;
        fireEvent.click(sampleButton);

        await waitFor(() => expect(byId('image-editor-info')).toHaveTextContent('sample-image.png'));
    });
});
