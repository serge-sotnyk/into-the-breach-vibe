// Isometric projection. Tile (x, y): +x runs to the lower right, +y to the lower left.

export const HW = 56; // tile half width (px, logical)
export const HH = 28; // tile half height
export const SIDE = 9; // visible thickness of raised tiles
export const BASE = 30; // island cliff under the board edge

/** Screen offset of the tile's center relative to the board origin (top vertex of tile 0,0). */
export function tileCenter(x: number, y: number): [number, number] {
  return [(x - y) * HW, (x + y) * HH + HH];
}

/** Fractional tile-space offset (fx, fy) -> screen offset. */
export function isoOff(fx: number, fy: number): [number, number] {
  return [(fx - fy) * HW, (fx + fy) * HH];
}

export function screenToTile(lx: number, ly: number): [number, number] | null {
  const a = lx / HW;
  const b = ly / HH;
  const x = Math.floor((a + b) / 2);
  const y = Math.floor((b - a) / 2);
  if (x < 0 || y < 0 || x > 7 || y > 7) return null;
  return [x, y];
}

/** How far a terrain surface sits below ground level. */
export function surfaceDrop(t: string): number {
  switch (t) {
    case 'water':
      return 10;
    case 'lava':
      return 8;
    case 'chasm':
      return 40;
    default:
      return 0;
  }
}
