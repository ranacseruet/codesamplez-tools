# Image Editor Tool

## Overview
The Image Editor Tool is a free browser based image editor that allows users to crop, resize, rotate, adjust, caption, and convert images completely in the browser — every edit is processed locally, nothing is uploaded. This tool is part of the CodeSamplez Tools suite and the first entry in the Image Tools catalog group.

## Privacy & Security
- 100% client-side processing - all image editing happens in your browser via the Canvas API
- No data storage - your images are never uploaded, saved, or transmitted anywhere
- Works offline - can be used without an internet connection after the page loads
- No external dependencies - uses the browser Canvas 2D API only

## Features
- Load images via file picker, drag & drop, clipboard paste, or a built-in sample
- Crop with preset aspect ratios (Free, 1:1, 4:3, 3:2, 16:9) and a draggable selection
- Rotate in 90° steps and flip horizontally/vertically
- Resize to exact pixel dimensions or by percent, with aspect-ratio lock
- Adjust brightness, contrast, saturation, grayscale, and blur with live preview
- One-click filter presets: Original, B&W, Sepia, Warm
- Add text captions with size, color, and position control
- Export as PNG, JPEG, or WebP with quality control and a live size estimate
- Reset to the original image at any time
- Export via button or Cmd/Ctrl+Enter

## Usage

### Basic Editing
1. Load an image (picker, drop, paste, or "Load Sample")
2. Crop, rotate/flip, or resize from the Configuration panel - geometry edits apply immediately
3. Tune color sliders or pick a preset; optionally enable a caption
4. Choose PNG/JPEG/WebP (plus quality for JPEG/WebP) and check the estimated output size
5. Click "Export" to download the finished image

### Limits
- Files up to 15 MB; decoded images up to 25 megapixels
- Supported inputs: PNG, JPEG, WebP, GIF (first frame), AVIF, BMP
- Exports are re-encoded, so original EXIF metadata is not preserved

## Technical Implementation
The editor is built with Preact and zero runtime dependencies:

- Image decoding via `createImageBitmap`
- Geometry edits (crop/rotate/flip/resize) baked into a working `ImageBitmap`
- Color adjustments via the canvas `filter` pipeline, shared by preview and export
- Captions painted with `fillText` at full export resolution
- Export via `canvas.toBlob()` and the shared `DownloadManager`
- Pure, DOM-free geometry/filter math in `image-operations.ts` (fully unit-tested)

### Files
- `tool.meta.json`: Shared page metadata used to generate the standalone document shell
- `image-operations.ts`: Pure editing math (crop, resize, filters, caption layout, export mapping)
- `script.tsx`: `ImageEditorApp` Preact component plus tool shell mounting
- `content.tsx`: Intro/article/FAQ copy plus `FEATURE_LIST` and `HOWTO_STEPS` for structured data
- `styles.css`: Tool-scoped styling
- `*.test.ts(x)`: Unit tests for operations, component behavior, and content
- `images/`: Generated social-share assets (`featured.png`)

### Testing
Run tests with:
```bash
npm test -- image-editor
```

Canvas and bitmap APIs are mocked in `script.test.tsx` (jsdom has no canvas); all editing math is covered without mocks in `image-operations.test.ts`.

## Browser Compatibility
The tool requires a modern browser that supports:
- HTML5 Canvas API (2D context, filter pipeline, toBlob)
- `createImageBitmap` for decoding uploads
- File download support for PNG/JPEG/WebP export
- ES6+ JavaScript

## License

This project is licensed under the [MIT License](../LICENSE).
