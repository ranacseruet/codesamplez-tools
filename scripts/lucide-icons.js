// @ts-check
/**
 * Inlined Lucide icon geometry (lucide-static v1.18.0, ISC). Vendored so the
 * site ships self-contained — no runtime CDN dependency. Regenerate by copying
 * the inner markup of node_modules/lucide-static/icons/<name>.svg.
 */
const LUCIDE_ICON_PATHS = {
  "arrow-right": "<path d=\"M5 12h14\" /> <path d=\"m12 5 7 7-7 7\" />",
  "braces": "<path d=\"M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1\" /> <path d=\"M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1\" />",
  "file-code": "<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" /> <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" /> <path d=\"M10 12.5 8 15l2 2.5\" /> <path d=\"m14 12.5 2 2.5-2 2.5\" />",
  "palette": "<path d=\"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z\" /> <circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\" /> <circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\" /> <circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\" /> <circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />",
  "binary": "<rect x=\"14\" y=\"14\" width=\"4\" height=\"6\" rx=\"2\" /> <rect x=\"6\" y=\"4\" width=\"4\" height=\"6\" rx=\"2\" /> <path d=\"M6 20h4\" /> <path d=\"M14 10h4\" /> <path d=\"M6 14h2v6\" /> <path d=\"M14 4h2v6\" />",
  "key-round": "<path d=\"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z\" /> <circle cx=\"16.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />",
  "file-key": "<path d=\"M14 2v5a1 1 0 0 0 1 1h5\" /> <path d=\"M4 12v6\" /> <path d=\"M4 14h2\" /> <path d=\"M9.65 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v4\" /> <circle cx=\"4\" cy=\"20\" r=\"2\" />",
  "qr-code": "<rect width=\"5\" height=\"5\" x=\"3\" y=\"3\" rx=\"1\" /> <rect width=\"5\" height=\"5\" x=\"16\" y=\"3\" rx=\"1\" /> <rect width=\"5\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\" /> <path d=\"M21 16h-3a2 2 0 0 0-2 2v3\" /> <path d=\"M21 21v.01\" /> <path d=\"M12 7v3a2 2 0 0 1-2 2H7\" /> <path d=\"M3 12h.01\" /> <path d=\"M12 3h.01\" /> <path d=\"M12 16v.01\" /> <path d=\"M16 12h1\" /> <path d=\"M21 12v.01\" /> <path d=\"M12 21v-1\" />",
  "repeat": "<path d=\"m17 2 4 4-4 4\" /> <path d=\"M3 11v-1a4 4 0 0 1 4-4h14\" /> <path d=\"m7 22-4-4 4-4\" /> <path d=\"M21 13v1a4 4 0 0 1-4 4H3\" />",
  "search": "<circle cx=\"11\" cy=\"11\" r=\"8\" /> <path d=\"m21 21-4.3-4.3\" />",
  "git-compare": "<circle cx=\"18\" cy=\"18\" r=\"3\" /> <circle cx=\"6\" cy=\"6\" r=\"3\" /> <path d=\"M13 6h3a2 2 0 0 1 2 2v7\" /> <path d=\"M11 18H8a2 2 0 0 1-2-2V9\" />",
  "case-sensitive": "<path d=\"m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16\" /> <path d=\"M22 9v7\" /> <path d=\"M3.304 13h6.392\" /> <circle cx=\"18.5\" cy=\"12.5\" r=\"3.5\" />",
  "wrench": "<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z\" />"
};

/**
 * Render an inline Lucide-style SVG for the given icon name.
 * @param {string} name
 * @param {string} [className]
 * @returns {string}
 */
function renderInlineIcon(name, className = "cst-icon") {
    const inner = LUCIDE_ICON_PATHS[name] || LUCIDE_ICON_PATHS.wrench;
    return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

module.exports = { renderInlineIcon, LUCIDE_ICON_PATHS };
