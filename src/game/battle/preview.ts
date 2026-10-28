// Outcome previews: simulate an action on a cloned battle and summarise exactly
// what will happen (damage, pushes, deaths, grid loss). Used for the player's
// targeting preview and for drawing every telegraphed Vek attack.

import type { AnimEv, BattleState, Effect, Unit } from '../types';
import { cloneBattle, idx, inb, ix, iy } from '../util';
import { inSmoke, submerged, unitById } from './board';
import { effectsFor, enemyEffects, resolveWeapon } from './attacks';
import { applyEffects, previewCtx } from './effects';

export interface Outcome {
  effects: Effect[];
  events: AnimEv[];
  sim: BattleState;
  gridLoss: number;
  /** hp after the action for every unit that changed (0 = destroyed) */
  hpAfter: Map<number, number>;
  deaths: Set<number>;
  /** building tile index -> building hp lost */
  buildingLoss: Map<number, number>;
  /** tiles touched by damage/status effects */
  tiles: Set<number>;
}

export function simulate(s: BattleState, effects: Effect[], src: number): Outcome {
  const sim = cloneBattle(s);
  const events: AnimEv[] = [];
  applyEffects(sim, effects, previewCtx(src, events));
  const hpAfter = new Map<number, number>();
  const deaths = new Set<number>();
  for (const u of s.units) {
    if (u.dead) continue;
    const v = unitById(sim, u.id);
    const hp = !v || v.dead ? 0 : v.hp;
    if (hp !== u.hp) hpAfter.set(u.id, Math.max(0, hp));
    if (hp <= 0) deaths.add(u.id);
  }
  const buildingLoss = new Map<number, number>();
  for (let i = 0; i < 64; i++) {
    const a = s.tiles[i];
    if (a.t !== 'building') continue;
    const b = sim.tiles[i];
    const lost = a.hp - (b.t === 'building' ? b.hp : 0);
    if (lost > 0) buildingLoss.set(i, lost);
  }
  const tiles = new Set<number>();
  for (const e of effects) {
    if (e.k === 'dmg' || e.k === 'shield' || e.k === 'spawnUnit') if (inb(e.x, e.y)) tiles.add(idx(e.x, e.y));
  }
  return { effects, events, sim, gridLoss: s.grid - sim.grid, hpAfter, deaths, buildingLoss, tiles };
}

export function previewAttack(s: BattleState, u: Unit, slot: number, ti: number): Outcome | null {
  const inst = u.weapons[slot];
  if (!inst) return null;
  const w = resolveWeapon(inst, u);
  const effects = effectsFor(s, u, w, ix(ti), iy(ti));
  const out = simulate(s, effects, u.id);
  // self-inflicted status (e.g. Cryo Lance) also counts as a touched tile
  return out;
}

export interface Threat {
  id: number;
  order: number;
  cancel: '' | 'frozen' | 'smoke' | 'water' | 'edge';
  outcome: Outcome;
}

/** Every queued Vek attack, evaluated independently against the current board. */
export function computeThreats(s: BattleState): Threat[] {
  const out: Threat[] = [];
  for (const e of s.units) {
    if (e.team !== 'enemy' || e.dead || !e.plan) continue;
    const effects = enemyEffects(s, e);
    const cancel: Threat['cancel'] = e.frozen ? 'frozen' : inSmoke(s, e) ? 'smoke' : submerged(s, e) ? 'water' : !effects.length ? 'edge' : '';
    out.push({ id: e.id, order: e.plan.order, cancel, outcome: simulate(s, cancel ? [] : effects, e.id) });
  }
  return out.sort((a, b) => a.order - b.order);
}
