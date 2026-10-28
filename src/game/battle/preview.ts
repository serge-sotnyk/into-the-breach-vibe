// Outcome previews: simulate an action on a cloned battle and summarise exactly
// what will happen (damage, pushes, deaths, grid loss). Used for the player's
// targeting preview and for drawing every telegraphed Vek attack.

import type { AnimEv, BattleState, Effect, Unit } from '../types';
import { cloneBattle, idx, inb, ix, iy } from '../util';
import { inSmoke, submerged, unitById } from './board';
import { effectsFor, enemyEffects, resolveWeapon } from './attacks';
import { applyEffects, previewCtx } from './effects';
import { environmentPhase } from './hazards';

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
  return diffOutcome(s, sim, effects, events);
}

function diffOutcome(s: BattleState, sim: BattleState, effects: Effect[], events: AnimEv[]): Outcome {
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
  return simulate(s, effects, u.id);
}

export interface Threat {
  /** attacking Vek, or 0 for the environment step (fire, psion, hazards) */
  id: number;
  order: number;
  cancel: '' | 'frozen' | 'smoke' | 'water' | 'edge' | 'dead';
  outcome: Outcome;
}

/**
 * The whole coming enemy phase, simulated in resolution order: the environment step
 * first, then every queued Vek attack applied on top of the previous ones. Each
 * outcome is relative to the board left by the steps before it, so shields used up,
 * Vek thawed or killed first, and repeated hits on one target are all accounted for.
 */
export function computeThreats(s: BattleState): Threat[] {
  const out: Threat[] = [];
  let cur = s;
  if (s.phase === 'player') {
    const env = cloneBattle(s);
    const events: AnimEv[] = [];
    environmentPhase(env, previewCtx(0, events));
    const o = diffOutcome(s, env, [], events);
    if (o.hpAfter.size || o.buildingLoss.size) out.push({ id: 0, order: 0, cancel: '', outcome: o });
    cur = env;
  }
  const attackers = s.units.filter((u) => u.team === 'enemy' && !u.dead && u.plan).sort((a, b) => a.plan!.order - b.plan!.order);
  for (const e0 of attackers) {
    const e = unitById(cur, e0.id);
    let cancel: Threat['cancel'] = '';
    if (!e || e.dead || !e.plan) cancel = 'dead';
    else if (e.frozen) cancel = 'frozen';
    else if (inSmoke(cur, e)) cancel = 'smoke';
    else if (submerged(cur, e)) cancel = 'water';
    const effects = !cancel && e ? enemyEffects(cur, e) : [];
    if (!cancel && !effects.length) cancel = 'edge';
    const o = simulate(cur, effects, e0.id);
    out.push({ id: e0.id, order: e0.plan!.order, cancel, outcome: o });
    cur = o.sim;
  }
  return out;
}
