// Vek planning: each enemy searches every reachable tile and attack option,
// simulates the outcome with the real effect engine and picks the most damaging
// plan. Attacks are queued (telegraphed) and resolve after the player's turn.

import { DIRS, DX, DY, type BattleState, type Dir, type Unit } from '../types';
import { UNITS } from '../data/units';
import type { WeaponDef } from '../data/weapons';
import { cloneBattle, dirTo, idx, inb, ix, iy, rnd } from '../util';
import { aliveMechs, liveAt, reachable, refreshWebs, unitById } from './board';
import { effectsFor, resolveWeapon, targetsFor } from './attacks';
import { applyEffects, enterTile, previewCtx, type Ctx } from './effects';

interface Candidate {
  score: number;
  path: number[];
  target: number;
}

function aiTargets(s: BattleState, e: Unit, w: WeaponDef): number[] {
  switch (w.kind) {
    case 'projectile':
    case 'laser':
    case 'charge':
    case 'pull':
    case 'melee': {
      const out: number[] = [];
      for (const d of DIRS) {
        const x = e.x + DX[d];
        const y = e.y + DY[d];
        if (inb(x, y)) out.push(idx(x, y));
      }
      return out;
    }
    default:
      return targetsFor(s, e, w);
  }
}

function nearestTargetDist(s: BattleState, x: number, y: number): number {
  let best = 16;
  for (let i = 0; i < 64; i++) {
    if (s.tiles[i].t !== 'building') continue;
    best = Math.min(best, Math.abs(ix(i) - x) + Math.abs(iy(i) - y));
  }
  for (const m of s.units) {
    if (m.dead || m.team === 'enemy' || m.x < 0) continue;
    best = Math.min(best, Math.abs(m.x - x) + Math.abs(m.y - y) + 1);
  }
  return best;
}

/**
 * Simulates the attack and returns how much the Hive gains from it. `grid` scales how
 * much this Vek cares about buildings this turn (some Vek hunt mechs instead).
 */
function scoreAttack(s: BattleState, e: Unit, w: WeaponDef, tx: number, ty: number, claimed: Map<number, number>, grid: number): number {
  const eff = effectsFor(s, e, w, tx, ty);
  if (!eff.length) return -3;
  const sim = cloneBattle(s);
  applyEffects(sim, eff, previewCtx(e.id));
  let sc = 0;
  for (let i = 0; i < 64; i++) {
    const a = s.tiles[i];
    if (a.t !== 'building') continue;
    const b = sim.tiles[i];
    const lost = a.hp - (b.t === 'building' ? b.hp : 0);
    if (lost <= 0 && !(a.shield && !b.shield)) continue;
    const claim = claimed.get(i) ?? 0;
    const value = (lost * 8 + (a.obj ? 5 : 0) + (a.shield && !b.shield ? 3 : 0)) * grid;
    sc += claim > 0 ? value * 0.3 : value;
  }
  for (const u of s.units) {
    if (u.dead || u.x < 0) continue;
    const v = unitById(sim, u.id);
    const died = !v || v.dead || v.hp <= 0;
    const lost = died ? u.hp : u.hp - v.hp;
    if (u.team === 'enemy') {
      sc -= lost * 5 + (died ? 8 : 0);
    } else {
      const mult = UNITS[u.def].kind === 'npc' ? 2 : 1;
      const claim = claimed.get(1000 + u.id) ?? 0;
      let value = (lost * 5 + (died ? 7 : 0)) * mult;
      if (v && !died && v.fire && !u.fire) value += 2;
      if (v && !died && v.acid && !u.acid) value += 1;
      sc += claim > 0 ? value * 0.5 : value;
    }
  }
  if (s.stats.pod === 'landed' && sim.stats.pod === 'destroyed') sc += 5;
  return sc;
}

function positionScore(s: BattleState, e: Unit, ti: number): number {
  const t = s.tiles[ti];
  let p = 0;
  if (t.fire && !e.fireImmune) p -= 6;
  if (t.acid && !e.flying) p -= 3;
  if (t.smoke > 0) p -= 40;
  if (t.hazard) p -= 14;
  if (t.spawn) p -= 4;
  if (t.pod) p += 2;
  if ((t.t === 'water' || t.t === 'lava') && !e.flying) p -= 12;
  p -= nearestTargetDist(s, ix(ti), iy(ti)) * 0.35;
  return p;
}

function searchBest(s: BattleState, e: Unit, w: WeaponDef, claimed: Map<number, number>, grid: number): Candidate {
  const reach = reachable(s, e);
  const ox = e.x;
  const oy = e.y;
  const start = idx(ox, oy);
  let best: Candidate = { score: -Infinity, path: [start], target: -1 };
  for (const [ti, path] of reach) {
    const pos = positionScore(s, e, ti);
    e.x = ix(ti);
    e.y = iy(ti);
    const targets = aiTargets(s, e, w);
    for (const tt of targets) {
      const sc = scoreAttack(s, e, w, ix(tt), iy(tt), claimed, grid) + pos + rnd(s) * 2.5;
      if (sc > best.score) best = { score: sc, path, target: tt };
    }
    if (!targets.length) {
      const sc = pos - 4 + rnd(s);
      if (sc > best.score) best = { score: sc, path, target: -1 };
    }
  }
  e.x = ox;
  e.y = oy;
  return best;
}

function moveAlong(s: BattleState, e: Unit, path: number[], ctx: Ctx): void {
  if (path.length <= 1) return;
  const last = path[path.length - 1];
  const fx = e.x;
  const fy = e.y;
  e.x = ix(last);
  e.y = iy(last);
  const d = e.x - e.y - (fx - fy);
  if (d) e.face = d > 0 ? 1 : -1;
  ctx.rec({ e: 'move', id: e.id, path });
  enterTile(s, e, ctx);
}

function psionMove(s: BattleState, e: Unit, ctx: Ctx): void {
  const reach = reachable(s, e);
  const mechs = aliveMechs(s);
  let best = -Infinity;
  let bestPath = [idx(e.x, e.y)];
  for (const [ti, path] of reach) {
    const x = ix(ti);
    const y = iy(ti);
    let near = 9;
    for (const m of mechs) if (m.x >= 0) near = Math.min(near, Math.abs(m.x - x) + Math.abs(m.y - y));
    const t = s.tiles[ti];
    let sc = Math.min(near, 4) * 2 + rnd(s) * 1.5;
    if (t.hazard) sc -= 14;
    if (t.fire) sc -= 6;
    if (t.spawn) sc -= 3;
    if (sc > best) {
      best = sc;
      bestPath = path;
    }
  }
  moveAlong(s, e, bestPath, ctx);
}

/** The Vek move and queue their attacks for the coming turn. */
export function planEnemies(s: BattleState, ctx: Ctx): void {
  const claimed = new Map<number, number>();
  let order = 1;
  const enemies = s.units.filter((u) => u.team === 'enemy' && !u.dead).sort((a, b) => a.id - b.id);
  for (const e of enemies) {
    if (!s.units.includes(e) || e.dead) continue;
    e.plan = null;
    const def = UNITS[e.def];
    if (def.egg || e.frozen) continue;
    const weaponId = def.weapon ?? 'none';
    if (weaponId === 'e_explode') {
      e.plan = { w: weaponId, dir: 0, dist: 0, order: order++ };
      ctx.rec({ e: 'plan', id: e.id });
      continue;
    }
    if (weaponId === 'none') {
      psionMove(s, e, ctx);
      continue;
    }
    const w = resolveWeapon(weaponId, e);
    // temperament: most Vek go for the grid, but roughly a third of them hunt mechs this turn
    const grid = e.boss ? 1 : rnd(s) < 0.33 ? 0.35 : 1;
    const best = searchBest(s, e, w, claimed, grid);
    moveAlong(s, e, best.path, ctx);
    if (!s.units.includes(e) || e.dead) continue;
    if (best.target < 0) continue;
    const tx = ix(best.target);
    const ty = iy(best.target);
    const dir = dirTo(e.x, e.y, tx, ty);
    if (dir === -1) continue;
    const dist = Math.abs(tx - e.x) + Math.abs(ty - e.y);
    e.plan = { w: weaponId, dir: dir as Dir, dist, order: order++ };
    const fd = tx - ty - (e.x - e.y);
    if (fd) e.face = fd > 0 ? 1 : -1;
    // remember what this attack will hit so later Vek spread their attacks out
    const sim = cloneBattle(s);
    applyEffects(sim, effectsFor(s, e, w, tx, ty), previewCtx(e.id));
    for (let i = 0; i < 64; i++) {
      if (s.tiles[i].t === 'building' && (sim.tiles[i].t !== 'building' || sim.tiles[i].hp < s.tiles[i].hp)) {
        claimed.set(i, (claimed.get(i) ?? 0) + 1);
      }
    }
    for (const u of s.units) {
      if (u.team === 'enemy' || u.dead) continue;
      const v = unitById(sim, u.id);
      if (!v || v.hp < u.hp) claimed.set(1000 + u.id, 1);
    }
    if (w.web) {
      const victim = liveAt(s, e.x + DX[dir], e.y + DY[dir]);
      if (victim && victim.team !== 'enemy' && !victim.smokeImmune && !victim.stable) {
        victim.webbedBy = e.id;
        ctx.rec({ e: 'status', x: victim.x, y: victim.y, what: 'web', id: victim.id });
      }
    }
    ctx.rec({ e: 'plan', id: e.id });
  }
  refreshWebs(s);
}
