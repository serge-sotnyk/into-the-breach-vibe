import { BW, BH, DX, DY, type Dir, type BattleState } from './types';

/** Stateful mulberry32: the generator state lives on the owning object so it survives cloning and saving. */
export function rnd(h: { rng: number }): number {
  let t = (h.rng = (h.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rint(h: { rng: number }, n: number): number {
  return Math.floor(rnd(h) * n);
}

export function pick<T>(h: { rng: number }, arr: readonly T[]): T {
  return arr[Math.floor(rnd(h) * arr.length)];
}

export function shuffle<T>(h: { rng: number }, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(h) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function weighted<T>(h: { rng: number }, items: readonly T[], weight: (t: T) => number): T | undefined {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return undefined;
  let r = rnd(h) * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export const idx = (x: number, y: number): number => y * BW + x;
export const ix = (i: number): number => i % BW;
export const iy = (i: number): number => Math.floor(i / BW);
export const inb = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < BW && y < BH;
export const manhattan = (ax: number, ay: number, bx: number, by: number): number => Math.abs(ax - bx) + Math.abs(ay - by);

export function dirTo(fx: number, fy: number, tx: number, ty: number): Dir | -1 {
  if (fx === tx && fy === ty) return -1;
  if (fx === tx) return ty < fy ? 0 : 2;
  if (fy === ty) return tx > fx ? 1 : 3;
  return -1;
}

export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;
export const step = (x: number, y: number, d: Dir, n = 1): [number, number] => [x + DX[d] * n, y + DY[d] * n];

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fast structural clone of a battle (hot path for AI search and previews). */
export function cloneBattle(s: BattleState): BattleState {
  return {
    ...s,
    tiles: s.tiles.map((t) => ({ ...t })),
    units: s.units.map((u) => ({
      ...u,
      weapons: u.weapons.map((w) => ({ ...w, up: w.up.slice() })),
      plan: u.plan ? { ...u.plan } : null,
    })),
    enemyPool: s.enemyPool,
    spawnPlan: s.spawnPlan,
    objectives: s.objectives,
    deployZone: s.deployZone,
    stats: { ...s.stats },
  };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
