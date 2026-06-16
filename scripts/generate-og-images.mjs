// Regenerate each tool's social-share image (<tool>/images/featured.png) as a
// branded v2 OG card (1200x630), rendered with the real Geist font + DS iris
// tokens + the tool's inlined Lucide icon. Run: `npm run og:images`.
//
// Output PNGs are committed; CI never runs this — it's a reproducible art step.

import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { getToolDefinitions, loadManifest } = require('./tool-manifest');
const { renderInlineIcon } = require('./lucide-icons');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 1200;
const HEIGHT = 630;

function fontDataUri(relativePath) {
    const buffer = readFileSync(path.join(REPO_ROOT, relativePath));
    return `data:font/woff2;base64,${buffer.toString('base64')}`;
}

const GEIST = fontDataUri('fonts/Geist-Variable.woff2');
const GEIST_MONO = fontDataUri('fonts/GeistMono-Variable.woff2');

function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function renderCardHtml(card) {
    const isLive = card.status !== 'soon';
    const statusLabel = isLive ? 'Live' : 'Soon';
    const statusColor = isLive ? '#4ade80' : '#9a9bab';
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: "Geist"; font-weight: 100 900; font-style: normal; src: url(${GEIST}) format("woff2"); }
  @font-face { font-family: "Geist Mono"; font-weight: 100 900; font-style: normal; src: url(${GEIST_MONO}) format("woff2"); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
  body {
    font-family: "Geist", system-ui, sans-serif;
    color: #ededf2;
    background:
      radial-gradient(circle at 100% 0%, rgba(111, 91, 240, 0.28), transparent 46%),
      radial-gradient(circle at 0% 100%, rgba(95, 224, 194, 0.14), transparent 42%),
      #0b0b11;
    position: relative;
    overflow: hidden;
  }
  .grid {
    position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(rgba(169, 156, 255, 0.07) 1.4px, transparent 1.4px);
    background-size: 30px 30px;
    -webkit-mask-image: linear-gradient(125deg, rgba(0,0,0,0.9), transparent 65%);
            mask-image: linear-gradient(125deg, rgba(0,0,0,0.9), transparent 65%);
  }
  .frame {
    position: relative; height: 100%;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 72px 80px;
  }
  .brand {
    display: inline-flex; align-items: center; gap: 12px;
    font-family: "Geist Mono", monospace; font-size: 22px; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase; color: #a99cff;
  }
  .brand .mark {
    padding: 4px 12px; border-radius: 999px;
    background: rgba(111, 91, 240, 0.14); border: 1px solid rgba(111, 91, 240, 0.3);
  }
  .body { display: flex; align-items: center; gap: 34px; }
  .tile {
    flex: none; width: 132px; height: 132px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 26px; color: #a99cff;
    background: rgba(111, 91, 240, 0.16); border: 1.5px solid rgba(111, 91, 240, 0.3);
  }
  .tile svg { width: 70px; height: 70px; stroke-width: 1.75; }
  .title {
    font-size: 76px; font-weight: 700; line-height: 1.02; letter-spacing: -0.03em;
    background: linear-gradient(120deg, #a99cff 0%, #6f5bf0 100%);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  }
  .desc {
    font-size: 30px; line-height: 1.5; color: #9a9bab; max-width: 1000px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .footer { display: flex; align-items: center; justify-content: space-between; }
  .status {
    display: inline-flex; align-items: center; gap: 10px;
    font-family: "Geist Mono", monospace; font-size: 20px; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase; color: ${statusColor};
    padding: 8px 16px; border-radius: 999px;
    background: color-mix(in srgb, ${statusColor} 14%, transparent);
  }
  .status .dot { width: 9px; height: 9px; border-radius: 50%; background: currentColor; }
  .url { font-family: "Geist Mono", monospace; font-size: 22px; color: #51515e; letter-spacing: 0.02em; }
</style>
</head>
<body>
  <div class="grid"></div>
  <div class="frame">
    <div class="brand"><span class="mark">&lt;/&gt;</span> CodeSamplez Tools</div>
    <div class="content">
      <div class="body">
        <div class="tile">${renderInlineIcon(card.icon || 'wrench')}</div>
        <div class="title">${escapeHtml(card.title)}</div>
      </div>
      <p class="desc" style="margin-top: 30px;">${escapeHtml(card.description)}</p>
    </div>
    <div class="footer">
      <span class="url">tools.codesamplez.com</span>
      <span class="status"><span class="dot"></span>${escapeHtml(statusLabel)}</span>
    </div>
  </div>
</body>
</html>`;
}

async function renderCardToFile(page, card, outPath) {
    await page.setContent(renderCardHtml(card), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    mkdirSync(path.dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
    console.log(`✓ ${path.relative(REPO_ROOT, outPath)}`);
}

async function main() {
    const tools = getToolDefinitions();
    const manifest = loadManifest();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

    for (const tool of tools) {
        await renderCardToFile(
            page,
            { title: tool.title, description: tool.indexDescription, icon: tool.icon, status: tool.status },
            path.join(REPO_ROOT, tool.sourceRoot, 'images', 'featured.png')
        );
    }

    // Landing-page social card — referenced by rootPage.image and copied to the
    // site root as a committed root asset. The local filename is the basename of
    // the configured image URL (e.g. og-home.png).
    const homeImageFilename = path.posix.basename(new URL(manifest.rootPage.imageUrl).pathname);
    await renderCardToFile(
        page,
        {
            title: manifest.rootPage.title,
            description: manifest.rootPage.description,
            icon: 'wrench',
            status: 'live'
        },
        path.join(REPO_ROOT, homeImageFilename)
    );

    await browser.close();
    console.log(`\nGenerated ${tools.length + 1} OG images (${WIDTH}x${HEIGHT}).`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
