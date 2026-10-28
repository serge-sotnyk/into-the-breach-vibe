import { describe, expect, it } from 'vitest';
import { HOLD_MS, TAP_SLOP, classifyTouch } from '../src/ui/gestures';
import { uiScaleFor } from '../src/ui/layout';
import { MAX_ZOOM, clampCamera, zoomAround } from '../src/render/camera';

describe('touch gestures', () => {
  it('a quick touch that stays put is a tap', () => {
    expect(classifyTouch(3, 4, 120, true)).toBe('tap');
    expect(classifyTouch(0, 0, 120, false)).toBe('pending');
  });

  it('holding still long enough is a long press, lifted or not', () => {
    expect(classifyTouch(2, 2, HOLD_MS, false)).toBe('hold');
    expect(classifyTouch(2, 2, HOLD_MS + 200, true)).toBe('hold');
  });

  it('moving past the slop is a drag, however short', () => {
    expect(classifyTouch(TAP_SLOP + 1, 0, 50, true)).toBe('drag');
    expect(classifyTouch(8, 8, 900, false)).toBe('drag');
  });
});

describe('interface scale', () => {
  it('stays 1 up to 1080p and on small screens', () => {
    expect(uiScaleFor(1920, 1080)).toBe(1);
    expect(uiScaleFor(1366, 768)).toBe(1);
    expect(uiScaleFor(844, 390)).toBe(1);
  });

  it('grows with the smaller side ratio on big screens, up to 2', () => {
    expect(uiScaleFor(2560, 1440)).toBe(1.33);
    expect(uiScaleFor(3840, 2160)).toBe(2);
    expect(uiScaleFor(7680, 4320)).toBe(2);
    // an ultrawide grows only as much as its height allows
    expect(uiScaleFor(3440, 1440)).toBe(1.33);
  });
});

describe('board camera', () => {
  const base = { scale: 0.5, ox: 400, oy: 100 };
  const area = { x0: 80, y0: 50, x1: 700, y1: 300 };

  it('zooming keeps the board point under the fingers in place', () => {
    const cam = zoomAround({ zoom: 1, x: 0, y: 0 }, base, 300, 200, 2);
    expect(cam.zoom).toBe(2);
    // board point under (300, 200) before: ((300-400)/0.5, (200-100)/0.5) = (-200, 200)
    expect(base.ox + cam.x + -200 * base.scale * cam.zoom).toBeCloseTo(300);
    expect(base.oy + cam.y + 200 * base.scale * cam.zoom).toBeCloseTo(200);
  });

  it('zoom stays between 1 and the maximum', () => {
    expect(zoomAround({ zoom: 2, x: 0, y: 0 }, base, 0, 0, 10).zoom).toBe(MAX_ZOOM);
    expect(zoomAround({ zoom: 1.2, x: 0, y: 0 }, base, 0, 0, 0.1).zoom).toBe(1);
  });

  it('at zoom 1 the board is back where it was fitted; zoomed, its centre stays visible', () => {
    expect(clampCamera({ zoom: 1, x: 120, y: -40 }, base, area, [0, 200])).toEqual({ zoom: 1, x: 0, y: 0 });
    const far = clampCamera({ zoom: 2, x: 5000, y: -5000 }, base, area, [0, 200]);
    expect(base.ox + far.x).toBeCloseTo(area.x1);
    expect(base.oy + far.y + 200 * base.scale * 2).toBeCloseTo(area.y0);
  });
});
