/**
 * The result header sticks *below* the sticky options strip, so its `top`
 * offset has to equal the strip's height. That height was hard-coded per
 * breakpoint and drifted badly as the strip gained controls (68px declared vs
 * 80px actual on desktop, 118px vs ~264px on a phone), which pinned the header
 * underneath the strip and hid it entirely on narrow screens.
 *
 * Measure it instead: the CSS values stay as no-JS fallbacks, and this writes
 * the real height into `--diffc-options-height` as an inline style, which wins
 * over the media-query declarations.
 */
export const OPTIONS_HEIGHT_VAR = '--diffc-options-height';

export function trackOptionsHeight(
  strip: HTMLElement | null,
  target: HTMLElement | null
): () => void {
  if (!strip || !target) return () => {};

  const apply = () => {
    const height = strip.getBoundingClientRect().height;
    // A hidden or not-yet-laid-out strip measures 0; keep the CSS fallback.
    if (height > 0) {
      target.style.setProperty(OPTIONS_HEIGHT_VAR, `${Math.round(height)}px`);
    }
  };

  apply();

  if (typeof ResizeObserver === 'undefined') {
    // Older browsers (and jsdom): reflow on viewport resize only. The strip
    // reflows for content changes too, but those are rare here.
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }

  const observer = new ResizeObserver(apply);
  observer.observe(strip);
  return () => observer.disconnect();
}
