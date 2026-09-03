import type { JSX } from 'preact';
import { SITE_BASE_URL } from '../common/siteBaseUrl';
import { ToolArticleSection, ToolFaqList, type ToolFaqItem } from '../common/tool-article/ToolArticle';

function createPlainTextFaqItem(question: string, answer: string): ToolFaqItem {
    return {
        question,
        answer,
        structuredDataAnswer: answer
    };
}

export const FAQ_ITEMS: ToolFaqItem[] = [
    createPlainTextFaqItem(
        'What is a browser based image editor?',
        'A browser based image editor is a web tool that lets you modify pictures - cropping, resizing, rotating, adjusting colors, or converting formats - without installing desktop software and without uploading anything. This editor runs entirely in your browser, so every edit is processed locally on your device and your images never leave it.'
    ),
    createPlainTextFaqItem(
        'How do I crop an image with this tool?',
        'Load an image, pick an aspect-ratio preset such as Square 1:1 or Widescreen 16:9 (or leave it on Free), then drag on the preview to move or resize the selection box. Click "Apply crop" to bake the crop into the working image.'
    ),
    createPlainTextFaqItem(
        'How do I resize an image to exact dimensions?',
        'Open the Resize section, enter the target width and height in pixels, and click "Apply resize". Keep "Lock aspect ratio" checked to have the missing side computed automatically, or switch to Percent mode to scale relative to the current size.'
    ),
    createPlainTextFaqItem(
        'Is this image editor private? Are my photos uploaded anywhere?',
        'Yes. Every operation - loading, cropping, filtering, and exporting - happens locally in your browser using the Canvas API. Your images are never uploaded to a server, stored, or transmitted anywhere.'
    ),
    createPlainTextFaqItem(
        'Which image formats can I open and export?',
        'You can open PNG, JPEG, WebP, GIF, AVIF, and BMP files. Export is available as PNG, JPEG, or WebP, with an adjustable quality slider for JPEG and WebP so you can balance file size against visual fidelity.'
    ),
    createPlainTextFaqItem(
        'What is the maximum image size I can edit?',
        'Files up to 15 MB and decoded images up to 25 megapixels are accepted. Larger inputs are rejected with a message before any heavy processing starts, keeping the page responsive.'
    ),
    createPlainTextFaqItem(
        'How do I reduce an image file size for the web or email?',
        'Load the image, optionally resize it to smaller dimensions, then export as JPEG or WebP with a lower quality setting. The tool shows an estimated output size before you download, so you can tune quality against your size target.'
    ),
    createPlainTextFaqItem(
        'Can I add text or a watermark to my photo?',
        'Yes. Enable the Caption section, type your text, and choose size, color, and position. The caption is painted onto the image at export time and scales with the output resolution.'
    ),
    createPlainTextFaqItem(
        'Do animated GIFs keep their animation after editing?',
        'No. The browser decodes only the first frame of an animated GIF for editing, so the exported PNG, JPEG, or WebP is a still image. Use a dedicated GIF tool if you need to preserve animation.'
    ),
    createPlainTextFaqItem(
        'Does the editor preserve EXIF metadata like camera settings or GPS?',
        'No. Exporting re-encodes the pixels into a fresh file, which drops the original EXIF block - including any embedded GPS location. If you need to keep metadata, treat the export as a metadata-stripped copy.'
    ),
    createPlainTextFaqItem(
        'Can I undo an edit?',
        'Geometry edits (crop, rotate, flip, resize) apply immediately to the working image, while color adjustments and captions stay live until export. "Reset image" restores the original file at any time, and "Reset adjustments" clears only the color filters.'
    ),
    createPlainTextFaqItem(
        'Is this image editor free, and does it work on mobile?',
        'Yes, it is completely free with no signup, watermark, or usage limit. The layout adapts to narrow screens, and touch dragging works for the crop selection, so basic edits are comfortable on phones and tablets.'
    )
];

export interface ToolHowToStep {
    name: string;
    text: string;
}

export const HOWTO_STEPS: ToolHowToStep[] = [
    {
        name: 'Load an image',
        text: 'Click "Choose image" to pick a file, drag & drop an image onto the preview area, paste one from the clipboard, or press "Load Sample" to try the tool with a built-in picture.'
    },
    {
        name: 'Crop, rotate, or resize',
        text: 'Pick a crop ratio and drag the selection on the preview, then "Apply crop". Use the rotate/flip buttons for orientation, or enter exact pixel dimensions (or a percent scale) and "Apply resize".'
    },
    {
        name: 'Adjust colors and add a caption',
        text: 'Tune brightness, contrast, saturation, grayscale, and blur with the sliders, or start from a one-click preset. Optionally enable a caption with custom text, size, color, and position.'
    },
    {
        name: 'Choose the export format',
        text: 'Select PNG for lossless output, or JPEG/WebP with a quality setting to shrink the file. The estimated output size updates as you change format and quality.'
    },
    {
        name: 'Export the result',
        text: 'Click "Export" (or press Cmd/Ctrl+Enter) to download the finished image. Everything was processed locally, so nothing was uploaded.'
    }
];

export const FEATURE_LIST: string[] = [
    'Crop with preset aspect ratios and a draggable selection',
    'Rotate in 90° steps and flip horizontally or vertically',
    'Resize to exact pixels or by percent with aspect lock',
    'Brightness, contrast, saturation, grayscale, and blur sliders',
    'One-click filter presets: Original, B&W, Sepia, Warm',
    'Text captions with size, color, and position control',
    'Export to PNG, JPEG, or WebP with quality control',
    'Live estimated output file size',
    'Load via picker, drag & drop, clipboard paste, or sample',
    'Reset to original at any time',
    '100% client-side processing, no uploads',
    'Keyboard shortcut (Cmd/Ctrl+Enter) for export'
];

export function ImageEditorIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="image-editor-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="image-editor-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    A browser based image editor is a tool that modifies pictures without desktop software or
                    uploads. Use one whenever you need to crop a screenshot, resize a photo for the web, straighten
                    an orientation, touch up colors, or convert between formats. The CodeSamplez Image Editor does
                    all of this <strong>entirely in your browser</strong> - every pixel is processed locally on
                    your device and your pictures never leave it.
                </p>
            </div>
        </section>
    );
}

export function ImageEditorArticle(): JSX.Element {
    return (
        <section className="c-tool-article c-surface-card" aria-labelledby="image-editor-article-heading">
            <div className="c-tool-article__content">
                <h2 id="image-editor-article-heading" className="c-tool-article__sr-only">Image Editor Guide</h2>

                <ToolArticleSection id="image-editor-how-to-use" title="How To Edit Images With This Tool:">
                    <ol>
                        {HOWTO_STEPS.map((step) => (
                            <li key={step.name}>
                                <strong>{step.name}</strong>. {step.text}
                            </li>
                        ))}
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="image-editor-advanced-usage" title="Advanced Usage">
                    <ul>
                        <li><strong>For the web:</strong> resize to the display size first, then export WebP around 80% quality for the smallest file that still looks sharp.</li>
                        <li><strong>For print or archives:</strong> keep PNG (lossless) and avoid repeated JPEG re-exports, which accumulate compression artifacts.</li>
                        <li><strong>For social posts:</strong> crop to Square 1:1 or Widescreen 16:9 before exporting so platforms do not auto-crop your subject.</li>
                        <li><strong>For screenshots with text:</strong> prefer PNG and skip blur, since lossy compression softens small lettering.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="image-editor-features" title="Image Editor Supported Features">
                    <ul>
                        {FEATURE_LIST.map((feature) => (
                            <li key={feature}>{feature}.</li>
                        ))}
                    </ul>

                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href={SITE_BASE_URL}>
                            Explore More Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="image-editor-technology" title="Technology">
                    <p>
                        This tool uses the browser Canvas 2D API for every pixel operation: geometry edits are baked
                        into a working bitmap, while color adjustments run through the canvas filter pipeline and
                        captions are painted with fillText at export resolution. Everything happens locally in the
                        page, which keeps editing fast and avoids sending your images to a server.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="image-editor-error-handling" title="Error Handling">
                    <ul>
                        <li>Rejects non-image files before decoding, naming the expected formats.</li>
                        <li>Rejects files over 15 MB and decoded images over 25 megapixels with a clear message.</li>
                        <li>Surfaces decode and export failures as toasts without losing the loaded image.</li>
                        <li>Lets you recover at any point with per-section resets or a full reset to the original.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="image-editor-privacy" title="Privacy & Security">
                    <ul>
                        <li>100% client-side processing: loading, editing, and exporting happen in your browser.</li>
                        <li>No data storage: your images are not uploaded, persisted, or transmitted by the tool.</li>
                        <li>Works offline after the initial page load in capable browsers.</li>
                        <li>No external services are required at edit or export time.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="image-editor-browser-compatibility" title="Browser Compatibility">
                    <p>The tool works in modern browsers that support:</p>
                    <ul>
                        <li>HTML5 Canvas API (2D context, filter pipeline, toBlob export)</li>
                        <li>createImageBitmap for decoding uploads</li>
                        <li>File download support for PNG/JPEG/WebP export</li>
                        <li>ES6+ JavaScript features</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="image-editor-feedback" title="Feedback">
                    <p>
                        Have a bug report, feature request, or workflow improvement for the image editor? Please{' '}
                        <a href="https://codesamplez.com/contact">contact us</a>.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="image-editor-faqs" title="Frequently Asked Questions (FAQs)">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
