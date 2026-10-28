// A greedy auto-pilot: tries every move + weapon + target for each unit and keeps
// the result that best protects the grid. Used by headless tests and debug mode.

import type { BattleState, Step, Unit } from '../types';
import { cloneBattle, idx } from '../util';
import { reachable, unitById } from './board';
import { resolveWeapon, targetsFor } from './attacks';
import { computeThreats } from './preview';
import { canMove, doAttack, doMove, doRepair, endPlayerTurn, repairBlock, weaponBlock, withoutRecording } from './turn';

function evaluate(s: BattleState): number {
  if (s.phase === 'lost') return -1e6;
  // predicted hp at the end of the coming enemy phase (threats are cumulative)
  const final = new Map<number, number>();
  let loss = 0;
  for (const t of computeThreats(s)) {
    for (const v of t.outcome.buildingLoss.values()) loss += v;
    for (const [id, hp] of t.outcome.hpAfter) final.set(id, Math.min(final.get(id) ?? Infinity, hp));
  }
  let sc = s.grid * 30 - loss * 22;
  for (const u of s.units) {
    const hp = Math.max(0, Math.min(u.hp, final.get(u.id) ?? u.hp));
    if (u.team === 'enemy') {
      if (!u.dead && hp > 0) sc -= 6 + hp * 3;
    } else if (u.slot >= 0) {
      sc += u.dead ? -25 : u.hp * 2 - (u.hp - hp) * 3;
    } else if (!u.dead) {
      sc += 10 + u.hp * 3 - (u.hp - hp) * 8;
    }
  }
  for (const tl of s.tiles) if (tl.spawn) sc -= 2;
  return sc;
}

interface Choice {
  score: number;
  move: number;
  slot: number;
  target: number;
}

function bestFor(s: BattleState, u: Unit): Choice {
  const here = idx(u.x, u.y);
  let best: Choice = { score: evaluate(s), move: here, slot: -1, target: -1 };
  const moves = canMove(s, u) ? [...reachable(s, u).keys()] : [here];
  for (const mv of moves) {
    const base = cloneBattle(s);
    const bu = unitById(base, u.id)!;
    if (mv !== here) doMove(base, bu, mv);
    if (bu.dead || base.phase === 'lost') continue;
    const moved = evaluate(base);
    if (moved > best.score) best = { score: moved, move: mv, slot: -1, target: -1 };
    bu.weapons.forEach((inst, slot) => {
      if (weaponBlock(base, bu, slot)) return;
      for (const t of targetsFor(base, bu, resolveWeapon(inst, bu))) {
        const sim = cloneBattle(base);
        doAttack(sim, unitById(sim, u.id)!, slot, t);
        const sc = evaluate(sim);
        if (sc > best.score) best = { score: sc, move: mv, slot, target: t };
      }
    });
    if (!repairBlock(base, bu)) {
      const sim = cloneBattle(base);
      doRepair(sim, unitById(sim, u.id)!);
      const sc = evaluate(sim) + 0.5;
      if (sc > best.score) best = { score: sc, move: mv, slot: -2, target: -1 };
    }
  }
  return best;
}

/** Plays the whole player turn for the controllable units, then ends the turn. */
export function autoPlayTurn(s: BattleState, endTurn = true): void {
  withoutRecording(() => {
    for (const u of s.units.filter((x) => x.team === 'player' && x.controllable && !x.dead && x.x >= 0)) {
      if (s.phase !== 'player' || u.dead) continue;
      const c = bestFor(s, u);
      if (c.move !== idx(u.x, u.y)) doMove(s, u, c.move);
      if (u.dead || s.phase !== 'player') continue;
      if (c.slot >= 0) doAttack(s, u, c.slot, c.target);
      else if (c.slot === -2) doRepair(s, u);
    }
    if (endTurn && s.phase === 'player') endPlayerTurn(s);
  });
}

/** Deploys mechs on the first free deployment tiles (headless use). */
export function autoDeploy(s: BattleState): void {
  const free = s.deployZone.filter((i) => !s.units.some((u) => idx(u.x, u.y) === i && u.x >= 0));
  for (const u of s.units.filter((x) => x.slot >= 0 && x.x < 0)) {
    const i = free.shift();
    if (i === undefined) break;
    u.x = i % 8;
    u.y = Math.floor(i / 8);
  }
}

/** One recorded auto-pilot action (or the end of the turn), for animated demos and debug play. */
export function autoAct(s: BattleState): Step[] {
  if (s.phase !== 'player') return [];
  const u = s.units.find((x) => x.team === 'player' && x.controllable && !x.dead && x.x >= 0 && !x.acted);
  if (!u) return endPlayerTurn(s);
  const c = withoutRecording(() => bestFor(s, u));
  const steps: Step[] = [];
  if (c.move !== idx(u.x, u.y)) steps.push(...doMove(s, u, c.move));
  if (!u.dead && s.phase === 'player') {
    if (c.slot >= 0) steps.push(...doAttack(s, u, c.slot, c.target));
    else if (c.slot === -2) steps.push(...doRepair(s, u));
  }
  u.acted = true;
  return steps;
}
