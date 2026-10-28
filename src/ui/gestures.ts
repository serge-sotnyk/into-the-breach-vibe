// Touch gestures. A finger that stays within TAP_SLOP is a tap when lifted quickly and a
// long press once HOLD_MS passes; moving further turns it into a drag.

export const TAP_SLOP = 10;
export const HOLD_MS = 450;

export type Gesture = 'pending' | 'tap' | 'hold' | 'drag';

/** Classifies a touch from how far it moved, how long it lasted and whether it was lifted. */
export function classifyTouch(dx: number, dy: number, ms: number, lifted: boolean): Gesture {
  if (Math.hypot(dx, dy) > TAP_SLOP) return 'drag';
  if (ms >= HOLD_MS) return 'hold';
  return lifted ? 'tap' : 'pending';
}

/** Whether any input is a finger (phones, tablets, touch laptops). */
export function hasTouch(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(any-pointer: coarse)').matches;
}

/** Whether the primary input can hover (mouse, trackpad) rather than only touch. */
export function canHover(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches;
}
