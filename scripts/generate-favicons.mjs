// Rasterize favicon.svg into the legacy/raster fallbacks that some clients still
// request directly: apple-touch-icon.png (iOS home screen) and favicon.ico (the
// bare /favicon.ico auto-request and older crawlers). The SVG is the source of
// truth; run `npm run favicons` after editing favicon.svg.
//
// Output assets are committed; CI never runs this — it's a reproducible art step
// (same model as scripts/generate-og-images.mjs).

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SVG_PATH = path.join(REPO_ROOT, 'favicon.svg');

// Apple touch icons render on an opaque tile, so keep the iris background (no
// transparency) and pad slightly so the glyph is not flush against the corners.
const APPLE_TOUCH_SIZE = 180;
// ICO carries the two sizes browsers actually pick from for tabs/bookmarks.
const ICO_SIZES = [16, 32];

const svgMarkup = readFileSync(SVG_PATH, 'utf8');

/**
 * @param {import('playwright').Page} page
 * @param {number} size
 * @returns {Promise<Buffer>}
 */
async function renderPng(page, size) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
        `<!DOCTYPE html><html><head><style>
          html,body{margin:0;padding:0;background:transparent}
          svg{display:block;width:${size}px;height:${size}px}
        </style></head><body>${svgMarkup}</body></html>`,
        { waitUntil: 'networkidle' }
    );
    const element = await page.$('svg');
    if (!element) {
        throw new Error('favicon.svg did not render an <svg> element');
    }
    return element.screenshot({ omitBackground: true, type: 'png' });
}

/**
 * Pack one or more PNG buffers into a single .ico container. PNG-compressed ICO
 * entries are supported by every browser in the project's browserslist.
 * @param {{ size: number, data: Buffer }[]} images
 * @returns {Buffer}
 */
function buildIco(images) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // type: 1 = icon
    header.writeUInt16LE(images.length, 4);

    const directory = Buffer.alloc(16 * images.length);
    let offset = header.length + directory.length;
    const entries = [];

    images.forEach((image, index) => {
        const base = index * 16;
        // 0 in the width/height byte signals 256px; our sizes are < 256 so the
        // raw value is fine.
        directory.writeUInt8(image.size >= 256 ? 0 : image.size, base + 0);
        directory.writeUInt8(image.size >= 256 ? 0 : image.size, base + 1);
        directory.writeUInt8(0, base + 2); // palette count (0 = no palette)
        directory.writeUInt8(0, base + 3); // reserved
        directory.writeUInt16LE(1, base + 4); // color planes
        directory.writeUInt16LE(32, base + 6); // bits per pixel
        directory.writeUInt32LE(image.data.length, base + 8); // image data size
        directory.writeUInt32LE(offset, base + 12); // image data offset
        offset += image.data.length;
        entries.push(image.data);
    });

    return Buffer.concat([header, directory, ...entries]);
}

async function main() {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();

        const applePng = await renderPng(page, APPLE_TOUCH_SIZE);
        writeFileSync(path.join(REPO_ROOT, 'apple-touch-icon.png'), applePng);
        console.log(`apple-touch-icon.png  ${APPLE_TOUCH_SIZE}x${APPLE_TOUCH_SIZE}  ${applePng.length} bytes`);

        const icoImages = [];
        for (const size of ICO_SIZES) {
            // eslint-disable-next-line no-await-in-loop
            const data = await renderPng(page, size);
            icoImages.push({ size, data });
        }
        const ico = buildIco(icoImages);
        writeFileSync(path.join(REPO_ROOT, 'favicon.ico'), ico);
        console.log(`favicon.ico           ${ICO_SIZES.join('+')}  ${ico.length} bytes`);
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
