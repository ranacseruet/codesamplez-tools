/**
 * Pure image-editing math for the Image Editor tool.
 *
 * This module is deliberately DOM-free (no canvas, no `document`) so every
 * function is unit-testable under jsdom. All canvas work lives in
 * `script.tsx`, which calls into these helpers for geometry, filter strings,
 * caption layout, and export mapping.
 */

import { formatBytes } from '../common/format-utils';

export interface CropRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type AspectPresetId = 'free' | '1:1' | '4:3' | '3:2' | '16:9';

export interface AspectPreset {
    id: AspectPresetId;
    label: string;
    /** Width/height ratio, or null for unconstrained. */
    ratio: number | null;
}

export const CROP_PRESETS: AspectPreset[] = [
    { id: 'free', label: 'Free', ratio: null },
    { id: '1:1', label: 'Square 1:1', ratio: 1 },
    { id: '4:3', label: 'Standard 4:3', ratio: 4 / 3 },
    { id: '3:2', label: 'Classic 3:2', ratio: 3 / 2 },
    { id: '16:9', label: 'Widescreen 16:9', ratio: 16 / 9 }
];

export type Rotation = 0 | 90 | 180 | 270;

export type ExportFormat = 'png' | 'jpeg' | 'webp';

export interface ExportFormatOption {
    id: ExportFormat;
    label: string;
    mime: string;
    extension: string;
    supportsQuality: boolean;
}

export const EXPORT_FORMATS: ExportFormatOption[] = [
    { id: 'png', label: 'PNG', mime: 'image/png', extension: 'png', supportsQuality: false },
    { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', extension: 'jpg', supportsQuality: true },
    { id: 'webp', label: 'WebP', mime: 'image/webp', extension: 'webp', supportsQuality: true }
];

/** Brightness/contrast/saturate are multipliers around 1; grayscale 0..1; blur in px. */
export interface Adjustments {
    brightness: number;
    contrast: number;
    saturate: number;
    grayscale: number;
    blur: number;
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
    brightness: 1,
    contrast: 1,
    saturate: 1,
    grayscale: 0,
    blur: 0
};

export interface AdjustmentPreset {
    id: string;
    label: string;
    adjustments: Adjustments;
}

export const ADJUSTMENT_PRESETS: AdjustmentPreset[] = [
    { id: 'original', label: 'Original', adjustments: { ...DEFAULT_ADJUSTMENTS } },
    { id: 'bw', label: 'B&W', adjustments: { ...DEFAULT_ADJUSTMENTS, grayscale: 1, contrast: 1.1 } },
    { id: 'sepia', label: 'Sepia', adjustments: { ...DEFAULT_ADJUSTMENTS, saturate: 0.6, grayscale: 0.35, brightness: 1.05 } },
    { id: 'warm', label: 'Warm', adjustments: { ...DEFAULT_ADJUSTMENTS, saturate: 1.25, brightness: 1.06, contrast: 1.04 } }
];

export type CaptionPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-center';

export const CAPTION_POSITIONS: { id: CaptionPosition; label: string }[] = [
    { id: 'top-left', label: 'Top left' },
    { id: 'top-right', label: 'Top right' },
    { id: 'bottom-left', label: 'Bottom left' },
    { id: 'bottom-right', label: 'Bottom right' },
    { id: 'bottom-center', label: 'Bottom center' }
];

export interface CaptionState {
    text: string;
    /** Font size as a percentage of the output width (2–10). */
    sizePercent: number;
    color: string;
    position: CaptionPosition;
}

export const DEFAULT_CAPTION: CaptionState = {
    text: '',
    sizePercent: 5,
    color: '#ffffff',
    position: 'bottom-center'
};

/** Raw files above this are rejected before decode to avoid main-thread jank. */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Decoded images above this are rejected (memory + full-res export cost). */
export const MAX_IMAGE_MEGAPIXELS = 25;

const ACCEPTED_IMAGE_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/bmp'
]);

export interface ImageFileLike {
    type: string;
    size: number;
    name: string;
}

/**
 * Rejects non-image or oversized files before any decode work happens.
 * Returns the user-facing error message, or null when the file is acceptable.
 */
export function validateImageFile(file: ImageFileLike): string | null {
    if (!ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
        return `“${file.name}” is not a supported image. Use PNG, JPEG, WebP, GIF, AVIF, or BMP.`;
    }

    if (file.size > MAX_IMAGE_BYTES) {
        return `“${file.name}” is larger than ${formatBytes(MAX_IMAGE_BYTES)}. Try a smaller file.`;
    }

    return null;
}

/** Rejects decoded images whose pixel count would make export unusable. */
export function checkDecodedDimensions(width: number, height: number): string | null {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
        return 'That image could not be decoded. Try a different file.';
    }

    if (width * height > MAX_IMAGE_MEGAPIXELS * 1_000_000) {
        return `That image is larger than ${MAX_IMAGE_MEGAPIXELS} megapixels. Try a smaller one.`;
    }

    return null;
}

/** Largest centered box with the given ratio (or the full frame when null). */
export function centerCropForAspect(imageWidth: number, imageHeight: number, ratio: number | null): CropRect {
    if (ratio === null || ratio <= 0) {
        return { x: 0, y: 0, width: imageWidth, height: imageHeight };
    }

    const imageRatio = imageWidth / imageHeight;
    let width: number;
    let height: number;

    if (imageRatio > ratio) {
        height = imageHeight;
        width = Math.floor(height * ratio);
    } else {
        width = imageWidth;
        height = Math.floor(width / ratio);
    }

    return {
        x: Math.floor((imageWidth - width) / 2),
        y: Math.floor((imageHeight - height) / 2),
        width,
        height
    };
}

const MIN_CROP_SIDE = 8;

/**
 * A crop-box corner that must not move while an aspect-ratio fit runs.
 * Resize drags pin the corner opposite the grabbed handle; the ratio fit
 * below is top-left anchored, so without re-pinning it would drag the
 * supposedly fixed corner along whenever it trims a side.
 */
export type CropAnchorCorner = 'nw' | 'ne' | 'sw' | 'se';

export interface CropAnchor {
    corner: CropAnchorCorner;
    x: number;
    y: number;
}

/**
 * Clamps a crop box inside the image and, when an aspect ratio is given,
 * re-fits the box to that ratio (anchored at its top-left, or re-pinned to
 * `anchor` when one is supplied). Guarantees a minimum 8px side so pointer
 * math can never produce an empty selection.
 */
export function clampCropRect(
    rect: CropRect,
    boundsWidth: number,
    boundsHeight: number,
    ratio: number | null,
    anchor: CropAnchor | null = null
): CropRect {
    let { x, y, width, height } = rect;

    width = Math.max(MIN_CROP_SIDE, Math.floor(width));
    height = Math.max(MIN_CROP_SIDE, Math.floor(height));

    if (ratio !== null && ratio > 0) {
        if (width / height > ratio) {
            width = Math.floor(height * ratio);
        } else {
            height = Math.floor(width / ratio);
        }
        width = Math.max(MIN_CROP_SIDE, width);
        height = Math.max(MIN_CROP_SIDE, height);

        if (anchor !== null) {
            if (anchor.corner === 'ne' || anchor.corner === 'se') {
                x = anchor.x - width;
            } else {
                x = anchor.x;
            }

            if (anchor.corner === 'sw' || anchor.corner === 'se') {
                y = anchor.y - height;
            } else {
                y = anchor.y;
            }
        }
    }

    width = Math.min(width, boundsWidth);
    height = Math.min(height, boundsHeight);
    x = Math.min(Math.max(0, Math.floor(x)), boundsWidth - width);
    y = Math.min(Math.max(0, Math.floor(y)), boundsHeight - height);

    return { x, y, width, height };
}

/** Moves a crop box by a delta (in image pixels), keeping it inside the image. */
export function moveCropBox(box: CropRect, dx: number, dy: number, boundsWidth: number, boundsHeight: number): CropRect {
    return clampCropRect(
        { x: box.x + Math.round(dx), y: box.y + Math.round(dy), width: box.width, height: box.height },
        boundsWidth,
        boundsHeight,
        null
    );
}

export type CropHandle = 'nw' | 'ne' | 'sw' | 'se';

const OPPOSITE_CORNER: Record<CropHandle, CropAnchorCorner> = {
    nw: 'se',
    ne: 'sw',
    sw: 'ne',
    se: 'nw'
};

/**
 * Resizes a crop box by dragging one corner handle. Deltas are in image
 * pixels; the opposite corner stays anchored. Aspect is preserved only when a
 * ratio is supplied (free mode resizes width/height independently).
 */
export function resizeCropBox(
    box: CropRect,
    handle: CropHandle,
    dx: number,
    dy: number,
    boundsWidth: number,
    boundsHeight: number,
    ratio: number | null
): CropRect {
    const deltaX = Math.round(dx);
    const deltaY = Math.round(dy);

    let { x, y, width, height } = box;

    if (handle === 'se' || handle === 'ne') {
        width += deltaX;
    } else {
        x += deltaX;
        width -= deltaX;
    }

    if (handle === 'se' || handle === 'sw') {
        height += deltaY;
    } else {
        y += deltaY;
        height -= deltaY;
    }

    // Pin the corner opposite the grabbed handle through the ratio fit so a
    // constrained drag never moves the corner the pointer is not touching.
    const corner = OPPOSITE_CORNER[handle];
    const anchor: CropAnchor = {
        corner,
        x: corner === 'nw' || corner === 'sw' ? box.x : box.x + box.width,
        y: corner === 'nw' || corner === 'ne' ? box.y : box.y + box.height
    };

    return clampCropRect({ x, y, width, height }, boundsWidth, boundsHeight, ratio, anchor);
}

/** Output dimensions after a 90°-step rotation. */
export function rotatedDimensions(width: number, height: number, rotation: Rotation): { width: number; height: number } {
    return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}

export type ResizeMode = 'pixels' | 'percent';

export interface ResizeSpec {
    mode: ResizeMode;
    width: number | null;
    height: number | null;
    lockAspect: boolean;
    percent: number | null;
}

const MIN_RESIZE_SIDE = 1;
const MAX_RESIZE_SIDE = 8192;

/** Resolves resize inputs to concrete output dimensions, clamped to 1–8192px. */
export function computeResizeDims(naturalWidth: number, naturalHeight: number, spec: ResizeSpec): { width: number; height: number } {
    if (spec.mode === 'percent') {
        const percent = Number.isFinite(spec.percent) && (spec.percent as number) > 0 ? (spec.percent as number) : 100;
        return {
            width: clampSide(Math.round((naturalWidth * percent) / 100)),
            height: clampSide(Math.round((naturalHeight * percent) / 100))
        };
    }

    const ratio = naturalWidth / naturalHeight;
    let width = spec.width;
    let height = spec.height;

    if (spec.lockAspect) {
        if (width !== null && width > 0) {
            height = Math.round(width / ratio);
        } else if (height !== null && height > 0) {
            width = Math.round(height * ratio);
        }
    }

    return {
        width: clampSide(width !== null && width > 0 ? Math.round(width) : naturalWidth),
        height: clampSide(height !== null && height > 0 ? Math.round(height) : naturalHeight)
    };
}

function clampSide(value: number): number {
    return Math.min(MAX_RESIZE_SIDE, Math.max(MIN_RESIZE_SIDE, value));
}

/**
 * Builds the `CanvasRenderingContext2D.filter` string for live preview and
 * export. Returns 'none' for default adjustments (faster path, identical pixels).
 */
export function buildFilterString(adjustments: Adjustments): string {
    const parts: string[] = [];

    if (adjustments.brightness !== 1) {
        parts.push(`brightness(${round2(adjustments.brightness)})`);
    }

    if (adjustments.contrast !== 1) {
        parts.push(`contrast(${round2(adjustments.contrast)})`);
    }

    if (adjustments.saturate !== 1) {
        parts.push(`saturate(${round2(adjustments.saturate)})`);
    }

    if (adjustments.grayscale !== 0) {
        parts.push(`grayscale(${round2(adjustments.grayscale)})`);
    }

    if (adjustments.blur !== 0) {
        parts.push(`blur(${round2(adjustments.blur)}px)`);
    }

    return parts.length === 0 ? 'none' : parts.join(' ');
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

export function isDefaultAdjustments(adjustments: Adjustments): boolean {
    return (
        adjustments.brightness === 1 &&
        adjustments.contrast === 1 &&
        adjustments.saturate === 1 &&
        adjustments.grayscale === 0 &&
        adjustments.blur === 0
    );
}

/** Finds the preset matching the given adjustments, or null for custom mixes. */
export function matchAdjustmentPreset(adjustments: Adjustments): string | null {
    const found = ADJUSTMENT_PRESETS.find((preset) =>
        preset.adjustments.brightness === adjustments.brightness &&
        preset.adjustments.contrast === adjustments.contrast &&
        preset.adjustments.saturate === adjustments.saturate &&
        preset.adjustments.grayscale === adjustments.grayscale &&
        preset.adjustments.blur === adjustments.blur
    );

    return found ? found.id : null;
}

export function exportMime(format: ExportFormat): string {
    return EXPORT_FORMATS.find((option) => option.id === format)?.mime ?? 'image/png';
}

export function exportExtension(format: ExportFormat): string {
    return EXPORT_FORMATS.find((option) => option.id === format)?.extension ?? 'png';
}

export function supportsQuality(format: ExportFormat): boolean {
    return EXPORT_FORMATS.find((option) => option.id === format)?.supportsQuality ?? false;
}

/** toBlob quality is 0..1; the UI works in 1..100. */
export function qualityToFraction(quality: number): number {
    if (!Number.isFinite(quality)) {
        return 0.92;
    }

    return Math.min(1, Math.max(0.01, quality / 100));
}

export function exportFilename(format: ExportFormat, timestamp: number = Date.now()): string {
    return `edited-image-${timestamp}.${exportExtension(format)}`;
}

export interface CaptionLayout {
    x: number;
    y: number;
    textAlign: CanvasTextAlign;
    font: string;
    maxWidth: number;
    fontPx: number;
}

/**
 * Lays out a caption for the given output size. Font size derives from the
 * output width (percent-based), so preview and full-res export scale together.
 */
export function computeCaptionLayout(outputWidth: number, outputHeight: number, caption: CaptionState): CaptionLayout {
    const fontPx = Math.max(12, Math.round((outputWidth * caption.sizePercent) / 100));
    const padX = Math.round(outputWidth * 0.03);
    const padY = Math.round(outputHeight * 0.03);
    const maxWidth = Math.max(fontPx, outputWidth - padX * 2);

    const bottomY = outputHeight - padY;
    const topY = padY + fontPx;

    switch (caption.position) {
        case 'top-left':
            return { x: padX, y: topY, textAlign: 'left', font: captionFont(fontPx), maxWidth, fontPx };
        case 'top-right':
            return { x: outputWidth - padX, y: topY, textAlign: 'right', font: captionFont(fontPx), maxWidth, fontPx };
        case 'bottom-left':
            return { x: padX, y: bottomY, textAlign: 'left', font: captionFont(fontPx), maxWidth, fontPx };
        case 'bottom-right':
            return { x: outputWidth - padX, y: bottomY, textAlign: 'right', font: captionFont(fontPx), maxWidth, fontPx };
        case 'bottom-center':
        default:
            return { x: Math.round(outputWidth / 2), y: bottomY, textAlign: 'center', font: captionFont(fontPx), maxWidth, fontPx };
    }
}

function captionFont(fontPx: number): string {
    return `600 ${fontPx}px system-ui, -apple-system, "Segoe UI", sans-serif`;
}

/** Scales a measured preview-encode size up to the full-resolution estimate. */
export function scaleEstimateBytes(measuredBytes: number, fullWidth: number, fullHeight: number, previewWidth: number, previewHeight: number): number {
    if (!Number.isFinite(measuredBytes) || measuredBytes < 0) {
        return 0;
    }

    const previewArea = Math.max(1, previewWidth * previewHeight);
    const fullArea = Math.max(1, fullWidth * fullHeight);

    return Math.round((measuredBytes * fullArea) / previewArea);
}

