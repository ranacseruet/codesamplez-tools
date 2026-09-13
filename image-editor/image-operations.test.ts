import {
    ADJUSTMENT_PRESETS,
    DEFAULT_ADJUSTMENTS,
    buildFilterString,
    centerCropForAspect,
    checkDecodedDimensions,
    clampCropRect,
    computeCaptionLayout,
    computeResizeDims,
    exportExtension,
    exportFilename,
    exportMime,
    formatBytes,
    isDefaultAdjustments,
    matchAdjustmentPreset,
    moveCropBox,
    qualityToFraction,
    resizeCropBox,
    rotatedDimensions,
    scaleEstimateBytes,
    supportsQuality,
    validateImageFile
} from './image-operations';

describe('validateImageFile', () => {
    it('accepts common raster types within the size limit', () => {
        expect(validateImageFile({ type: 'image/png', size: 1024, name: 'a.png' })).toBeNull();
        expect(validateImageFile({ type: 'image/jpeg', size: 1024, name: 'a.jpg' })).toBeNull();
        expect(validateImageFile({ type: 'image/webp', size: 1024, name: 'a.webp' })).toBeNull();
        expect(validateImageFile({ type: 'IMAGE/PNG', size: 1024, name: 'a.png' })).toBeNull();
    });

    it('rejects unsupported types with the file name in the message', () => {
        const message = validateImageFile({ type: 'application/pdf', size: 1024, name: 'doc.pdf' });
        expect(message).toContain('doc.pdf');
        expect(message).toContain('PNG');
    });

    it('rejects oversized files', () => {
        const message = validateImageFile({ type: 'image/png', size: 16 * 1024 * 1024, name: 'big.png' });
        expect(message).toContain('big.png');
        expect(message).toContain('15 MB');
    });
});

describe('checkDecodedDimensions', () => {
    it('accepts normal dimensions', () => {
        expect(checkDecodedDimensions(4000, 3000)).toBeNull();
    });

    it('rejects degenerate dimensions', () => {
        expect(checkDecodedDimensions(0, 100)).not.toBeNull();
        expect(checkDecodedDimensions(Number.NaN, 100)).not.toBeNull();
    });

    it('rejects images over the megapixel cap', () => {
        expect(checkDecodedDimensions(6000, 5000)).toContain('25 megapixels');
    });
});

describe('centerCropForAspect', () => {
    it('returns the full frame for free mode', () => {
        expect(centerCropForAspect(800, 600, null)).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    });

    it('centers a square inside a landscape image', () => {
        expect(centerCropForAspect(800, 600, 1)).toEqual({ x: 100, y: 0, width: 600, height: 600 });
    });

    it('centers a 16:9 box inside a portrait image', () => {
        expect(centerCropForAspect(600, 800, 16 / 9)).toEqual({ x: 0, y: 231, width: 600, height: 337 });
    });
});

describe('clampCropRect', () => {
    it('pulls an overflowing box back inside the image', () => {
        expect(clampCropRect({ x: 700, y: 500, width: 200, height: 200 }, 800, 600, null))
            .toEqual({ x: 600, y: 400, width: 200, height: 200 });
    });

    it('enforces a minimum side', () => {
        const box = clampCropRect({ x: 10, y: 10, width: 2, height: 2 }, 800, 600, null);
        expect(box.width).toBeGreaterThanOrEqual(8);
        expect(box.height).toBeGreaterThanOrEqual(8);
    });

    it('re-fits the box to the requested aspect ratio', () => {
        const box = clampCropRect({ x: 0, y: 0, width: 800, height: 600 }, 800, 600, 1);
        expect(box.width).toBe(box.height);
        expect(box.width).toBe(600);
    });

    it('shrinks an oversized box to the image bounds', () => {
        expect(clampCropRect({ x: 0, y: 0, width: 5000, height: 5000 }, 800, 600, null))
            .toEqual({ x: 0, y: 0, width: 800, height: 600 });
    });
});

describe('moveCropBox', () => {
    it('moves the box and clamps at the edges', () => {
        const box = { x: 100, y: 100, width: 200, height: 200 };
        expect(moveCropBox(box, 50, -20, 800, 600)).toEqual({ x: 150, y: 80, width: 200, height: 200 });
        expect(moveCropBox(box, -500, 0, 800, 600).x).toBe(0);
        expect(moveCropBox(box, 0, 5000, 800, 600).y).toBe(400);
    });
});

describe('resizeCropBox', () => {
    const box = { x: 100, y: 100, width: 200, height: 200 };

    it('grows the box from the south-east handle', () => {
        expect(resizeCropBox(box, 'se', 40, 30, 800, 600, null))
            .toEqual({ x: 100, y: 100, width: 240, height: 230 });
    });

    it('anchors the opposite corner for north-west drags', () => {
        expect(resizeCropBox(box, 'nw', 20, 10, 800, 600, null))
            .toEqual({ x: 120, y: 110, width: 180, height: 190 });
    });

    it('preserves aspect when a ratio is supplied', () => {
        const resized = resizeCropBox(box, 'se', 100, 10, 800, 600, 1);
        expect(resized.width).toBe(resized.height);
    });

    it('keeps the opposite corner fixed for ratio-constrained north-west drags', () => {
        // The 200x200 box at (100, 100) has its south-east corner at
        // (300, 300); the ratio fit must not move it.
        expect(resizeCropBox(box, 'nw', 20, 10, 800, 600, 1))
            .toEqual({ x: 120, y: 120, width: 180, height: 180 });
    });

    it('keeps the opposite corner fixed for ratio-constrained north-east drags', () => {
        expect(resizeCropBox(box, 'ne', 20, 10, 800, 600, 1))
            .toEqual({ x: 100, y: 110, width: 190, height: 190 });
    });

    it('keeps the opposite corner fixed for ratio-constrained south-west drags', () => {
        // The fit only shrinks to meet the ratio: 180x210 at 16:9 keeps the
        // width and trims the height, pinned to the north-east corner.
        expect(resizeCropBox(box, 'sw', 20, 10, 800, 600, 16 / 9))
            .toEqual({ x: 120, y: 100, width: 180, height: 101 });
    });
});

describe('rotatedDimensions', () => {
    it('swaps sides for quarter turns only', () => {
        expect(rotatedDimensions(800, 600, 90)).toEqual({ width: 600, height: 800 });
        expect(rotatedDimensions(800, 600, 270)).toEqual({ width: 600, height: 800 });
        expect(rotatedDimensions(800, 600, 0)).toEqual({ width: 800, height: 600 });
        expect(rotatedDimensions(800, 600, 180)).toEqual({ width: 800, height: 600 });
    });
});

describe('computeResizeDims', () => {
    it('scales by percent', () => {
        expect(computeResizeDims(800, 600, { mode: 'percent', width: null, height: null, lockAspect: true, percent: 50 }))
            .toEqual({ width: 400, height: 300 });
    });

    it('derives the missing side when aspect is locked', () => {
        expect(computeResizeDims(800, 600, { mode: 'pixels', width: 400, height: null, lockAspect: true, percent: null }))
            .toEqual({ width: 400, height: 300 });
        expect(computeResizeDims(800, 600, { mode: 'pixels', width: null, height: 150, lockAspect: true, percent: null }))
            .toEqual({ width: 200, height: 150 });
    });

    it('honours independent sides when unlocked', () => {
        expect(computeResizeDims(800, 600, { mode: 'pixels', width: 100, height: 100, lockAspect: false, percent: null }))
            .toEqual({ width: 100, height: 100 });
    });

    it('clamps to the 1–8192px range', () => {
        expect(computeResizeDims(800, 600, { mode: 'pixels', width: 99999, height: 1, lockAspect: false, percent: null }).width)
            .toBe(8192);
        expect(computeResizeDims(800, 600, { mode: 'percent', width: null, height: null, lockAspect: true, percent: 0 }).width)
            .toBe(800);
        expect(computeResizeDims(800, 600, { mode: 'pixels', width: 0, height: 300, lockAspect: true, percent: null }))
            .toEqual({ width: 400, height: 300 });
        expect(computeResizeDims(800, 600, { mode: 'pixels', width: null, height: 0, lockAspect: true, percent: null }))
            .toEqual({ width: 800, height: 600 });
        expect(computeResizeDims(800, 600, { mode: 'pixels', width: 0, height: 0, lockAspect: false, percent: null }))
            .toEqual({ width: 800, height: 600 });
    });
});

describe('buildFilterString', () => {
    it('returns none for default adjustments', () => {
        expect(buildFilterString({ ...DEFAULT_ADJUSTMENTS })).toBe('none');
        expect(isDefaultAdjustments({ ...DEFAULT_ADJUSTMENTS })).toBe(true);
    });

    it('emits only the changed filters in canvas syntax', () => {
        expect(buildFilterString({ ...DEFAULT_ADJUSTMENTS, brightness: 1.2, blur: 2 }))
            .toBe('brightness(1.2) blur(2px)');
        expect(buildFilterString({ ...DEFAULT_ADJUSTMENTS, grayscale: 0.5, saturate: 1.25, contrast: 0.9 }))
            .toBe('contrast(0.9) saturate(1.25) grayscale(0.5)');
    });
});

describe('matchAdjustmentPreset', () => {
    it('matches each built-in preset exactly', () => {
        ADJUSTMENT_PRESETS.forEach((preset) => {
            expect(matchAdjustmentPreset({ ...preset.adjustments })).toBe(preset.id);
        });
    });

    it('returns null for custom mixes', () => {
        expect(matchAdjustmentPreset({ ...DEFAULT_ADJUSTMENTS, brightness: 1.01 })).toBeNull();
    });
});

describe('export mapping', () => {
    it('maps formats to mime types and extensions', () => {
        expect(exportMime('png')).toBe('image/png');
        expect(exportMime('jpeg')).toBe('image/jpeg');
        expect(exportMime('webp')).toBe('image/webp');
        expect(exportMime('unknown' as any)).toBe('image/png');
        expect(exportExtension('jpeg')).toBe('jpg');
        expect(exportExtension('unknown' as any)).toBe('png');
        expect(supportsQuality('png')).toBe(false);
        expect(supportsQuality('webp')).toBe(true);
        expect(supportsQuality('unknown' as any)).toBe(false);
    });

    it('converts UI quality to a toBlob fraction', () => {
        expect(qualityToFraction(92)).toBeCloseTo(0.92);
        expect(qualityToFraction(500)).toBe(1);
        expect(qualityToFraction(-5)).toBe(0.01);
        expect(qualityToFraction(Number.NaN)).toBe(0.92);
    });

    it('builds timestamped filenames', () => {
        expect(exportFilename('png', 123)).toBe('edited-image-123.png');
        expect(exportFilename('jpeg', 123)).toBe('edited-image-123.jpg');
        expect(exportFilename('png')).toMatch(/^edited-image-\d+\.png$/);
    });
});

describe('computeCaptionLayout', () => {
    const caption = { text: 'Hi', sizePercent: 5, color: '#fff', position: 'bottom-center' as const };

    it('scales the font from the output width', () => {
        expect(computeCaptionLayout(1000, 800, caption).fontPx).toBe(50);
        expect(computeCaptionLayout(100, 80, caption).fontPx).toBe(12);
    });

    it('anchors corners and centers correctly', () => {
        expect(computeCaptionLayout(1000, 800, { ...caption, position: 'top-left' }))
            .toMatchObject({ x: 30, textAlign: 'left' });
        expect(computeCaptionLayout(1000, 800, { ...caption, position: 'top-right' }))
            .toMatchObject({ x: 970, textAlign: 'right' });
        expect(computeCaptionLayout(1000, 800, { ...caption, position: 'bottom-left' }))
            .toMatchObject({ x: 30, y: 776, textAlign: 'left' });
        expect(computeCaptionLayout(1000, 800, { ...caption, position: 'bottom-right' }))
            .toMatchObject({ x: 970, y: 776, textAlign: 'right' });
        expect(computeCaptionLayout(1000, 800, { ...caption, position: 'bottom-center' }))
            .toMatchObject({ x: 500, y: 776, textAlign: 'center' });
    });
});

describe('scaleEstimateBytes', () => {
    it('scales a preview measurement by pixel-area ratio', () => {
        expect(scaleEstimateBytes(1000, 1600, 1200, 800, 600)).toBe(4000);
    });

    it('returns 0 for invalid measurements', () => {
        expect(scaleEstimateBytes(Number.NaN, 100, 100, 10, 10)).toBe(0);
    });
});

describe('formatBytes', () => {
    it('formats bytes, KiB, and MB like the shared drop-zone helper', () => {
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(2048)).toBe('2 KiB');
        expect(formatBytes(1536)).toBe('1.5 KiB');
        expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
        expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
        expect(formatBytes(Number.NaN)).toBe('—');
    });
});
