import { describe, expect, it } from 'vitest';
import { HOLD_MS, TAP_SLOP, classifyTouch } from '../src/ui/gestures';
import { uiScaleFor } from '../src/ui/layout';

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
