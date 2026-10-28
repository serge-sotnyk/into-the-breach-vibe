// Screen-size helpers shared by the app shell and the screens.

/** Interface scale: 1 up to 1080p, growing with the screen to 2 at 4K. */
export function uiScaleFor(width: number, height: number): number {
  const s = Math.min(width / 1920, height / 1080);
  return Math.round(Math.min(2, Math.max(1, s)) * 100) / 100;
}

/** A CSS length variable on :root, in unscaled CSS pixels. */
export function cssPx(name: string): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}
