import { DIRS, DX, DY, type BattleState } from '../types';
import { idx, inb, ix, iy, rint, shuffle } from '../util';
import { isGroundish, isObstacle, liveAt, unitAt } from './board';
import { damageTile, enterTile, type Ctx } from './effects';

function sample(s: BattleState, pool: number[], n: number): number[] {
  return shuffle(s, pool.slice()).slice(0, n);
}

function pickTiles(s: BattleState): number[] {
  const all = s.tiles.map((_, i) => i);
  const open = all.filter((i) => !isObstacle(s.tiles[i]) && !s.tiles[i].spawn && !s.tiles[i].pod);
  const ground = open.filter((i) => isGroundish(s.tiles[i]));
  switch (s.hazard) {
    case 'airstrike': {
      // bombers favour the Vek side of the map
      const pool = ground.filter((i) => iy(i) <= 5 && !liveAt(s, ix(i), iy(i)));
      return sample(s, pool, 3);
    }
    case 'lightning':
      return sample(s, open, 2);
    case 'tidal': {
      const row = s.turn - 1;
      if (row > 2) return [];
      return ground.filter((i) => iy(i) === row);
    }
    case 'seismic':
      return sample(s, ground.filter((i) => ix(i) > 0 && ix(i) < 7 && iy(i) > 0 && iy(i) < 7), 3);
    case 'sandstorm':
    case 'icestorm': {
      const cx = 1 + rint(s, 6);
      const cy = 1 + rint(s, 6);
      const out = [idx(cx, cy)];
      if (s.hazard === 'icestorm') {
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) if (inb(cx + dx, cy + dy)) out.push(idx(cx + dx, cy + dy));
        return out;
      }
      for (const d of DIRS) if (inb(cx + DX[d], cy + DY[d])) out.push(idx(cx + DX[d], cy + DY[d]));
      return out.filter((i) => !isObstacle(s.tiles[i]));
    }
    case 'acidrain':
      return sample(s, ground, 3);
    case 'volcanic':
      return sample(s, open.filter((i) => s.tiles[i].t !== 'lava'), 3);
  }
  return [];
}

export function markHazards(s: BattleState, ctx: Ctx): void {
  for (const t of s.tiles) t.hazard = false;
  if (!s.hazard) return;
  const tiles = pickTiles(s);
  for (const i of tiles) s.tiles[i].hazard = true;
  if (tiles.length) ctx.rec({ e: 'tick', x: ix(tiles[0]), y: iy(tiles[0]), what: 'hazardMark' });
}

export function applyHazards(s: BattleState, ctx: Ctx): void {
  if (!s.hazard) return;
  const marked = s.tiles.map((t, i) => (t.hazard ? i : -1)).filter((i) => i >= 0);
  for (const i of marked) {
    const x = ix(i);
    const y = iy(i);
    const t = s.tiles[i];
    t.hazard = false;
    ctx.rec({ e: 'hazard', x, y, kind: s.hazard });
    switch (s.hazard) {
      case 'airstrike':
        damageTile(s, x, y, 3, { how: 'bomb', safeB: true }, ctx);
        break;
      case 'lightning':
        damageTile(s, x, y, 99, { pure: true, how: 'zap', safeB: true }, ctx);
        break;
      case 'tidal':
        if (!isObstacle(t)) {
          t.t = 'water';
          t.fire = false;
          t.acid = false;
          t.pod = false;
          ctx.rec({ e: 'terrain', x, y, what: 'flood' });
          const u = liveAt(s, x, y);
          if (u) enterTile(s, u, ctx);
          const wreck = unitAt(s, x, y);
          if (wreck?.dead) wreck.x = wreck.y = -1;
        }
        break;
      case 'seismic':
        if (!isObstacle(t)) {
          t.t = 'chasm';
          t.fire = false;
          t.acid = false;
          t.smoke = 0;
          t.pod = false;
          ctx.rec({ e: 'terrain', x, y, what: 'collapse' });
          const u = liveAt(s, x, y);
          if (u) enterTile(s, u, ctx);
          const wreck = unitAt(s, x, y);
          if (wreck?.dead) wreck.x = wreck.y = -1;
        }
        break;
      case 'sandstorm':
        damageTile(s, x, y, 0, { smoke: 2 }, ctx);
        break;
      case 'icestorm':
        damageTile(s, x, y, 0, { freeze: true }, ctx);
        break;
      case 'acidrain':
        damageTile(s, x, y, 0, { acid: true }, ctx);
        break;
      case 'volcanic':
        damageTile(s, x, y, 2, { fire: true, how: 'burn' }, ctx);
        break;
    }
    if (s.phase === 'lost' && !ctx.preview) return;
  }
}
