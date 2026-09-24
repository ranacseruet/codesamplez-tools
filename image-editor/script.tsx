import DownloadManager from '../common/DownloadManager';
import { NotificationManager } from '../common/notification-manager';
import { hydrate, render } from 'preact';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { registerPrimaryActionShortcut } from '../common/shortcut-utils';
import { describeLoadedFile, registerDropZone, registerFileInput, type LoadedFileDetail } from '../common/drop-zone';
import { formatBytes } from '../common/format-utils';
import toolMetadata from './tool.meta.json';
import {
    ADJUSTMENT_PRESETS,
    CAPTION_POSITIONS,
    CROP_PRESETS,
    DEFAULT_ADJUSTMENTS,
    DEFAULT_CAPTION,
    EXPORT_FORMATS,
    MAX_IMAGE_BYTES,
    buildFilterString,
    centerCropForAspect,
    checkDecodedDimensions,
    clampCropRect,
    computeCaptionLayout,
    computeResizeDims,
    exportFilename,
    exportMime,
    isDefaultAdjustments,
    matchAdjustmentPreset,
    moveCropBox,
    qualityToFraction,
    resizeCropBox,
    rotatedDimensions,
    scaleEstimateBytes,
    supportsQuality,
    validateImageFile,
    type Adjustments,
    type AspectPresetId,
    type CaptionState,
    type CropHandle,
    type CropRect,
    type ExportFormat
} from './image-operations';

const PREVIEW_MAX_DIM = 720;
const ESTIMATE_DEBOUNCE_MS = 500;
const CAPTION_MAX_LENGTH = 120;

interface LoadedImage {
    original: ImageBitmap;
    working: ImageBitmap;
    name: string;
    type: string;
    bytes: number;
}

type DragMode = 'move' | 'create' | CropHandle;

interface DragState {
    mode: DragMode;
    startClientX: number;
    startClientY: number;
    originBox: CropRect | null;
}

function notifyError(message: string): void {
    NotificationManager.show(message, 3000, { type: 'error' });
}

function notifySuccess(message: string): void {
    NotificationManager.show(message, 2000, { type: 'success' });
}

function closeLoadedImage(image: LoadedImage | null): void {
    if (!image) {
        return;
    }

    image.original.close();
    if (image.working !== image.original) {
        image.working.close();
    }
}

async function renderToBitmap(
    source: ImageBitmap,
    width: number,
    height: number,
    draw: (ctx: CanvasRenderingContext2D) => void
): Promise<ImageBitmap> {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas 2D is not available in this browser.');
    }

    draw(ctx);
    return createImageBitmap(canvas);
}

/** Paints the active caption onto a context sized outputWidth × outputHeight. */
function paintCaption(ctx: CanvasRenderingContext2D, outputWidth: number, outputHeight: number, caption: CaptionState): void {
    const layout = computeCaptionLayout(outputWidth, outputHeight, caption);

    ctx.save();
    ctx.font = layout.font;
    ctx.fillStyle = caption.color;
    ctx.textAlign = layout.textAlign;
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = Math.max(2, Math.round(outputWidth * 0.004));
    ctx.fillText(caption.text, layout.x, layout.y, layout.maxWidth);
    ctx.restore();
}

function shouldPaintCaption(enabled: boolean, caption: CaptionState): boolean {
    return enabled && caption.text.trim().length > 0;
}

async function buildSampleImage(): Promise<LoadedImage> {
    const width = 1200;
    const height = 800;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas 2D is not available in this browser.');
    }

    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#1b1440');
    background.addColorStop(0.55, '#0e2a3a');
    background.addColorStop(1, '#3a1440');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(169, 156, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(width * 0.28, height * 0.38, 170, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(95, 224, 194, 0.45)';
    ctx.beginPath();
    ctx.arc(width * 0.72, height * 0.62, 220, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(245, 197, 66, 0.55)';
    ctx.beginPath();
    ctx.arc(width * 0.62, height * 0.3, 90, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.moveTo(0, height * 0.15 * (i + 1));
        ctx.lineTo(width, height * 0.15 * (i + 1) - 120);
        ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 84px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Sample image', width / 2, height / 2 - 20, width - 160);
    ctx.font = '400 40px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText('1200 × 800 — try crop, resize & filters', width / 2, height / 2 + 60, width - 160);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
        throw new Error('Could not build the sample image in this browser.');
    }

    const bitmap = await createImageBitmap(blob);
    return { original: bitmap, working: bitmap, name: 'sample-image.png', type: 'image/png', bytes: blob.size };
}

function toImagePoint(clientX: number, clientY: number, stage: HTMLElement, imageWidth: number, imageHeight: number): { x: number; y: number } {
    const rect = stage.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) {
        return { x: 0, y: 0 };
    }

    return {
        x: ((clientX - rect.left) * imageWidth) / rect.width,
        y: ((clientY - rect.top) * imageHeight) / rect.height
    };
}

export type ConfigSectionId = 'crop' | 'orient' | 'resize' | 'adjust' | 'caption' | 'export';

const DEFAULT_OPEN_SECTIONS: Record<ConfigSectionId, boolean> = {
    crop: true,
    orient: false,
    resize: false,
    adjust: false,
    caption: false,
    export: true
};

interface ConfigDisclosureProps {
    sectionId: ConfigSectionId;
    headingId: string;
    title: string;
    hint: string;
    open: boolean;
    active?: boolean;
    onToggle: (sectionId: ConfigSectionId, open: boolean) => void;
    children: ComponentChildren;
}

/**
 * One collapsible config section. Native <details> keeps keyboard handling
 * and screen-reader announcement free (same pattern as json-editor's import
 * disclosure); the open state is mirrored into Preact state so edits can
 * force a section open (e.g. starting a crop selection).
 */
function ConfigDisclosure({ sectionId, headingId, title, hint, open, active, onToggle, children }: ConfigDisclosureProps) {
    return (
        <details
            className={`image-editor__disclosure${active ? ' is-active' : ''}`}
            open={open}
            onToggle={(event) => {
                const target = event.currentTarget;
                if (target instanceof HTMLDetailsElement) {
                    onToggle(sectionId, target.open);
                }
            }}
            aria-labelledby={headingId}
        >
            <summary className="image-editor__summary">
                <span className="image-editor__summary-chevron" aria-hidden="true" />
                <h4 id={headingId} className="image-editor__heading">{title}</h4>
                <span className="image-editor__summary-hint">{hint}</span>
            </summary>
            <div className="image-editor__section">
                {children}
            </div>
        </details>
    );
}

export function ImageEditorApp() {
    const [image, setImage] = useState<LoadedImage | null>(null);
    const [adjustments, setAdjustments] = useState<Adjustments>({ ...DEFAULT_ADJUSTMENTS });
    const [cropPreset, setCropPreset] = useState<AspectPresetId>('free');
    const [cropBox, setCropBox] = useState<CropRect | null>(null);
    const [resizeMode, setResizeMode] = useState<'pixels' | 'percent'>('pixels');
    const [resizeWidth, setResizeWidth] = useState('');
    const [resizeHeight, setResizeHeight] = useState('');
    const [lockAspect, setLockAspect] = useState(true);
    const [resizePercent, setResizePercent] = useState('100');
    const [captionEnabled, setCaptionEnabled] = useState(false);
    const [caption, setCaption] = useState<CaptionState>({ ...DEFAULT_CAPTION });
    const [format, setFormat] = useState<ExportFormat>('png');
    const [quality, setQuality] = useState(92);
    const [estimate, setEstimate] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [openSections, setOpenSections] = useState<Record<ConfigSectionId, boolean>>({ ...DEFAULT_OPEN_SECTIONS });

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const imageRef = useRef<LoadedImage | null>(null);
    // Generation counter for image loads (picker, drop, paste, sample).
    // Decodes race: a second load started while one is in flight must win
    // even if the first decode resolves last, so each load checks that it
    // is still the latest request before installing anything.
    const loadSeqRef = useRef(0);
    const loadFileRef = useRef<(file: File, detail?: LoadedFileDetail) => void>(() => undefined);
    const exportRef = useRef<() => void>(() => undefined);

    const setLoadedImage = (next: LoadedImage | null) => {
        closeLoadedImage(imageRef.current);
        imageRef.current = next;
        setImage(next);
    };

    const syncResizeInputs = (width: number, height: number) => {
        setResizeWidth(String(width));
        setResizeHeight(String(height));
        setResizePercent('100');
    };

    const handleSectionToggle = (sectionId: ConfigSectionId, open: boolean) => {
        setOpenSections((previous) => ({ ...previous, [sectionId]: open }));
    };

    const expandSection = (sectionId: ConfigSectionId) => {
        setOpenSections((previous) => (previous[sectionId] ? previous : { ...previous, [sectionId]: true }));
    };

    const resetEditState = () => {
        setAdjustments({ ...DEFAULT_ADJUSTMENTS });
        setCropPreset('free');
        setCropBox(null);
        setCaptionEnabled(false);
        setCaption({ ...DEFAULT_CAPTION });
        setFormat('png');
        setQuality(92);
        setEstimate(null);
    };

    const replaceWorkingBitmap = (bitmap: ImageBitmap, expected: LoadedImage): boolean => {
        const current = imageRef.current;
        if (current !== expected) {
            // The image was replaced (or removed) while the edit baked: the
            // result belongs to an image that is no longer loaded. Drop it
            // silently — the newer load owns user feedback.
            bitmap.close();
            return false;
        }

        if (current.working !== current.original) {
            current.working.close();
        }

        const next: LoadedImage = { ...current, working: bitmap };
        imageRef.current = next;
        setImage(next);
        setCropBox(null);
        syncResizeInputs(bitmap.width, bitmap.height);
        return true;
    };

    const loadImageFile = async (file: File, detail?: LoadedFileDetail) => {
        const validationError = validateImageFile(file);
        if (validationError) {
            notifyError(validationError);
            return;
        }

        loadSeqRef.current += 1;
        const requestId = loadSeqRef.current;

        setBusy(true);
        try {
            const bitmap = await createImageBitmap(file);
            if (requestId !== loadSeqRef.current) {
                bitmap.close();
                return;
            }
            const dimensionError = checkDecodedDimensions(bitmap.width, bitmap.height);
            if (dimensionError) {
                bitmap.close();
                notifyError(dimensionError);
                return;
            }

            setLoadedImage({
                original: bitmap,
                working: bitmap,
                name: file.name,
                type: file.type,
                bytes: file.size
            });
            resetEditState();
            syncResizeInputs(bitmap.width, bitmap.height);
            notifySuccess(describeLoadedFile(`${file.name} (${bitmap.width} × ${bitmap.height})`, detail));
        } catch {
            if (requestId === loadSeqRef.current) {
                notifyError(`Could not decode “${file.name}”. Try a different file.`);
            }
        } finally {
            setBusy(false);
        }
    };

    loadFileRef.current = loadImageFile;

    const loadSample = async () => {
        loadSeqRef.current += 1;
        const requestId = loadSeqRef.current;

        setBusy(true);
        try {
            const sample = await buildSampleImage();
            if (requestId !== loadSeqRef.current) {
                closeLoadedImage(sample);
                return;
            }
            setLoadedImage(sample);
            resetEditState();
            syncResizeInputs(sample.working.width, sample.working.height);
            notifySuccess('Sample image loaded');
        } catch {
            if (requestId === loadSeqRef.current) {
                notifyError('Could not build the sample image in this browser.');
            }
        } finally {
            setBusy(false);
        }
    };

    const clearImage = () => {
        setLoadedImage(null);
        resetEditState();
        setBusy(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const resetToOriginal = () => {
        const current = imageRef.current;
        if (!current) {
            return;
        }

        if (current.working !== current.original) {
            current.working.close();
        }

        const next: LoadedImage = { ...current, working: current.original };
        imageRef.current = next;
        setImage(next);
        setCropBox(null);
        syncResizeInputs(current.original.width, current.original.height);
        notifySuccess('Reset to the original image');
    };

    const bakeCrop = async () => {
        const current = imageRef.current;
        if (!current || !cropBox) {
            return;
        }

        const box = clampCropRect(cropBox, current.working.width, current.working.height, null);
        setBusy(true);
        try {
            const bitmap = await renderToBitmap(current.working, box.width, box.height, (ctx) => {
                ctx.drawImage(current.working, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
            });
            if (replaceWorkingBitmap(bitmap, current)) {
                notifySuccess(`Cropped to ${box.width} × ${box.height}`);
            }
        } catch {
            if (imageRef.current === current) {
                notifyError('Could not apply the crop in this browser.');
            }
        } finally {
            setBusy(false);
        }
    };

    const bakeOrientation = async (kind: 'left' | 'right' | 'flipH' | 'flipV') => {
        const current = imageRef.current;
        if (!current) {
            return;
        }

        const source = current.working;
        const quarterTurn = kind === 'left' || kind === 'right';
        const dims = quarterTurn
            ? rotatedDimensions(source.width, source.height, 90)
            : { width: source.width, height: source.height };

        setBusy(true);
        try {
            const bitmap = await renderToBitmap(source, dims.width, dims.height, (ctx) => {
                ctx.translate(dims.width / 2, dims.height / 2);
                if (kind === 'left') {
                    ctx.rotate(-Math.PI / 2);
                } else if (kind === 'right') {
                    ctx.rotate(Math.PI / 2);
                } else if (kind === 'flipH') {
                    ctx.scale(-1, 1);
                } else {
                    ctx.scale(1, -1);
                }
                ctx.drawImage(source, -source.width / 2, -source.height / 2);
            });
            if (replaceWorkingBitmap(bitmap, current)) {
                notifySuccess(kind === 'left' || kind === 'right' ? 'Rotated' : 'Flipped');
            }
        } catch {
            if (imageRef.current === current) {
                notifyError('Could not rotate or flip in this browser.');
            }
        } finally {
            setBusy(false);
        }
    };

    const bakeResize = async () => {
        const current = imageRef.current;
        if (!current) {
            return;
        }

        const spec = resizeMode === 'percent'
            ? { mode: 'percent' as const, width: null, height: null, lockAspect, percent: Number(resizePercent) }
            : {
                mode: 'pixels' as const,
                width: resizeWidth.trim() === '' ? null : Number(resizeWidth),
                height: resizeHeight.trim() === '' ? null : Number(resizeHeight),
                lockAspect,
                percent: null
            };

        if (spec.mode === 'pixels' && !Number.isFinite(Number(resizeWidth)) && !Number.isFinite(Number(resizeHeight))) {
            notifyError('Enter a width, a height, or switch to percent mode.');
            return;
        }

        const dims = computeResizeDims(current.working.width, current.working.height, spec);
        if (dims.width === current.working.width && dims.height === current.working.height) {
            notifySuccess(`Already ${dims.width} × ${dims.height} — nothing to resize.`);
            return;
        }

        setBusy(true);
        try {
            const bitmap = await renderToBitmap(current.working, dims.width, dims.height, (ctx) => {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(current.working, 0, 0, dims.width, dims.height);
            });
            if (replaceWorkingBitmap(bitmap, current)) {
                notifySuccess(`Resized to ${dims.width} × ${dims.height}`);
            }
        } catch {
            if (imageRef.current === current) {
                notifyError('Could not resize in this browser.');
            }
        } finally {
            setBusy(false);
        }
    };

    const exportImage = async () => {
        const current = imageRef.current;
        if (!current || busy) {
            return;
        }

        setBusy(true);
        try {
            const { working } = current;
            const canvas = document.createElement('canvas');
            canvas.width = working.width;
            canvas.height = working.height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Canvas 2D is not available in this browser.');
            }

            ctx.filter = buildFilterString(adjustments);
            ctx.drawImage(working, 0, 0);
            ctx.filter = 'none';

            if (shouldPaintCaption(captionEnabled, caption)) {
                paintCaption(ctx, working.width, working.height, { ...caption, text: caption.text.trim() });
            }

            const mime = exportMime(format);
            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob(resolve, mime, supportsQuality(format) ? qualityToFraction(quality) : undefined);
            });

            if (!blob) {
                throw new Error('Export produced no data in this browser.');
            }

            new DownloadManager().downloadFile(blob, exportFilename(format), mime);
            notifySuccess(`Exported ${formatBytes(blob.size)} ${exportFilename(format).split('.').pop()?.toUpperCase()}`);
        } catch {
            notifyError('Export failed in this browser. Try a different format.');
        } finally {
            setBusy(false);
        }
    };

    exportRef.current = () => {
        void exportImage();
    };

    // File input, drop zone, paste-to-load, and primary shortcut: registered
    // once; the wrappers delegate to refs so handlers always see fresh state.
    useEffect(() => {
        const fileOptions = {
            onFile: (file: File, detail: LoadedFileDetail) => loadFileRef.current(file, detail),
            onError: (message: string) => notifyError(message),
            maxBytes: MAX_IMAGE_BYTES
        };

        const cleanups: (() => void)[] = [];
        if (fileInputRef.current) {
            cleanups.push(registerFileInput(fileInputRef.current, fileOptions));
        }
        if (stageRef.current) {
            cleanups.push(registerDropZone(stageRef.current, fileOptions));
        }

        const handlePaste = (event: ClipboardEvent) => {
            const files: File[] = [];
            const clipboardFiles = event.clipboardData?.files;
            if (clipboardFiles) {
                for (let i = 0; i < clipboardFiles.length; i += 1) {
                    const file = clipboardFiles.item(i);
                    if (file && file.type.startsWith('image/')) {
                        files.push(file);
                    }
                }
            }

            if (files.length === 0) {
                return;
            }

            event.preventDefault();
            loadFileRef.current(files[0]);
        };

        document.addEventListener('paste', handlePaste);
        cleanups.push(() => document.removeEventListener('paste', handlePaste));
        cleanups.push(registerPrimaryActionShortcut(() => exportRef.current()));

        return () => {
            cleanups.forEach((cleanup) => cleanup());
            closeLoadedImage(imageRef.current);
            imageRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Live preview: the same filter + caption pipeline as export, fitted.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image) {
            return;
        }

        const { working } = image;
        const scale = Math.min(1, PREVIEW_MAX_DIM / Math.max(working.width, working.height));
        canvas.width = Math.max(1, Math.round(working.width * scale));
        canvas.height = Math.max(1, Math.round(working.height * scale));

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        ctx.filter = buildFilterString(adjustments);
        ctx.drawImage(working, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';

        if (shouldPaintCaption(captionEnabled, caption)) {
            paintCaption(ctx, canvas.width, canvas.height, { ...caption, text: caption.text.trim() });
        }

        canvas.setAttribute('aria-label', `Preview: ${working.width} by ${working.height} pixels`);
    }, [image, adjustments, caption, captionEnabled]);

    // Export-size estimate: encode the preview, scale by pixel-area ratio.
    useEffect(() => {
        if (!image) {
            setEstimate(null);
            return undefined;
        }

        const timer = setTimeout(() => {
            const canvas = canvasRef.current;
            const current = imageRef.current;
            if (!canvas || !current) {
                return;
            }

            const mime = exportMime(format);
            canvas.toBlob((blob) => {
                if (!blob) {
                    setEstimate(null);
                    return;
                }

                const scaled = scaleEstimateBytes(
                    blob.size,
                    current.working.width,
                    current.working.height,
                    canvas.width,
                    canvas.height
                );
                setEstimate(`≈ ${formatBytes(scaled)}`);
            }, mime, supportsQuality(format) ? qualityToFraction(quality) : undefined);
        }, ESTIMATE_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [image, adjustments, caption, captionEnabled, format, quality]);

    const presetRatio = CROP_PRESETS.find((preset) => preset.id === cropPreset)?.ratio ?? null;
    const activeFilterPreset = matchAdjustmentPreset(adjustments);
    const showQuality = supportsQuality(format);
    const formatLabel = EXPORT_FORMATS.find((option) => option.id === format)?.label ?? 'PNG';

    const handleCropPreset = (presetId: AspectPresetId) => {
        const current = imageRef.current;
        if (!current) {
            notifyError('Load an image before cropping.');
            return;
        }

        const ratio = CROP_PRESETS.find((preset) => preset.id === presetId)?.ratio ?? null;
        setCropPreset(presetId);
        setCropBox(centerCropForAspect(current.working.width, current.working.height, ratio));
        // A fresh selection is useless inside a collapsed section: make sure
        // the highlighted Apply button is visible.
        expandSection('crop');
    };

    const pointInBox = (box: CropRect, x: number, y: number): boolean =>
        x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

    const handleStagePointerDown = (event: { clientX: number; clientY: number; target: EventTarget | null; currentTarget: EventTarget | null; preventDefault: () => void }) => {
        const current = imageRef.current;
        // Measure against the canvas wrap (not the padded stage) so overlay
        // percentages and pointer math share the same coordinate frame.
        const frame = wrapRef.current ?? stageRef.current;
        if (!current || busy || !frame) {
            return;
        }

        event.preventDefault();
        try {
            (event.currentTarget as Element | null)?.setPointerCapture?.((event as PointerEvent).pointerId);
        } catch {
            // Pointer capture is best-effort; dragging still works without it.
        }

        const point = toImagePoint(event.clientX, event.clientY, frame, current.working.width, current.working.height);
        const handle = (event.target as HTMLElement | null)?.dataset?.handle as CropHandle | undefined;

        if (handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se') {
            dragRef.current = {
                mode: handle,
                startClientX: event.clientX,
                startClientY: event.clientY,
                originBox: cropBox ? { ...cropBox } : centerCropForAspect(current.working.width, current.working.height, presetRatio)
            };
            if (!cropBox) {
                setCropBox(dragRef.current.originBox);
            }
            return;
        }

        if (cropBox && pointInBox(cropBox, point.x, point.y)) {
            dragRef.current = {
                mode: 'move',
                startClientX: event.clientX,
                startClientY: event.clientY,
                originBox: { ...cropBox }
            };
            return;
        }

        const fresh: CropRect = { x: Math.round(point.x), y: Math.round(point.y), width: 0, height: 0 };
        dragRef.current = { mode: 'create', startClientX: event.clientX, startClientY: event.clientY, originBox: fresh };
        setCropBox(fresh);
        expandSection('crop');
    };

    const handleStagePointerMove = (event: { clientX: number; clientY: number }) => {
        const drag = dragRef.current;
        const current = imageRef.current;
        const frame = wrapRef.current ?? stageRef.current;
        if (!drag || !current || !frame) {
            return;
        }

        const rect = frame.getBoundingClientRect();
        if (!(rect.width > 0 && rect.height > 0)) {
            return;
        }

        const scaleX = current.working.width / rect.width;
        const scaleY = current.working.height / rect.height;
        const dx = (event.clientX - drag.startClientX) * scaleX;
        const dy = (event.clientY - drag.startClientY) * scaleY;

        if (drag.mode === 'move' && drag.originBox) {
            setCropBox(moveCropBox(drag.originBox, dx, dy, current.working.width, current.working.height));
            return;
        }

        if (drag.mode === 'create' && drag.originBox) {
            const anchor = drag.originBox;
            const corner = { x: anchor.x + dx, y: anchor.y + dy };
            setCropBox(clampCropRect(
                {
                    x: Math.min(anchor.x, corner.x),
                    y: Math.min(anchor.y, corner.y),
                    width: Math.abs(corner.x - anchor.x),
                    height: Math.abs(corner.y - anchor.y)
                },
                current.working.width,
                current.working.height,
                presetRatio
            ));
            return;
        }

        if (drag.originBox && (drag.mode === 'nw' || drag.mode === 'ne' || drag.mode === 'sw' || drag.mode === 'se')) {
            setCropBox(resizeCropBox(
                drag.originBox,
                drag.mode,
                dx,
                dy,
                current.working.width,
                current.working.height,
                presetRatio
            ));
        }
    };

    const endDrag = () => {
        dragRef.current = null;
    };

    const handleAdjustmentInput = (key: keyof Adjustments, value: number) => {
        setAdjustments((previous) => ({ ...previous, [key]: value }));
    };

    const handleResizeWidthInput = (event: { target: unknown }) => {
        const target = event.target;
        const value = target instanceof HTMLInputElement ? target.value : '';
        setResizeWidth(value);
        if (lockAspect && value.trim() !== '' && image) {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed > 0) {
                setResizeHeight(String(Math.round((parsed * image.working.height) / image.working.width)));
            }
        }
    };

    const handleResizeHeightInput = (event: { target: unknown }) => {
        const target = event.target;
        const value = target instanceof HTMLInputElement ? target.value : '';
        setResizeHeight(value);
        if (lockAspect && value.trim() !== '' && image) {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed > 0) {
                setResizeWidth(String(Math.round((parsed * image.working.width) / image.working.height)));
            }
        }
    };

    const cropOverlay = image && cropBox ? (
        <div
            className="image-editor__crop-box"
            style={{
                left: `${(cropBox.x / image.working.width) * 100}%`,
                top: `${(cropBox.y / image.working.height) * 100}%`,
                width: `${(cropBox.width / image.working.width) * 100}%`,
                height: `${(cropBox.height / image.working.height) * 100}%`
            }}
        >
            {(['nw', 'ne', 'sw', 'se'] as CropHandle[]).map((handle) => (
                <span
                    key={handle}
                    data-handle={handle}
                    className={`image-editor__crop-handle image-editor__crop-handle--${handle}`}
                    aria-hidden="true"
                />
            ))}
            <span className="image-editor__crop-size" aria-hidden="true">
                {cropBox.width} × {cropBox.height}
            </span>
        </div>
    ) : null;

    return (
        <div id="image-editor-tool" className="tool-container image-editor c-tool-stack">
            {/*
              The picker input lives outside every conditional branch on
              purpose: the mount effect wires `registerFileInput` onto this
              node exactly once, so unmounting it (e.g. by rendering it only
              in the empty state) would orphan the listener and silently break
              the picker after the first image is removed. Both picker labels
              below target this input by id.
            */}
            <input
                ref={fileInputRef}
                type="file"
                id="image-editor-file"
                className="u-visually-hidden"
                accept="image/*"
            />
            <div className="image-editor__main">
                <div className="image-editor__controls c-surface-card">
                    <div className="image-editor__section-header">
                        <h3 className="image-editor__section-title">Configuration</h3>
                        <button
                            id="image-editor-load-sample"
                            type="button"
                            className="c-button c-button--ghost image-editor__load-sample-button"
                            onClick={() => void loadSample()}
                            disabled={busy}
                        >
                            Load Sample
                        </button>
                    </div>

                    <div className="image-editor__group">
                        <h3 className="image-editor__group-title">Transform</h3>

                    <ConfigDisclosure
                        sectionId="crop"
                        headingId="image-editor-crop-heading"
                        title="Crop"
                        hint="Aspect ratio and selection"
                        open={openSections.crop}
                        active={Boolean(cropBox)}
                        onToggle={handleSectionToggle}
                    >
                        <div className="image-editor__button-row" role="group" aria-label="Crop aspect ratio">
                            {CROP_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    id={`image-editor-crop-${preset.id.replace(':', 'x')}`}
                                    type="button"
                                    className={`c-button c-button--ghost image-editor__chip${cropPreset === preset.id ? ' is-active' : ''}`}
                                    aria-pressed={cropPreset === preset.id}
                                    onClick={() => handleCropPreset(preset.id)}
                                    disabled={!image || busy}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                        <div className="image-editor__button-row">
                            <button
                                id="image-editor-crop-apply"
                                type="button"
                                className={cropBox ? 'c-button' : 'c-button c-button--secondary'}
                                onClick={() => void bakeCrop()}
                                disabled={!image || !cropBox || busy}
                            >
                                Apply crop
                            </button>
                            <button
                                id="image-editor-crop-clear"
                                type="button"
                                className="c-button c-button--ghost"
                                onClick={() => setCropBox(null)}
                                disabled={!cropBox || busy}
                            >
                                Cancel
                            </button>
                        </div>
                        <p className="image-editor__hint">
                            {cropBox
                                ? 'Selection active — drag to refine it, then Apply crop or Cancel.'
                                : 'Pick a ratio, then drag on the image to move or resize the selection.'}
                        </p>
                    </ConfigDisclosure>

                    <ConfigDisclosure
                        sectionId="orient"
                        headingId="image-editor-orient-heading"
                        title="Rotate & flip"
                        hint="90° steps and mirrors"
                        open={openSections.orient}
                        onToggle={handleSectionToggle}
                    >
                        <div className="image-editor__button-row">
                            <button id="image-editor-rotate-left" type="button" className="c-button c-button--secondary" onClick={() => void bakeOrientation('left')} disabled={!image || busy}>
                                ⟲ 90°
                            </button>
                            <button id="image-editor-rotate-right" type="button" className="c-button c-button--secondary" onClick={() => void bakeOrientation('right')} disabled={!image || busy}>
                                ⟳ 90°
                            </button>
                            <button id="image-editor-flip-h" type="button" className="c-button c-button--secondary" onClick={() => void bakeOrientation('flipH')} disabled={!image || busy}>
                                Flip ⇄
                            </button>
                            <button id="image-editor-flip-v" type="button" className="c-button c-button--secondary" onClick={() => void bakeOrientation('flipV')} disabled={!image || busy}>
                                Flip ⇅
                            </button>
                        </div>
                    </ConfigDisclosure>

                    <ConfigDisclosure
                        sectionId="resize"
                        headingId="image-editor-resize-heading"
                        title="Resize"
                        hint="Exact pixels or percent"
                        open={openSections.resize}
                        onToggle={handleSectionToggle}
                    >
                        <div className="image-editor__button-row" role="group" aria-label="Resize mode">
                            <button
                                type="button"
                                className={`c-button c-button--ghost image-editor__chip${resizeMode === 'pixels' ? ' is-active' : ''}`}
                                aria-pressed={resizeMode === 'pixels'}
                                onClick={() => setResizeMode('pixels')}
                                disabled={!image || busy}
                            >
                                Pixels
                            </button>
                            <button
                                type="button"
                                className={`c-button c-button--ghost image-editor__chip${resizeMode === 'percent' ? ' is-active' : ''}`}
                                aria-pressed={resizeMode === 'percent'}
                                onClick={() => setResizeMode('percent')}
                                disabled={!image || busy}
                            >
                                Percent
                            </button>
                        </div>
                        {resizeMode === 'pixels' ? (
                            <div className="image-editor__resize-grid">
                                <label className="image-editor__field">
                                    <span>Width (px)</span>
                                    <input
                                        id="image-editor-resize-w"
                                        type="number"
                                        min="1"
                                        max="8192"
                                        className="c-input"
                                        value={resizeWidth}
                                        onInput={handleResizeWidthInput}
                                        disabled={!image || busy}
                                    />
                                </label>
                                <label className="image-editor__field">
                                    <span>Height (px)</span>
                                    <input
                                        id="image-editor-resize-h"
                                        type="number"
                                        min="1"
                                        max="8192"
                                        className="c-input"
                                        value={resizeHeight}
                                        onInput={handleResizeHeightInput}
                                        disabled={!image || busy}
                                    />
                                </label>
                                <label className="image-editor__check">
                                    <input
                                        id="image-editor-resize-lock"
                                        type="checkbox"
                                        checked={lockAspect}
                                        onChange={(event) => {
                                            const target = event.target;
                                            setLockAspect(target instanceof HTMLInputElement ? target.checked : true);
                                        }}
                                        disabled={!image || busy}
                                    />
                                    <span>Lock aspect ratio</span>
                                </label>
                            </div>
                        ) : (
                            <label className="image-editor__field">
                                <span>Scale (%)</span>
                                <input
                                    id="image-editor-resize-percent"
                                    type="number"
                                    min="1"
                                    max="1000"
                                    className="c-input"
                                    value={resizePercent}
                                    onInput={(event) => {
                                        const target = event.target;
                                        setResizePercent(target instanceof HTMLInputElement ? target.value : '100');
                                    }}
                                    disabled={!image || busy}
                                />
                            </label>
                        )}
                        <div className="image-editor__button-row">
                            <button
                                id="image-editor-resize-apply"
                                type="button"
                                className="c-button c-button--secondary"
                                onClick={() => void bakeResize()}
                                disabled={!image || busy}
                            >
                                Apply resize
                            </button>
                        </div>
                    </ConfigDisclosure>
                    </div>

                    <div className="image-editor__group">
                        <h3 className="image-editor__group-title">Enhance</h3>

                    <ConfigDisclosure
                        sectionId="adjust"
                        headingId="image-editor-adjust-heading"
                        title="Adjust"
                        hint="Presets and color sliders"
                        open={openSections.adjust}
                        onToggle={handleSectionToggle}
                    >
                        <div className="image-editor__button-row" role="group" aria-label="Filter presets">
                            {ADJUSTMENT_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    id={`image-editor-preset-${preset.id}`}
                                    type="button"
                                    className={`c-button c-button--ghost image-editor__chip${activeFilterPreset === preset.id ? ' is-active' : ''}`}
                                    aria-pressed={activeFilterPreset === preset.id}
                                    onClick={() => setAdjustments({ ...preset.adjustments })}
                                    disabled={!image || busy}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                        <label className="image-editor__slider">
                            <span>Brightness: <span id="image-editor-brightness-value">{Math.round(adjustments.brightness * 100)}%</span></span>
                            <input
                                id="image-editor-adj-brightness"
                                type="range"
                                min="0"
                                max="2"
                                step="0.05"
                                value={adjustments.brightness}
                                onInput={(event) => {
                                    const target = event.target;
                                    if (target instanceof HTMLInputElement) {
                                        handleAdjustmentInput('brightness', Number(target.value));
                                    }
                                }}
                                disabled={!image || busy}
                            />
                        </label>
                        <label className="image-editor__slider">
                            <span>Contrast: <span id="image-editor-contrast-value">{Math.round(adjustments.contrast * 100)}%</span></span>
                            <input
                                id="image-editor-adj-contrast"
                                type="range"
                                min="0"
                                max="2"
                                step="0.05"
                                value={adjustments.contrast}
                                onInput={(event) => {
                                    const target = event.target;
                                    if (target instanceof HTMLInputElement) {
                                        handleAdjustmentInput('contrast', Number(target.value));
                                    }
                                }}
                                disabled={!image || busy}
                            />
                        </label>
                        <label className="image-editor__slider">
                            <span>Saturation: <span id="image-editor-saturate-value">{Math.round(adjustments.saturate * 100)}%</span></span>
                            <input
                                id="image-editor-adj-saturate"
                                type="range"
                                min="0"
                                max="2"
                                step="0.05"
                                value={adjustments.saturate}
                                onInput={(event) => {
                                    const target = event.target;
                                    if (target instanceof HTMLInputElement) {
                                        handleAdjustmentInput('saturate', Number(target.value));
                                    }
                                }}
                                disabled={!image || busy}
                            />
                        </label>
                        <label className="image-editor__slider">
                            <span>Grayscale: <span id="image-editor-grayscale-value">{Math.round(adjustments.grayscale * 100)}%</span></span>
                            <input
                                id="image-editor-adj-grayscale"
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={adjustments.grayscale}
                                onInput={(event) => {
                                    const target = event.target;
                                    if (target instanceof HTMLInputElement) {
                                        handleAdjustmentInput('grayscale', Number(target.value));
                                    }
                                }}
                                disabled={!image || busy}
                            />
                        </label>
                        <label className="image-editor__slider">
                            <span>Blur: <span id="image-editor-blur-value">{adjustments.blur.toFixed(1)}px</span></span>
                            <input
                                id="image-editor-adj-blur"
                                type="range"
                                min="0"
                                max="10"
                                step="0.5"
                                value={adjustments.blur}
                                onInput={(event) => {
                                    const target = event.target;
                                    if (target instanceof HTMLInputElement) {
                                        handleAdjustmentInput('blur', Number(target.value));
                                    }
                                }}
                                disabled={!image || busy}
                            />
                        </label>
                        <div className="image-editor__button-row">
                            <button
                                id="image-editor-adjust-reset"
                                type="button"
                                className="c-button c-button--ghost"
                                onClick={() => setAdjustments({ ...DEFAULT_ADJUSTMENTS })}
                                disabled={!image || busy || isDefaultAdjustments(adjustments)}
                            >
                                Reset adjustments
                            </button>
                        </div>
                    </ConfigDisclosure>

                    <ConfigDisclosure
                        sectionId="caption"
                        headingId="image-editor-caption-heading"
                        title="Caption"
                        hint="Text overlay on export"
                        open={openSections.caption}
                        onToggle={handleSectionToggle}
                    >
                        <label className="image-editor__check">
                            <input
                                id="image-editor-caption-enable"
                                type="checkbox"
                                checked={captionEnabled}
                                onChange={(event) => {
                                    const target = event.target;
                                    setCaptionEnabled(target instanceof HTMLInputElement ? target.checked : false);
                                }}
                                disabled={!image || busy}
                            />
                            <span>Add a caption</span>
                        </label>
                        <label className="image-editor__field">
                            <span>Text</span>
                            <input
                                id="image-editor-caption-text"
                                type="text"
                                maxLength={CAPTION_MAX_LENGTH}
                                className="c-input"
                                placeholder="e.g. Sunset over the hills"
                                value={caption.text}
                                onInput={(event) => {
                                    const target = event.target;
                                    setCaption((previous) => ({
                                        ...previous,
                                        text: target instanceof HTMLInputElement ? target.value : ''
                                    }));
                                }}
                                disabled={!image || busy || !captionEnabled}
                            />
                        </label>
                        <div className="image-editor__caption-grid">
                            <label className="image-editor__slider">
                                <span>Size: <span id="image-editor-caption-size-value">{caption.sizePercent}%</span></span>
                                <input
                                    id="image-editor-caption-size"
                                    type="range"
                                    min="2"
                                    max="10"
                                    step="0.5"
                                    value={caption.sizePercent}
                                    onInput={(event) => {
                                        const target = event.target;
                                        if (target instanceof HTMLInputElement) {
                                            setCaption((previous) => ({ ...previous, sizePercent: Number(target.value) }));
                                        }
                                    }}
                                    disabled={!image || busy || !captionEnabled}
                                />
                            </label>
                            <label className="image-editor__field">
                                <span>Color</span>
                                <input
                                    id="image-editor-caption-color"
                                    type="color"
                                    className="c-input image-editor__color"
                                    value={caption.color}
                                    onInput={(event) => {
                                        const target = event.target;
                                        if (target instanceof HTMLInputElement) {
                                            setCaption((previous) => ({ ...previous, color: target.value }));
                                        }
                                    }}
                                    disabled={!image || busy || !captionEnabled}
                                />
                            </label>
                        </div>
                        <label className="image-editor__field">
                            <span>Position</span>
                            <select
                                id="image-editor-caption-position"
                                className="c-input"
                                value={caption.position}
                                onChange={(event) => {
                                    const target = event.target;
                                    if (target instanceof HTMLSelectElement) {
                                        setCaption((previous) => ({ ...previous, position: target.value as CaptionState['position'] }));
                                    }
                                }}
                                disabled={!image || busy || !captionEnabled}
                            >
                                {CAPTION_POSITIONS.map((position) => (
                                    <option key={position.id} value={position.id}>{position.label}</option>
                                ))}
                            </select>
                        </label>
                    </ConfigDisclosure>
                    </div>

                    <div className="image-editor__group">
                        <h3 className="image-editor__group-title">Output</h3>

                    <ConfigDisclosure
                        sectionId="export"
                        headingId="image-editor-export-heading"
                        title="Export"
                        hint="Format, quality, size estimate"
                        open={openSections.export}
                        onToggle={handleSectionToggle}
                    >
                        <div className="image-editor__button-row" role="group" aria-label="Export format">
                            {EXPORT_FORMATS.map((option) => (
                                <button
                                    key={option.id}
                                    id={`image-editor-format-${option.id}`}
                                    type="button"
                                    className={`c-button c-button--ghost image-editor__chip${format === option.id ? ' is-active' : ''}`}
                                    aria-pressed={format === option.id}
                                    onClick={() => setFormat(option.id)}
                                    disabled={!image || busy}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        {showQuality && (
                            <label className="image-editor__slider">
                                <span>Quality: <span id="image-editor-quality-value">{quality}%</span></span>
                                <input
                                    id="image-editor-quality"
                                    type="range"
                                    min="10"
                                    max="100"
                                    step="1"
                                    value={quality}
                                    onInput={(event) => {
                                        const target = event.target;
                                        if (target instanceof HTMLInputElement) {
                                            setQuality(Number(target.value));
                                        }
                                    }}
                                    disabled={!image || busy}
                                />
                            </label>
                        )}
                        <p id="image-editor-estimate" className="image-editor__estimate" aria-live="polite">
                            {image ? `Estimated output: ${estimate ?? '…'}` : 'Load an image to see the estimated output size.'}
                        </p>
                    </ConfigDisclosure>
                    </div>
                </div>

                <div className="image-editor__preview c-surface-card">
                    <div
                        id="image-editor-stage"
                        ref={stageRef}
                        className="image-editor__stage"
                    >
                        {!image ? (
                            <div id="image-editor-empty" className="c-empty-state image-editor__empty">
                                <span className="c-empty-state__icon" aria-hidden="true">
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                        <circle cx="9" cy="9" r="2" />
                                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                    </svg>
                                </span>
                                <p className="c-empty-state__message">Your edited image will appear here</p>
                                <p className="c-empty-state__hint">Choose a file, drag &amp; drop it here, or paste an image from the clipboard.</p>
                                <div className="image-editor__empty-actions">
                                    <label className="c-button c-button--secondary" htmlFor="image-editor-file">
                                        Choose image
                                    </label>
                                    <button
                                        type="button"
                                        className="c-button c-button--ghost"
                                        onClick={() => void loadSample()}
                                        disabled={busy}
                                    >
                                        Try a sample
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className="image-editor__canvas-wrap"
                                ref={wrapRef}
                                onPointerDown={handleStagePointerDown as (event: PointerEvent) => void}
                                onPointerMove={handleStagePointerMove as (event: PointerEvent) => void}
                                onPointerUp={endDrag}
                                onPointerCancel={endDrag}
                            >
                                <canvas
                                    id="image-editor-preview"
                                    ref={canvasRef}
                                    className="image-editor__canvas"
                                    role="img"
                                    aria-label={`Preview: ${image.working.width} by ${image.working.height} pixels`}
                                />
                                {cropOverlay}
                            </div>
                        )}
                    </div>

                    {image && (
                        <dl id="image-editor-info" className="image-editor__info">
                            <div>
                                <dt>File</dt>
                                <dd className="image-editor__info-name">{image.name}</dd>
                            </div>
                            <div>
                                <dt>Dimensions</dt>
                                <dd>{image.working.width} × {image.working.height} px</dd>
                            </div>
                            <div>
                                <dt>Original</dt>
                                <dd>{image.type || 'unknown type'} · {formatBytes(image.bytes)}</dd>
                            </div>
                        </dl>
                    )}

                    <div className="image-editor__actions">
                        <button
                            id="image-editor-export"
                            type="button"
                            className="c-button"
                            onClick={() => void exportImage()}
                            disabled={!image || busy}
                        >
                            {busy ? 'Working…' : `Export ${formatLabel}`}
                            {!busy && <span className="c-kbd" aria-hidden="true">⌘⏎</span>}
                        </button>
                        {image && (
                            <>
                                <label className="c-button c-button--secondary" htmlFor="image-editor-file">
                                    Replace image
                                </label>
                                <button
                                    id="image-editor-reset"
                                    type="button"
                                    className="c-button c-button--secondary"
                                    onClick={resetToOriginal}
                                    disabled={busy}
                                >
                                    Reset image
                                </button>
                                <button
                                    id="image-editor-clear"
                                    type="button"
                                    className="c-button c-button--ghost"
                                    onClick={clearImage}
                                    disabled={busy}
                                >
                                    Remove
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div id="notification" className="c-notification" role="status" aria-live="polite" />
        </div>
    );
}

export class ImageEditorToolUI {
    constructor(rootSelector = '#image-editor-app') {
        const root = document.querySelector(rootSelector) || document.querySelector('#image-editor-tool');
        if (!root) {
            throw new Error('Image Editor root element not found');
        }

        const mount = root.hasChildNodes() ? hydrate : render;
        mount(<ImageEditorApp />, root);
    }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', () => {
        mountToolShell({
            title: toolMetadata.title,
            description: toolMetadata.description,
            homeHref: '/'
        });

        const imageEditor = new ImageEditorToolUI();
        if (typeof window !== 'undefined') {
            const browserWindow = window as Window & { imageEditor?: ImageEditorToolUI };
            browserWindow.imageEditor = imageEditor;
        }
    });
}
