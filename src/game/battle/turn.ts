// Turn structure and player actions. Every function mutates the battle in place and
// returns the animation steps (event + snapshot) the renderer replays.

import { DIRS, DX, DY, type AnimEv, type BattleState, type Step, type Unit } from '../types';
import { UNITS } from '../data/units';
import { cloneBattle, idx, inb, ix, iy, pick, rnd, weighted } from '../util';
import {
  friendly,
  inSmoke,
  isGroundish,
  isMech,
  liveAt,
  reachable,
  refreshWebs,
  submerged,
  tileAt,
  unitAt,
  webbed,
} from './board';
import { effectsFor, enemyEffects, planTarget, resolveWeapon, targetsFor } from './attacks';
import { applyEffects, damageUnit, enterTile, makeUnit, psionActive, type Ctx } from './effects';
import { planEnemies } from './ai';
import { applyHazards, markHazards } from './hazards';

/** Phase is mutated by nested calls, so read it through a function to defeat narrowing. */
export const isLost = (s: BattleState): boolean => s.phase === 'lost';

let recording = true;

/** Runs `fn` with animation snapshots disabled (headless simulation). */
export function withoutRecording<T>(fn: () => T): T {
  const prev = recording;
  recording = false;
  try {
    return fn();
  } finally {
    recording = prev;
  }
}

export function execCtx(s: BattleState, steps: Step[], src: number): Ctx {
  return {
    preview: false,
    src,
    rec: recording ? (ev: AnimEv) => steps.push({ ev, snap: cloneBattle(s) }) : () => undefined,
  };
}

// ------------------------------------------------------------------ deployment

export function placeMech(s: BattleState, u: Unit, ti: number): boolean {
  if (s.phase !== 'deploy' || !s.deployZone.includes(ti)) return false;
  const x = ix(ti);
  const y = iy(ti);
  const occ = unitAt(s, x, y);
  if (occ && occ !== u) {
    if (!isMech(occ) || u.x < 0) return false;
    // swap two deployed mechs
    occ.x = u.x;
    occ.y = u.y;
  }
  u.x = x;
  u.y = y;
  u.face = 1;
  s.version++;
  return true;
}

export function undeployed(s: BattleState): Unit[] {
  return s.units.filter((u) => isMech(u) && !u.dead && u.x < 0);
}

export function startBattle(s: BattleState): Step[] {
  const steps: Step[] = [];
  const ctx = execCtx(s, steps, 0);
  s.phase = 'enemy';
  s.turn = 1;
  const boss = s.units.find((u) => u.boss);
  ctx.rec({ e: 'banner', text: boss ? 'HIVE LEADER SIGHTED' : 'VEK EMERGING', sub: boss ? `${UNITS[boss.def].name} · ${s.title}` : s.title, tone: 'enemy' });
  planPhase(s, ctx);
  beginPlayerTurn(s, ctx);
  return steps;
}

function beginPlayerTurn(s: BattleState, ctx: Ctx): void {
  s.phase = 'player';
  for (const u of s.units) {
    if (u.team !== 'player') continue;
    u.moved = false;
    u.acted = false;
  }
  s.version++;
  ctx.rec({ e: 'banner', text: 'YOUR TURN', sub: s.turn === s.maxTurns ? 'Final turn — hold the line!' : `Turn ${s.turn} of ${s.maxTurns}`, tone: 'player' });
}

// ------------------------------------------------------------------ enemy phases

function transformUnit(u: Unit, def: string): void {
  const d = UNITS[def];
  u.def = def;
  u.hp = d.hp;
  u.maxHp = d.hp;
  u.move = d.move;
  u.stable = !!d.stable;
  u.flying = !!d.flying;
  u.hatch = 0;
}

function enemyCount(s: BattleState): number {
  return s.units.filter((u) => u.team === 'enemy' && !u.dead && !UNITS[u.def].egg && !u.def.startsWith('blob')).length;
}

export function pickEnemyType(s: BattleState): string {
  const psionAround =
    s.units.some((u) => !u.dead && UNITS[u.def].psion) || s.tiles.some((t) => t.spawn.startsWith('psion'));
  if (!psionAround && rnd(s) < s.psionChance) return pick(s, ['psion_shell', 'psion_regen', 'psion_blast']);
  const base = pick(s, s.enemyPool);
  if (rnd(s) < s.alphaChance && UNITS[`${base}_a`]) return `${base}_a`;
  return base;
}

function placeSpawns(s: BattleState, ctx: Ctx): void {
  const pending = s.tiles.filter((t) => t.spawn).length;
  let n = s.spawnPlan[Math.min(s.turn - 1, s.spawnPlan.length - 1)] ?? 1;
  n = Math.min(n, Math.max(0, s.maxEnemies - enemyCount(s) - pending));
  const cand: number[] = [];
  for (let i = 0; i < 64; i++) {
    const t = s.tiles[i];
    if (!isGroundish(t) || t.spawn || t.hazard || t.pod || t.acid) continue;
    if (unitAt(s, ix(i), iy(i))) continue;
    cand.push(i);
  }
  for (let k = 0; k < n && cand.length; k++) {
    const choice = weighted(s, cand, (i) => {
      const y = iy(i);
      let w = y <= 2 ? 6 : y <= 4 ? 2 : 0.4;
      for (const d of DIRS) {
        const nx = ix(i) + DX[d];
        const ny = y + DY[d];
        if (inb(nx, ny) && s.tiles[idx(nx, ny)].spawn) w *= 0.3;
      }
      return w;
    });
    if (choice === undefined) break;
    cand.splice(cand.indexOf(choice), 1);
    s.tiles[choice].spawn = pickEnemyType(s);
    ctx.rec({ e: 'tick', x: ix(choice), y: iy(choice), what: 'spawnMark' });
  }
}

function landPod(s: BattleState, ctx: Ctx): void {
  const cand: number[] = [];
  for (let i = 0; i < 64; i++) {
    const t = s.tiles[i];
    if (!isGroundish(t) || t.spawn || t.hazard || t.fire || t.acid || unitAt(s, ix(i), iy(i))) continue;
    if (iy(i) < 2 || iy(i) > 6) continue;
    cand.push(i);
  }
  if (!cand.length) return;
  const i = pick(s, cand);
  s.tiles[i].pod = true;
  s.stats.pod = 'landed';
  ctx.rec({ e: 'pod', x: ix(i), y: iy(i), what: 'land' });
}

/** Start of a round: psion effects, eggs, the Vek move and target, new spawns and hazards are marked. */
function planPhase(s: BattleState, ctx: Ctx): void {
  if (psionActive(s, 'regen')) {
    for (const u of s.units) {
      if (u.team !== 'enemy' || u.dead || UNITS[u.def].psion || u.hp >= u.maxHp) continue;
      u.hp++;
      ctx.rec({ e: 'heal', x: u.x, y: u.y, amt: 1 });
    }
  }
  for (const u of s.units.slice()) {
    if (!UNITS[u.def].egg || u.dead) continue;
    if (u.hatch > 0) {
      u.hatch--;
      continue;
    }
    transformUnit(u, 'hatchling');
    ctx.rec({ e: 'spawn', id: u.id, x: u.x, y: u.y });
  }
  for (const q of s.units.slice()) {
    if (q.def !== 'boss_queen' || q.dead || enemyCount(s) >= s.maxEnemies + 1) continue;
    const spots = DIRS.map((d) => [q.x + DX[d], q.y + DY[d]] as const).filter(
      ([x, y]) => inb(x, y) && isGroundish(tileAt(s, x, y)) && !unitAt(s, x, y) && !tileAt(s, x, y).spawn,
    );
    if (!spots.length) continue;
    const [x, y] = pick(s, spots);
    const egg = makeUnit(s, 'egg', x, y);
    ctx.rec({ e: 'spawn', id: egg.id, x, y });
  }
  if (s.podTurn === s.turn && s.stats.pod === 'none') landPod(s, ctx);
  planEnemies(s, ctx);
  if (s.turn < s.maxTurns) placeSpawns(s, ctx);
  markHazards(s, ctx);
  s.version++;
}

function emerge(s: BattleState, ctx: Ctx): void {
  for (let i = 0; i < 64; i++) {
    const t = s.tiles[i];
    if (!t.spawn) continue;
    const def = t.spawn;
    t.spawn = '';
    const x = ix(i);
    const y = iy(i);
    const occ = unitAt(s, x, y);
    if (occ) {
      s.stats.blocked++;
      ctx.rec({ e: 'spawnBlocked', x, y });
      if (!occ.dead) damageUnit(s, occ, 1, { bump: true, how: 'crush' }, ctx);
      if (isLost(s)) return;
      continue;
    }
    const u = makeUnit(s, def, x, y);
    ctx.rec({ e: 'spawn', id: u.id, x, y });
    enterTile(s, u, ctx);
  }
}

export function endPlayerTurn(s: BattleState): Step[] {
  const steps: Step[] = [];
  const env = execCtx(s, steps, 0);
  s.phase = 'enemy';
  env.rec({ e: 'banner', text: 'ENEMY TURN', sub: s.turn === s.maxTurns ? 'Last attack before the Vek retreat' : '', tone: 'enemy' });

  // 1. fire burns every unit standing in it
  for (const u of s.units.slice()) {
    if (u.dead || !u.fire || u.fireImmune || u.x < 0 || !s.units.includes(u)) continue;
    env.rec({ e: 'tick', x: u.x, y: u.y, what: 'burn' });
    damageUnit(s, u, 1, { pure: true, how: 'burn' }, env);
    if (isLost(s)) return finish(s, steps, env);
  }
  // 2. tyrant psion lashes the squad
  if (psionActive(s, 'tyrant')) {
    for (const u of s.units.slice()) {
      if (!isMech(u) || u.dead || u.x < 0) continue;
      env.rec({ e: 'tick', x: u.x, y: u.y, what: 'psychic' });
      damageUnit(s, u, 1, { pure: true, how: 'psychic' }, env);
      if (isLost(s)) return finish(s, steps, env);
    }
  }
  // 3. environment
  applyHazards(s, env);
  if (isLost(s)) return finish(s, steps, env);

  // 4. queued Vek attacks, in order
  const attackers = s.units.filter((u) => u.team === 'enemy' && u.plan).sort((a, b) => a.plan!.order - b.plan!.order);
  for (const e of attackers) {
    if (!s.units.includes(e) || e.dead || !e.plan) continue;
    const cancel = e.frozen ? 'frozen' : inSmoke(s, e) ? 'smoke' : submerged(s, e) ? 'water' : '';
    if (cancel) {
      env.rec({ e: 'tick', x: e.x, y: e.y, what: `cancel-${cancel}` });
      e.plan = null;
      continue;
    }
    const ctx = execCtx(s, steps, e.id);
    ctx.rec({ e: 'plan', id: e.id });
    const eff = enemyEffects(s, e);
    e.plan = null;
    if (!eff.length) {
      env.rec({ e: 'tick', x: e.x, y: e.y, what: 'cancel-edge' });
      continue;
    }
    applyEffects(s, eff, ctx);
    if (isLost(s)) return finish(s, steps, env);
  }

  // 5. new Vek emerge (blocked spawns hurt the blocker)
  emerge(s, env);
  if (isLost(s)) return finish(s, steps, env);

  // 6. smoke drifts away
  for (const t of s.tiles) if (t.smoke > 0) t.smoke--;
  refreshWebs(s);

  if (s.turn >= s.maxTurns) {
    s.phase = 'won';
    env.rec({ e: 'banner', text: 'VICTORY', sub: 'The surviving Vek retreat underground', tone: 'player' });
    return finish(s, steps, env);
  }
  s.turn++;
  planPhase(s, env);
  beginPlayerTurn(s, env);
  return finish(s, steps, env);
}

function finish(s: BattleState, steps: Step[], env: Ctx): Step[] {
  if (isLost(s)) {
    const why =
      s.lostReason === 'grid' ? 'The power grid has failed' : s.lostReason === 'bomb' ? 'The Breach Bomb was destroyed' : 'All mechs destroyed';
    env.rec({ e: 'banner', text: 'TIMELINE LOST', sub: why, tone: 'enemy' });
  }
  s.version++;
  return steps;
}

// ------------------------------------------------------------------ player actions

export function canMove(s: BattleState, u: Unit): boolean {
  return (
    s.phase === 'player' &&
    u.team === 'player' &&
    u.controllable &&
    !u.dead &&
    !u.moved &&
    !u.frozen &&
    !webbed(u) &&
    u.move > 0
  );
}

export function canAct(s: BattleState, u: Unit): boolean {
  return s.phase === 'player' && u.team === 'player' && u.controllable && !u.dead && !u.acted && !u.frozen;
}

/** Why the weapon in `slot` cannot fire right now, or '' when it can. */
export function weaponBlock(s: BattleState, u: Unit, slot: number): string {
  const inst = u.weapons[slot];
  if (!inst) return 'No weapon';
  if (u.dead) return 'Destroyed';
  if (u.frozen) return 'Frozen';
  if (u.acted) return 'Already acted';
  if (inSmoke(s, u)) return 'In smoke';
  if (submerged(s, u)) return 'Submerged';
  if (inst.uses === 0) return 'No uses left';
  if (!targetsFor(s, u, resolveWeapon(inst, u)).length) return 'No targets';
  return '';
}

export function repairBlock(s: BattleState, u: Unit): string {
  if (u.dead) return 'Destroyed';
  if (u.frozen) return 'Frozen';
  if (u.acted) return 'Already acted';
  if (inSmoke(s, u)) return 'In smoke';
  if (u.hp >= u.maxHp && !u.fire && !u.acid) return 'Undamaged';
  return '';
}

export function doMove(s: BattleState, u: Unit, ti: number): Step[] {
  if (!canMove(s, u)) return [];
  const path = reachable(s, u).get(ti);
  if (!path || path.length < 2) return [];
  const steps: Step[] = [];
  const ctx = execCtx(s, steps, u.id);
  const fx = u.x;
  const fy = u.y;
  u.x = ix(ti);
  u.y = iy(ti);
  u.moved = true;
  const d = u.x - u.y - (fx - fy);
  if (d) u.face = d > 0 ? 1 : -1;
  ctx.rec({ e: 'move', id: u.id, path });
  enterTile(s, u, ctx);
  refreshWebs(s);
  s.version++;
  return steps;
}

function afterAction(u: Unit): void {
  u.acted = true;
  if (u.skill !== 'afterburn') u.moved = true;
}

export function doAttack(s: BattleState, u: Unit, slot: number, ti: number): Step[] {
  if (weaponBlock(s, u, slot)) return [];
  const inst = u.weapons[slot];
  const w = resolveWeapon(inst, u);
  if (!targetsFor(s, u, w).includes(ti)) return [];
  const tx = ix(ti);
  const ty = iy(ti);
  const steps: Step[] = [];
  const ctx = execCtx(s, steps, u.id);
  const eff = effectsFor(s, u, w, tx, ty);
  const d = tx - ty - (u.x - u.y);
  if (d) u.face = d > 0 ? 1 : -1;
  afterAction(u);
  if (inst.uses > 0) inst.uses--;
  applyEffects(s, eff, ctx);
  if (!steps.length) ctx.rec({ e: 'pause', ms: 100 });
  s.version++;
  return steps;
}

export function doRepair(s: BattleState, u: Unit): Step[] {
  if (repairBlock(s, u)) return [];
  const steps: Step[] = [];
  const ctx = execCtx(s, steps, u.id);
  const heal = u.skill === 'medic' ? 2 : 1;
  u.hp = Math.min(u.maxHp, u.hp + heal);
  u.fire = false;
  u.acid = false;
  afterAction(u);
  ctx.rec({ e: 'heal', x: u.x, y: u.y, amt: heal });
  if (u.skill === 'medic') {
    for (const d of DIRS) {
      const o = liveAt(s, u.x + DX[d], u.y + DY[d]);
      if (!o || !friendly(o, u) || o.team === 'enemy') continue;
      o.hp = Math.min(o.maxHp, o.hp + 1);
      o.fire = false;
      o.acid = false;
      ctx.rec({ e: 'heal', x: o.x, y: o.y, amt: 1 });
    }
  }
  s.version++;
  return steps;
}

/** Mechs that can still do something this turn. */
export function idleUnits(s: BattleState): Unit[] {
  return s.units.filter((u) => u.team === 'player' && u.controllable && !u.dead && u.x >= 0 && (canMove(s, u) || (canAct(s, u) && !u.acted)));
}

export { planTarget };
