import { DIRS, DX, DY, type BattleState, type Tile, type Unit } from '../types';
import { UNITS } from '../data/units';
import { idx, inb, ix, iy } from '../util';

export const tileAt = (s: BattleState, x: number, y: number): Tile => s.tiles[idx(x, y)];

/** Any unit on the tile, including mech wrecks. */
export function unitAt(s: BattleState, x: number, y: number): Unit | undefined {
  for (const u of s.units) if (u.x === x && u.y === y) return u;
  return undefined;
}

/** Living (non-wreck) unit on the tile. */
export function liveAt(s: BattleState, x: number, y: number): Unit | undefined {
  for (const u of s.units) if (!u.dead && u.x === x && u.y === y) return u;
  return undefined;
}

export function unitById(s: BattleState, id: number): Unit | undefined {
  for (const u of s.units) if (u.id === id) return u;
  return undefined;
}

export const isObstacle = (t: Tile): boolean => t.t === 'building' || t.t === 'mountain';

/** Tiles a projectile stops at: obstacles, time pods and any unit (wrecks included). */
export function blocksLine(s: BattleState, x: number, y: number): boolean {
  const t = tileAt(s, x, y);
  return isObstacle(t) || t.pod || !!unitAt(s, x, y);
}

/** Terrain the unit can occupy (ignores other units). */
export function canStand(u: Pick<Unit, 'flying' | 'massive'>, t: Tile): boolean {
  if (isObstacle(t)) return false;
  if (t.t === 'chasm') return u.flying;
  if (t.t === 'water' || t.t === 'lava') return u.flying || u.massive;
  return true;
}

/** Solid ground-like tile where ground units can be spawned or placed safely. */
export function isGroundish(t: Tile): boolean {
  return t.t === 'ground' || t.t === 'rubble' || t.t === 'forest' || t.t === 'sand' || t.t === 'ice';
}

export function isMech(u: Unit): boolean {
  return UNITS[u.def]?.kind === 'mech';
}

export function hostile(a: Unit, b: Unit): boolean {
  if (a.team === b.team) return false;
  return a.team === 'enemy' || b.team === 'enemy';
}

export function friendly(a: Unit, b: Unit): boolean {
  return !hostile(a, b);
}

export function onBoard(u: Unit): boolean {
  return u.x >= 0 && u.y >= 0;
}

export function inSmoke(s: BattleState, u: Unit): boolean {
  return onBoard(u) && tileAt(s, u.x, u.y).smoke > 0 && !u.smokeImmune;
}

/** Non-flying units standing in water are submerged and cannot use weapons. */
export function submerged(s: BattleState, u: Unit): boolean {
  if (!onBoard(u) || u.flying) return false;
  const t = tileAt(s, u.x, u.y).t;
  return t === 'water' || t === 'lava';
}

export function webbed(u: Unit): boolean {
  return u.webbedBy !== 0;
}

/** Drops webs whose owner died, moved away, or got separated from its prey. */
export function refreshWebs(s: BattleState): void {
  for (const u of s.units) {
    if (!u.webbedBy) continue;
    const w = unitById(s, u.webbedBy);
    if (!w || w.dead || u.dead || Math.abs(w.x - u.x) + Math.abs(w.y - u.y) !== 1) u.webbedBy = 0;
  }
}

/** Breadth-first movement range. Returns tile index -> path (including the start tile). */
export function reachable(s: BattleState, u: Unit): Map<number, number[]> {
  const start = idx(u.x, u.y);
  const res = new Map<number, number[]>([[start, [start]]]);
  if (u.move <= 0 || webbed(u) || u.frozen || u.dead) return res;
  const prev = new Map<number, number>();
  const dist = new Map<number, number>([[start, 0]]);
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const d = dist.get(cur)!;
    if (d >= u.move) continue;
    const cx = ix(cur);
    const cy = iy(cur);
    for (const dir of DIRS) {
      const nx = cx + DX[dir];
      const ny = cy + DY[dir];
      if (!inb(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (dist.has(ni)) continue;
      if (!canStand(u, s.tiles[ni])) continue;
      const o = unitAt(s, nx, ny);
      if (o && (o.dead || hostile(u, o))) continue;
      dist.set(ni, d + 1);
      prev.set(ni, cur);
      queue.push(ni);
    }
  }
  for (const i of dist.keys()) {
    if (i === start) continue;
    if (unitAt(s, ix(i), iy(i))) continue;
    const path = [i];
    let c = i;
    while (c !== start) {
      c = prev.get(c)!;
      path.unshift(c);
    }
    res.set(i, path);
  }
  return res;
}

export function aliveMechs(s: BattleState): Unit[] {
  return s.units.filter((u) => isMech(u) && !u.dead);
}

export function aliveEnemies(s: BattleState): Unit[] {
  return s.units.filter((u) => u.team === 'enemy' && !u.dead);
}
