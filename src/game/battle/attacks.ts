import { DIRS, DX, DY, type BattleState, type Dir, type DmgOpts, type Effect, type Unit, type Vfx, type WeaponInst } from '../types';
import { WEAPONS, type UpgradeMod, type WeaponDef } from '../data/weapons';
import { UNITS } from '../data/units';
import { dirTo, idx, inb, ix, iy, opposite } from '../util';
import { blocksLine, canStand, isGroundish, isObstacle, liveAt, tileAt, unitAt } from './board';
import { lineImpact } from './effects';

export function applyMod(r: WeaponDef, m: UpgradeMod): void {
  if (m.dmgAdd) r.dmg += m.dmgAdd;
  if (m.rangeAdd) r.range += m.rangeAdd;
  if (m.usesAdd && r.uses >= 0) r.uses += m.usesAdd;
  if (m.adjAdd) r.adjDmg += m.adjAdd;
  if (m.selfAdd) r.selfDmg = Math.max(0, r.selfDmg + m.selfAdd);
  if (m.set) Object.assign(r, m.set);
}

/** Weapon definition with upgrades and unit-specific damage applied. */
export function resolveWeapon(inst: WeaponInst | string, u?: Unit): WeaponDef {
  const id = typeof inst === 'string' ? inst : inst.id;
  const base = WEAPONS[id];
  const r: WeaponDef = { ...base };
  if (typeof inst !== 'string') base.up.forEach((up, i) => inst.up[i] && applyMod(r, up.mod));
  if (u) {
    const ud = UNITS[u.def];
    if (ud.kind === 'enemy' && ud.dmg !== undefined) r.dmg = ud.dmg;
  }
  return r;
}

const perp = (d: Dir): [Dir, Dir] => (d === 0 || d === 2 ? [1, 3] : [0, 2]);

const vfx = (v: Vfx, fx: number, fy: number, tx: number, ty: number): Effect => ({ k: 'vfx', v, fx, fy, tx, ty });
const dmg = (x: number, y: number, amt: number, o: DmgOpts = {}): Effect => ({ k: 'dmg', x, y, amt, ...o });

/** All tiles the weapon may be aimed at (tile indices). */
export function targetsFor(s: BattleState, u: Unit, w: WeaponDef): number[] {
  const out = new Set<number>();
  const add = (x: number, y: number): void => {
    if (inb(x, y)) out.add(idx(x, y));
  };
  switch (w.kind) {
    case 'melee':
      for (const d of DIRS) add(u.x + DX[d], u.y + DY[d]);
      break;
    case 'chain':
      for (const d of DIRS) {
        const x = u.x + DX[d];
        const y = u.y + DY[d];
        if (inb(x, y) && liveAt(s, x, y)) add(x, y);
      }
      break;
    case 'throw':
      for (const d of DIRS) {
        const x = u.x + DX[d];
        const y = u.y + DY[d];
        if (!inb(x, y)) continue;
        const o = liveAt(s, x, y);
        if (!o || o.stable) continue;
        const bx = u.x - DX[d];
        const by = u.y - DY[d];
        if (!inb(bx, by) || isObstacle(tileAt(s, bx, by)) || unitAt(s, bx, by)) continue;
        add(x, y);
      }
      break;
    case 'projectile':
    case 'laser':
    case 'pull':
    case 'charge':
      for (const d of DIRS) {
        for (let k = 1; ; k++) {
          const x = u.x + DX[d] * k;
          const y = u.y + DY[d] * k;
          if (!inb(x, y)) break;
          if (w.kind === 'charge' && !blocksLine(s, x, y) && !canStand(u, tileAt(s, x, y))) break;
          add(x, y);
          if (blocksLine(s, x, y)) break;
        }
      }
      break;
    case 'flame':
      for (const d of DIRS) {
        for (let k = 1; k <= w.range; k++) {
          const x = u.x + DX[d] * k;
          const y = u.y + DY[d] * k;
          if (!inb(x, y) || isObstacle(tileAt(s, x, y))) break;
          add(x, y);
        }
      }
      break;
    case 'artillery':
    case 'grav':
    case 'cryo':
    case 'eggToss':
    case 'blobToss':
      for (const d of DIRS) {
        for (let k = Math.max(1, w.minRange); k <= w.range; k++) {
          const x = u.x + DX[d] * k;
          const y = u.y + DY[d] * k;
          if (!inb(x, y)) break;
          if (w.kind === 'eggToss' || w.kind === 'blobToss') {
            const t = tileAt(s, x, y);
            if (!isGroundish(t) || unitAt(s, x, y)) continue;
          }
          add(x, y);
        }
      }
      break;
    case 'shieldArt':
      add(u.x, u.y);
      for (const d of DIRS) for (let k = 1; k <= w.range; k++) add(u.x + DX[d] * k, u.y + DY[d] * k);
      break;
    case 'leap':
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const m = Math.abs(x - u.x) + Math.abs(y - u.y);
          if (m < 1 || m > w.range) continue;
          if (unitAt(s, x, y) || !canStand(u, tileAt(s, x, y))) continue;
          add(x, y);
        }
      break;
    case 'swap':
      for (const d of DIRS)
        for (let k = 1; k <= w.range; k++) {
          const x = u.x + DX[d] * k;
          const y = u.y + DY[d] * k;
          if (!inb(x, y)) break;
          const t = tileAt(s, x, y);
          if (isObstacle(t)) continue;
          const o = unitAt(s, x, y);
          if (o && (o.dead || o.stable)) continue;
          if (!o && !canStand(u, t)) continue;
          if (o && !canStand(o, tileAt(s, u.x, u.y))) continue;
          add(x, y);
        }
      break;
    case 'smokeRun':
      for (const d of DIRS)
        for (let k = w.minRange; k <= w.range; k++) {
          const x = u.x + DX[d] * k;
          const y = u.y + DY[d] * k;
          if (!inb(x, y)) break;
          if (unitAt(s, x, y) || !canStand(u, tileAt(s, x, y))) continue;
          add(x, y);
        }
      break;
    case 'repulse':
    case 'explode':
      add(u.x, u.y);
      break;
    case 'wind':
      for (const d of DIRS) add(u.x + DX[d], u.y + DY[d]);
      break;
    case 'none':
      break;
  }
  return [...out];
}

/** Ordered effect list for firing weapon `w` from unit `u` at tile (tx, ty). */
export function effectsFor(s: BattleState, u: Unit, w: WeaponDef, tx: number, ty: number): Effect[] {
  const E: Effect[] = [];
  if (!inb(tx, ty)) return E;
  const d = dirTo(u.x, u.y, tx, ty);
  switch (w.kind) {
    case 'melee': {
      if (d === -1) return E;
      E.push(vfx(w.vfx, u.x, u.y, tx, ty));
      E.push(dmg(tx, ty, w.dmg, { push: w.push ? d : undefined, fire: w.fire, acid: w.acid, flip: w.flip }));
      if (w.sweep) {
        for (const p of perp(d)) {
          const sx = tx + DX[p];
          const sy = ty + DY[p];
          if (inb(sx, sy)) E.push(dmg(sx, sy, w.dmg));
        }
      }
      return E;
    }
    case 'projectile': {
      if (d === -1) return E;
      const hit = lineImpact(s, u.x, u.y, d);
      if (hit < 0) return E;
      const hx = ix(hit);
      const hy = iy(hit);
      E.push(vfx(w.vfx, u.x, u.y, hx, hy));
      E.push(dmg(hx, hy, w.dmg, { push: w.push ? d : undefined, acid: w.acid, fire: w.fire }));
      if (w.splash) {
        for (const p of perp(d)) {
          const sx = hx + DX[p];
          const sy = hy + DY[p];
          if (inb(sx, sy)) E.push(dmg(sx, sy, w.dmg, { acid: w.acid }));
        }
      }
      if (w.smokeBehind) {
        const bx = u.x - DX[d];
        const by = u.y - DY[d];
        if (inb(bx, by)) E.push(dmg(bx, by, 0, { smoke: 1 }));
      }
      return E;
    }
    case 'artillery': {
      if (d === -1) return E;
      E.push(vfx(w.vfx, u.x, u.y, tx, ty));
      if (!w.cluster) E.push(dmg(tx, ty, w.dmg, { fire: w.fire, acid: w.acid, safeB: w.safeB }));
      for (const a of DIRS) {
        const ax = tx + DX[a];
        const ay = ty + DY[a];
        if (!inb(ax, ay)) continue;
        if (w.cluster) E.push(dmg(ax, ay, w.dmg, { push: w.pushAdj ? a : undefined, safeB: w.safeB }));
        else if (w.pushAdj) E.push(dmg(ax, ay, w.adjDmg, { push: a, safeB: w.safeB }));
        else if (w.adjDmg > 0) E.push(dmg(ax, ay, w.adjDmg, { safeB: w.safeB }));
      }
      return E;
    }
    case 'laser': {
      if (d === -1) return E;
      const tiles: [number, number][] = [];
      for (let k = 1; ; k++) {
        const x = u.x + DX[d] * k;
        const y = u.y + DY[d] * k;
        if (!inb(x, y)) break;
        tiles.push([x, y]);
        if (isObstacle(tileAt(s, x, y))) break;
      }
      if (!tiles.length) return E;
      const last = tiles[tiles.length - 1];
      E.push(vfx(w.vfx, u.x, u.y, last[0], last[1]));
      tiles.forEach(([x, y], i) => E.push(dmg(x, y, w.decay ? Math.max(1, w.dmg - i) : w.dmg, { safeAlly: w.safeAlly })));
      return E;
    }
    case 'charge': {
      if (d === -1) return E;
      let sx = u.x;
      let sy = u.y;
      let hit: [number, number] | null = null;
      for (let k = 1; ; k++) {
        const x = u.x + DX[d] * k;
        const y = u.y + DY[d] * k;
        if (!inb(x, y)) break;
        if (blocksLine(s, x, y)) {
          hit = [x, y];
          break;
        }
        if (!canStand(u, tileAt(s, x, y))) break;
        sx = x;
        sy = y;
      }
      if (sx !== u.x || sy !== u.y) E.push({ k: 'move', id: u.id, x: sx, y: sy, style: 'charge' });
      if (hit) {
        E.push(vfx('punch', sx, sy, hit[0], hit[1]));
        E.push(dmg(hit[0], hit[1], w.dmg, { push: w.push ? d : undefined }));
        if (w.selfDmg > 0) E.push({ k: 'selfDmg', id: u.id, amt: w.selfDmg });
      }
      return E;
    }
    case 'leap': {
      E.push({ k: 'move', id: u.id, x: tx, y: ty, style: 'leap' });
      E.push(vfx('pulse', tx, ty, tx, ty));
      for (const a of DIRS) {
        const ax = tx + DX[a];
        const ay = ty + DY[a];
        if (inb(ax, ay)) E.push(dmg(ax, ay, w.dmg, { push: w.pushAdj ? a : undefined }));
      }
      if (w.selfDmg > 0) E.push({ k: 'selfDmg', id: u.id, amt: w.selfDmg });
      return E;
    }
    case 'pull': {
      if (d === -1) return E;
      const hit = lineImpact(s, u.x, u.y, d);
      if (hit < 0) return E;
      const hx = ix(hit);
      const hy = iy(hit);
      E.push(vfx('hook', u.x, u.y, hx, hy));
      if (!blocksLine(s, hx, hy)) return E;
      const o = unitAt(s, hx, hy);
      const ax = u.x + DX[d];
      const ay = u.y + DY[d];
      if (o && !o.dead && !o.stable) {
        if (hx !== ax || hy !== ay) E.push({ k: 'move', id: o.id, x: ax, y: ay, style: 'pull' });
      } else {
        const px = hx - DX[d];
        const py = hy - DY[d];
        if (px !== u.x || py !== u.y) E.push({ k: 'move', id: u.id, x: px, y: py, style: 'pull' });
      }
      return E;
    }
    case 'grav':
      if (d === -1) return E;
      E.push(vfx('arc', u.x, u.y, tx, ty));
      E.push(dmg(tx, ty, w.dmg, { push: opposite(d) }));
      return E;
    case 'throw': {
      if (d === -1) return E;
      const o = liveAt(s, tx, ty);
      if (!o || o.stable) return E;
      const bx = u.x - DX[d];
      const by = u.y - DY[d];
      if (!inb(bx, by) || isObstacle(tileAt(s, bx, by)) || unitAt(s, bx, by)) return E;
      E.push(vfx('punch', u.x, u.y, tx, ty));
      E.push({ k: 'move', id: o.id, x: bx, y: by, style: 'throw' });
      E.push(dmg(bx, by, w.dmg, { safeAlly: w.safeAlly }));
      return E;
    }
    case 'repulse':
      E.push(vfx('pulse', u.x, u.y, u.x, u.y));
      if (w.shieldSelf) E.push({ k: 'shield', x: u.x, y: u.y });
      for (const a of DIRS) {
        const ax = u.x + DX[a];
        const ay = u.y + DY[a];
        if (inb(ax, ay)) E.push(dmg(ax, ay, w.dmg, { push: a }));
      }
      return E;
    case 'swap': {
      const o = unitAt(s, tx, ty);
      E.push(vfx('swap', u.x, u.y, tx, ty));
      if (o) E.push({ k: 'swap', a: u.id, b: o.id });
      else E.push({ k: 'move', id: u.id, x: tx, y: ty, style: 'teleport' });
      return E;
    }
    case 'shieldArt':
      E.push(vfx('shield', u.x, u.y, tx, ty));
      E.push({ k: 'shield', x: tx, y: ty });
      for (const a of DIRS) if (inb(tx + DX[a], ty + DY[a])) E.push({ k: 'shield', x: tx + DX[a], y: ty + DY[a] });
      return E;
    case 'smokeRun': {
      if (d === -1) return E;
      const dist = Math.abs(tx - u.x) + Math.abs(ty - u.y);
      const ox = u.x;
      const oy = u.y;
      E.push({ k: 'move', id: u.id, x: tx, y: ty, style: 'fly' });
      for (let k = 1; k < dist; k++) E.push(dmg(ox + DX[d] * k, oy + DY[d] * k, w.dmg, { smoke: 1 }));
      return E;
    }
    case 'chain': {
      const first = liveAt(s, tx, ty);
      if (!first || first === u) return E;
      const seen = new Set<number>([u.id, first.id]);
      const order: Unit[] = [first];
      const links: [number, number, number, number][] = [[u.x, u.y, first.x, first.y]];
      for (let i = 0; i < order.length; i++) {
        const c = order[i];
        for (const a of DIRS) {
          const n = liveAt(s, c.x + DX[a], c.y + DY[a]);
          if (n && !seen.has(n.id)) {
            seen.add(n.id);
            order.push(n);
            links.push([c.x, c.y, n.x, n.y]);
          }
        }
      }
      for (const [fx, fy, lx, ly] of links) E.push(vfx('bolt', fx, fy, lx, ly));
      for (const n of order) E.push(dmg(n.x, n.y, w.dmg, { safeAlly: w.safeAlly }));
      return E;
    }
    case 'flame': {
      if (d === -1) return E;
      const tiles: [number, number][] = [];
      for (let k = 1; k <= w.range; k++) {
        const x = u.x + DX[d] * k;
        const y = u.y + DY[d] * k;
        if (!inb(x, y) || isObstacle(tileAt(s, x, y))) break;
        tiles.push([x, y]);
      }
      if (!tiles.length) return E;
      const last = tiles[tiles.length - 1];
      E.push(vfx('flame', u.x, u.y, last[0], last[1]));
      tiles.forEach(([x, y], i) =>
        E.push(dmg(x, y, w.dmg, { fire: true, push: i === tiles.length - 1 && w.push ? d : undefined })),
      );
      return E;
    }
    case 'cryo':
      E.push(vfx('frost', u.x, u.y, tx, ty));
      E.push(dmg(tx, ty, 0, { freeze: true }));
      if (w.selfFreeze) E.push(dmg(u.x, u.y, 0, { freeze: true }));
      return E;
    case 'wind':
      if (d === -1) return E;
      E.push(vfx('wind', u.x, u.y, tx, ty));
      E.push({ k: 'wind', dir: d });
      return E;
    case 'eggToss':
    case 'blobToss':
      E.push(vfx('arc', u.x, u.y, tx, ty));
      E.push({ k: 'spawnUnit', x: tx, y: ty, def: w.kind === 'eggToss' ? 'egg' : UNITS[u.def].alpha ? 'blob_a' : 'blob' });
      return E;
    case 'explode':
      E.push(vfx('explode', u.x, u.y, u.x, u.y));
      for (const a of DIRS) {
        const ax = u.x + DX[a];
        const ay = u.y + DY[a];
        if (inb(ax, ay)) E.push(dmg(ax, ay, w.dmg, { how: 'blast' }));
      }
      E.push({ k: 'kill', id: u.id });
      return E;
    case 'none':
      return E;
  }
  return E;
}

/** Target tile of a queued enemy attack. Attacks are stored relative to the attacker, so they move when it is pushed. */
export function planTarget(u: Unit): [number, number] | null {
  if (!u.plan) return null;
  return [u.x + DX[u.plan.dir] * u.plan.dist, u.y + DY[u.plan.dir] * u.plan.dist];
}

export function enemyEffects(s: BattleState, u: Unit): Effect[] {
  if (!u.plan || u.dead) return [];
  const t = planTarget(u)!;
  if (!inb(t[0], t[1])) return [];
  return effectsFor(s, u, resolveWeapon(u.plan.w, u), t[0], t[1]);
}
