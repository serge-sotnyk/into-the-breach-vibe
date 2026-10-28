// The resolution engine. Every change to a battle (weapons, pushes, hazards, fire,
// spawns) flows through here so previews, AI scoring and real turns agree exactly.

import { DIRS, DX, DY, type AnimEv, type BattleState, type Dir, type DmgOpts, type Effect, type Unit } from '../types';
import { UNITS, type PsionKind } from '../data/units';
import { idx, inb, opposite, rnd } from '../util';
import {
  aliveMechs,
  friendly,
  isGroundish,
  isMech,
  isObstacle,
  liveAt,
  refreshWebs,
  tileAt,
  unitAt,
  unitById,
} from './board';

export interface Ctx {
  preview: boolean;
  /** id of the unit performing the action (0 = environment) */
  src: number;
  rec: (ev: AnimEv) => void;
}

export function previewCtx(src = 0, sink?: AnimEv[]): Ctx {
  return { preview: true, src, rec: sink ? (ev) => sink.push(ev) : () => undefined };
}

type DmgArgs = DmgOpts & { bump?: boolean };

export function psionActive(s: BattleState, kind: PsionKind): boolean {
  for (const u of s.units) if (u.team === 'enemy' && !u.dead && UNITS[u.def]?.psion === kind) return true;
  return false;
}

export function isArmored(s: BattleState, u: Unit): boolean {
  if (u.armored) return true;
  return u.team === 'enemy' && !UNITS[u.def].psion && psionActive(s, 'shell');
}

/** Creates a unit from its definition (no entry effects). */
export function makeUnit(s: BattleState, def: string, x: number, y: number, team?: Unit['team']): Unit {
  const d = UNITS[def];
  const u: Unit = {
    id: s.nextId++,
    def,
    team: team ?? (d.kind === 'enemy' ? 'enemy' : d.kind === 'mech' ? 'player' : d.controllable ? 'player' : 'neutral'),
    x,
    y,
    hp: d.hp,
    maxHp: d.hp,
    move: d.move,
    flying: !!d.flying,
    massive: !!d.massive,
    armored: !!d.armored,
    stable: !!d.stable,
    fireImmune: !!d.fireImmune,
    smokeImmune: false,
    fire: false,
    acid: false,
    frozen: false,
    shield: false,
    webbedBy: 0,
    dead: false,
    controllable: d.kind === 'mech' || !!d.controllable,
    weapons: (d.weapons ?? []).map((id) => ({ id, up: [], uses: -1 })),
    moved: false,
    acted: false,
    pilot: '',
    skill: '',
    slot: -1,
    alpha: !!d.alpha,
    boss: !!d.boss,
    plan: null,
    face: x + y > 7 ? -1 : 1,
    kills: 0,
    hatch: d.egg ? 1 : 0,
  };
  s.units.push(u);
  return u;
}

export function applyEffects(s: BattleState, list: Effect[], ctx: Ctx): void {
  for (const e of list) {
    applyEffect(s, e, ctx);
    if (s.phase === 'lost' && !ctx.preview) break;
  }
  refreshWebs(s);
}

export function applyEffect(s: BattleState, e: Effect, ctx: Ctx): void {
  switch (e.k) {
    case 'vfx':
      ctx.rec({ e: 'vfx', v: e.v, fx: e.fx, fy: e.fy, tx: e.tx, ty: e.ty });
      return;
    case 'dmg':
      damageTile(s, e.x, e.y, e.amt, e, ctx);
      return;
    case 'move': {
      const u = unitById(s, e.id);
      if (!u || u.dead || (u.x === e.x && u.y === e.y)) return;
      if (!inb(e.x, e.y) || unitAt(s, e.x, e.y) || isObstacle(tileAt(s, e.x, e.y))) return;
      const fx = u.x;
      const fy = u.y;
      u.x = e.x;
      u.y = e.y;
      faceToward(u, fx, fy, e.x, e.y);
      ctx.rec({ e: 'slide', id: u.id, fx, fy, tx: e.x, ty: e.y, style: e.style });
      enterTile(s, u, ctx);
      return;
    }
    case 'swap': {
      const a = unitById(s, e.a);
      const b = unitById(s, e.b);
      if (!a || !b || a.dead || b.dead) return;
      const ax = a.x;
      const ay = a.y;
      a.x = b.x;
      a.y = b.y;
      b.x = ax;
      b.y = ay;
      ctx.rec({ e: 'slide', id: a.id, fx: b.x, fy: b.y, tx: a.x, ty: a.y, style: 'teleport' });
      ctx.rec({ e: 'slide', id: b.id, fx: a.x, fy: a.y, tx: b.x, ty: b.y, style: 'teleport' });
      enterTile(s, a, ctx);
      if (!b.dead && s.units.includes(b)) enterTile(s, b, ctx);
      return;
    }
    case 'spawnUnit': {
      if (!inb(e.x, e.y)) return;
      const occ = unitAt(s, e.x, e.y);
      const t = tileAt(s, e.x, e.y);
      if (occ || isObstacle(t)) {
        damageTile(s, e.x, e.y, 1, {}, ctx);
        return;
      }
      if (!isGroundish(t)) {
        ctx.rec({ e: 'terrain', x: e.x, y: e.y, what: 'splash' });
        return;
      }
      const u = makeUnit(s, e.def, e.x, e.y);
      ctx.rec({ e: 'spawn', id: u.id, x: e.x, y: e.y });
      enterTile(s, u, ctx);
      return;
    }
    case 'shield': {
      if (!inb(e.x, e.y)) return;
      const u = liveAt(s, e.x, e.y);
      if (u && !u.shield) {
        u.shield = true;
        ctx.rec({ e: 'status', x: e.x, y: e.y, what: 'shield', id: u.id });
      }
      const t = tileAt(s, e.x, e.y);
      if (t.t === 'building' && !t.shield) {
        t.shield = 'shield';
        ctx.rec({ e: 'status', x: e.x, y: e.y, what: 'shield', id: 0 });
      }
      return;
    }
    case 'wind': {
      const dir = e.dir;
      const movers = s.units
        .filter((u) => !u.dead && u.x >= 0)
        .sort((a, b) => DX[dir] * b.x + DY[dir] * b.y - (DX[dir] * a.x + DY[dir] * a.y));
      for (const u of movers) if (s.units.includes(u) && !u.dead) pushUnit(s, u, dir, ctx);
      return;
    }
    case 'selfDmg': {
      const u = unitById(s, e.id);
      if (u && !u.dead) damageUnit(s, u, e.amt, { bump: true, how: 'self' }, ctx);
      return;
    }
    case 'kill': {
      const u = unitById(s, e.id);
      if (u && !u.dead && s.units.includes(u)) killUnit(s, u, 'burst', ctx);
      return;
    }
  }
}

function faceToward(u: Unit, fx: number, fy: number, tx: number, ty: number): void {
  // screen x grows with (x - y); face the direction of travel
  const d = tx - ty - (fx - fy);
  if (d > 0) u.face = 1;
  else if (d < 0) u.face = -1;
}

/** Damage (and side effects) applied to everything on a tile. */
export function damageTile(s: BattleState, x: number, y: number, amt: number, o: DmgArgs, ctx: Ctx): void {
  if (!inb(x, y)) return;
  const t = tileAt(s, x, y);
  const u = liveAt(s, x, y);
  let unitBlocked = false;
  let allySafe = false;
  if (u) {
    const src = ctx.src ? unitById(s, ctx.src) : undefined;
    allySafe = !!o.safeAlly && !!src && src !== u && friendly(src, u);
    if (!allySafe) unitBlocked = damageUnit(s, u, amt, o, ctx) === 'blocked';
  }
  let ignite = !!o.fire;
  if (amt > 0) ignite = affectTerrain(s, x, y, amt, o, ctx) || ignite;
  if (amt > 0 && t.pod) {
    t.pod = false;
    s.stats.pod = 'destroyed';
    ctx.rec({ e: 'pod', x, y, what: 'destroy' });
  }
  const affectUnit = !unitBlocked && !allySafe;
  if (ignite) igniteTile(s, x, y, ctx, affectUnit);
  if (o.smoke) {
    if (!isObstacle(t) && t.smoke < o.smoke) {
      t.smoke = o.smoke;
      ctx.rec({ e: 'status', x, y, what: 'smoke', id: 0 });
    }
  }
  if (o.acid && !liveAt(s, x, y) && isGroundish(t) && !t.acid) {
    t.acid = true;
    ctx.rec({ e: 'status', x, y, what: 'acidpool', id: 0 });
  }
  if (o.freeze) freezeTile(s, x, y, ctx);
  if (o.flip && affectUnit) {
    const fu = liveAt(s, x, y);
    if (fu?.plan) {
      fu.plan.dir = opposite(fu.plan.dir);
      ctx.rec({ e: 'flip', id: fu.id });
    }
  }
  if (o.push !== undefined) {
    const pu = liveAt(s, x, y);
    if (pu) pushUnit(s, pu, o.push, ctx);
  }
}

/** Returns 'blocked' when a shield or ice absorbed the hit. */
export function damageUnit(s: BattleState, u: Unit, amt: number, o: DmgArgs, ctx: Ctx): 'blocked' | 'hit' | 'killed' | 'none' {
  if (u.dead || !s.units.includes(u)) return 'none';
  const harmful = amt > 0 || !!o.fire || !!o.acid || !!o.freeze;
  if (u.frozen && amt > 0) {
    u.frozen = false;
    ctx.rec({ e: 'block', x: u.x, y: u.y, kind: 'ice' });
    return 'blocked';
  }
  if (u.shield && harmful) {
    u.shield = false;
    ctx.rec({ e: 'block', x: u.x, y: u.y, kind: 'shield' });
    return 'blocked';
  }
  let res: 'hit' | 'none' = 'none';
  if (amt > 0) {
    let d = amt;
    if (!o.pure && !o.bump) {
      if (u.acid) d *= 2;
      else if (isArmored(s, u)) d = Math.max(0, d - 1);
    }
    if (d <= 0) {
      ctx.rec({ e: 'block', x: u.x, y: u.y, kind: 'armor' });
    } else {
      const lost = Math.min(d, u.hp);
      u.hp -= d;
      if (isMech(u)) s.stats.mechDamage += lost;
      ctx.rec({ e: 'hit', x: u.x, y: u.y, amt: d, id: u.id });
      res = 'hit';
    }
  }
  if (u.hp <= 0) {
    killUnit(s, u, o.how ?? 'kill', ctx);
    return 'killed';
  }
  const t = tileAt(s, u.x, u.y);
  if (o.fire && !u.fireImmune && !u.fire && !(t.t === 'water' && !u.flying)) {
    u.fire = true;
    u.frozen = false;
    ctx.rec({ e: 'status', x: u.x, y: u.y, what: 'fire', id: u.id });
  }
  if (o.acid && !u.acid) {
    u.acid = true;
    ctx.rec({ e: 'status', x: u.x, y: u.y, what: 'acid', id: u.id });
  }
  if (o.freeze && !u.frozen) {
    u.frozen = true;
    u.fire = false;
    ctx.rec({ e: 'status', x: u.x, y: u.y, what: 'freeze', id: u.id });
  }
  return res;
}

export function killUnit(s: BattleState, u: Unit, how: string, ctx: Ctx): void {
  const def = UNITS[u.def];
  const x = u.x;
  const y = u.y;
  u.hp = 0;
  u.fire = false;
  u.frozen = false;
  u.shield = false;
  u.plan = null;
  u.webbedBy = 0;
  for (const o of s.units) if (o.webbedBy === u.id) o.webbedBy = 0;

  if (def.kind === 'mech') {
    u.dead = true;
    u.acid = false;
    const tt = x >= 0 ? tileAt(s, x, y).t : 'ground';
    if (tt === 'water' || tt === 'chasm' || tt === 'lava') {
      u.x = -1;
      u.y = -1;
    }
    ctx.rec({ e: 'die', id: u.id, x, y, how });
    if (aliveMechs(s).length === 0) {
      s.phase = 'lost';
      s.lostReason = 'mechs';
    }
    return;
  }

  const i = s.units.indexOf(u);
  if (i >= 0) s.units.splice(i, 1);
  u.dead = true;
  if (u.team === 'enemy') {
    if (!def.egg && u.def !== 'blob' && u.def !== 'blob_a') s.stats.kills++;
    const src = ctx.src ? unitById(s, ctx.src) : undefined;
    if (src && src.team === 'player' && src.slot >= 0) src.kills += def.boss ? 3 : 1;
    if (def.boss) s.stats.bossKilled = true;
  } else if (u.def === 'bomb') {
    s.stats.bombLost = true;
    s.phase = 'lost';
    s.lostReason = 'bomb';
  } else {
    s.stats.npcLost = true;
  }
  ctx.rec({ e: 'die', id: u.id, x, y, how });

  if (x < 0) return;
  const t = tileAt(s, x, y);
  if (u.acid && isGroundish(t) && !t.acid) {
    t.acid = true;
    ctx.rec({ e: 'status', x, y, what: 'acidpool', id: 0 });
  }
  if (u.team === 'enemy' && !def.psion && psionActive(s, 'blast')) {
    ctx.rec({ e: 'vfx', v: 'explode', fx: x, fy: y, tx: x, ty: y });
    for (const d of DIRS) damageTile(s, x + DX[d], y + DY[d], 1, { how: 'blast' }, ctx);
  }
}

export function pushUnit(s: BattleState, u: Unit, dir: Dir, ctx: Ctx): void {
  if (u.dead || !s.units.includes(u)) return;
  if (u.stable) {
    ctx.rec({ e: 'nopush', id: u.id, x: u.x, y: u.y, dir });
    return;
  }
  const nx = u.x + DX[dir];
  const ny = u.y + DY[dir];
  if (!inb(nx, ny)) {
    ctx.rec({ e: 'nopush', id: u.id, x: u.x, y: u.y, dir });
    return;
  }
  const t = tileAt(s, nx, ny);
  const b = unitAt(s, nx, ny);
  if (b || isObstacle(t)) {
    ctx.rec({ e: 'bump', id: u.id, x: u.x, y: u.y, dir });
    damageUnit(s, u, 1, { bump: true, how: 'bump' }, ctx);
    if (b) {
      if (!b.dead) damageUnit(s, b, 1, { bump: true, how: 'bump' }, ctx);
    } else if (t.t === 'building') {
      damageBuilding(s, nx, ny, 1, ctx);
    } else if (t.t === 'mountain') {
      damageMountain(s, nx, ny, 1, ctx);
    }
    return;
  }
  const fx = u.x;
  const fy = u.y;
  u.x = nx;
  u.y = ny;
  ctx.rec({ e: 'slide', id: u.id, fx, fy, tx: nx, ty: ny, style: 'push' });
  enterTile(s, u, ctx);
}

/** Terrain consequences of a unit arriving on its current tile. */
export function enterTile(s: BattleState, u: Unit, ctx: Ctx): void {
  if (u.dead || u.x < 0) return;
  const t = tileAt(s, u.x, u.y);
  if (!u.flying) {
    if (t.t === 'chasm') {
      killUnit(s, u, 'fall', ctx);
      return;
    }
    if (t.t === 'water') {
      if (!u.massive) {
        killUnit(s, u, 'drown', ctx);
        return;
      }
      if (u.fire) u.fire = false;
    }
    if (t.t === 'lava') {
      if (!u.massive) {
        killUnit(s, u, 'burn', ctx);
        return;
      }
      if (!u.fireImmune && !u.shield && !u.fire) {
        u.fire = true;
        ctx.rec({ e: 'status', x: u.x, y: u.y, what: 'fire', id: u.id });
      }
    }
    if (t.acid && !u.shield) {
      t.acid = false;
      if (!u.acid) {
        u.acid = true;
        ctx.rec({ e: 'status', x: u.x, y: u.y, what: 'acid', id: u.id });
      }
    }
  }
  if (t.fire && !u.fireImmune && !u.shield && !u.frozen && !u.fire) {
    u.fire = true;
    ctx.rec({ e: 'status', x: u.x, y: u.y, what: 'fire', id: u.id });
  }
  if (t.pod) {
    if (isMech(u)) {
      t.pod = false;
      s.stats.pod = 'collected';
      ctx.rec({ e: 'pod', x: u.x, y: u.y, what: 'collect' });
    } else if (u.team === 'enemy') {
      t.pod = false;
      s.stats.pod = 'destroyed';
      ctx.rec({ e: 'pod', x: u.x, y: u.y, what: 'destroy' });
    }
  }
}

export function damageBuilding(s: BattleState, x: number, y: number, amt: number, ctx: Ctx): void {
  const t = tileAt(s, x, y);
  if (t.t !== 'building' || amt <= 0) return;
  if (t.shield) {
    t.shield = '';
    ctx.rec({ e: 'block', x, y, kind: 'shield' });
    return;
  }
  if (!ctx.preview && rnd(s) * 100 < s.gridDef) {
    s.stats.resisted++;
    ctx.rec({ e: 'block', x, y, kind: 'grid' });
    return;
  }
  const lost = Math.min(amt, t.hp);
  t.hp -= lost;
  s.grid = Math.max(0, s.grid - lost);
  s.stats.gridLost += lost;
  if (t.hp <= 0) {
    t.t = 'rubble';
    t.hp = 0;
    t.fire = false;
  }
  ctx.rec({ e: 'building', x, y, lost });
  if (s.grid <= 0) {
    s.phase = 'lost';
    s.lostReason = 'grid';
  }
}

function damageMountain(s: BattleState, x: number, y: number, amt: number, ctx: Ctx): void {
  const t = tileAt(s, x, y);
  t.hp -= amt;
  if (t.hp <= 0) {
    t.t = 'rubble';
    t.hp = 0;
    ctx.rec({ e: 'terrain', x, y, what: 'rockfall' });
  } else {
    ctx.rec({ e: 'terrain', x, y, what: 'crack' });
  }
}

/** Returns true when the hit should ignite the tile (forests). */
function affectTerrain(s: BattleState, x: number, y: number, amt: number, o: DmgArgs, ctx: Ctx): boolean {
  const t = tileAt(s, x, y);
  switch (t.t) {
    case 'building':
      if (!o.safeB) damageBuilding(s, x, y, amt, ctx);
      return false;
    case 'mountain':
      damageMountain(s, x, y, amt, ctx);
      return false;
    case 'forest':
      return !t.fire;
    case 'sand':
      t.t = 'ground';
      t.smoke = Math.max(t.smoke, 1);
      ctx.rec({ e: 'terrain', x, y, what: 'dust' });
      return false;
    case 'ice': {
      t.hp -= 1;
      if (t.hp <= 0) {
        t.t = 'water';
        t.hp = 0;
        t.fire = false;
        ctx.rec({ e: 'terrain', x, y, what: 'shatter' });
        const u = liveAt(s, x, y);
        if (u) enterTile(s, u, ctx);
        const wreck = unitAt(s, x, y);
        if (wreck?.dead) {
          wreck.x = -1;
          wreck.y = -1;
        }
      } else {
        ctx.rec({ e: 'terrain', x, y, what: 'crack' });
      }
      return false;
    }
    default:
      return false;
  }
}

export function igniteTile(s: BattleState, x: number, y: number, ctx: Ctx, affectUnit: boolean): void {
  const t = tileAt(s, x, y);
  if (isObstacle(t) || t.t === 'water' || t.t === 'chasm' || t.t === 'lava' || t.t === 'ice') return;
  if (!t.fire) {
    t.fire = true;
    if (t.t === 'forest') t.burnt = true;
    ctx.rec({ e: 'status', x, y, what: 'burn', id: 0 });
  }
  if (!affectUnit) return;
  const u = liveAt(s, x, y);
  if (u && !u.fireImmune && !u.shield && !u.frozen && !u.fire) {
    u.fire = true;
    ctx.rec({ e: 'status', x, y, what: 'fire', id: u.id });
  }
}

export function freezeTile(s: BattleState, x: number, y: number, ctx: Ctx): void {
  const t = tileAt(s, x, y);
  if (t.t === 'water') {
    t.t = 'ice';
    t.hp = 2;
    t.maxHp = 2;
    ctx.rec({ e: 'terrain', x, y, what: 'freeze' });
  }
  if (t.fire) t.fire = false;
  if (t.t === 'building' && !t.shield) {
    t.shield = 'ice';
    ctx.rec({ e: 'status', x, y, what: 'iceblock', id: 0 });
  }
}

/** Index of the tile in a straight line from (x,y) that a projectile hits, or the last tile before the edge. */
export function lineImpact(s: BattleState, x: number, y: number, d: Dir): number {
  let cx = x + DX[d];
  let cy = y + DY[d];
  if (!inb(cx, cy)) return -1;
  for (;;) {
    const t = tileAt(s, cx, cy);
    if (isObstacle(t) || t.pod || unitAt(s, cx, cy)) return idx(cx, cy);
    const nx = cx + DX[d];
    const ny = cy + DY[d];
    if (!inb(nx, ny)) return idx(cx, cy);
    cx = nx;
    cy = ny;
  }
}
