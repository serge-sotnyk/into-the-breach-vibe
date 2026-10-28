import { DIRS, DX, DY, type BattleState, type MissionSpec, type Pilot, type Terrain, type Tile, type WeaponCfg } from '../types';
import { TERRAIN_GEN } from '../data/islands';
import { UNITS } from '../data/units';
import { idx, inb, ix, iy, pick, rint, rnd, shuffle, weighted } from '../util';
import { isGroundish, unitAt } from './board';
import { makeUnit } from './effects';
import { resolveWeapon } from './attacks';
import { pickEnemyType } from './turn';

export interface MechSetup {
  chassis: string;
  pilot: Pilot;
  weapons: WeaponCfg[];
  slot: number;
}

export interface BattleSetup {
  mechs: MechSetup[];
  grid: number;
  gridMax: number;
  gridDef: number;
}

function blank(): Tile {
  return { t: 'ground', hp: 0, maxHp: 0, fire: false, smoke: 0, acid: false, shield: '', obj: '', pod: false, spawn: '', hazard: false, v: 0, burnt: false };
}

type H = { rng: number };

function genTiles(h: H, theme: string, objs: string[]): Tile[] {
  const g = TERRAIN_GEN[theme] ?? TERRAIN_GEN.verdant;
  const tiles: Tile[] = Array.from({ length: 64 }, () => blank());
  tiles.forEach((t) => (t.v = rint(h, 100000)));
  const range = ([a, b]: [number, number]): number => a + rint(h, b - a + 1);

  const grow = (type: Terrain, count: number, edge: boolean): void => {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < 300) {
      let start: number;
      if (edge) {
        const side = rint(h, 4);
        const k = rint(h, 8);
        start = side === 0 ? idx(k, 0) : side === 1 ? idx(7, k) : side === 2 ? idx(k, 7) : idx(0, k);
      } else {
        start = idx(1 + rint(h, 6), 1 + rint(h, 6));
      }
      if (tiles[start].t !== 'ground') continue;
      tiles[start].t = type;
      placed++;
      const blob = [start];
      const size = 2 + rint(h, 3);
      let g2 = 0;
      while (blob.length < size && placed < count && g2++ < 40) {
        const b = pick(h, blob);
        const d = pick(h, DIRS);
        const nx = ix(b) + DX[d];
        const ny = iy(b) + DY[d];
        if (!inb(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (tiles[ni].t !== 'ground') continue;
        tiles[ni].t = type;
        blob.push(ni);
        placed++;
      }
    }
  };

  grow('water', range(g.water), true);
  grow('lava', range(g.lava), false);
  grow('chasm', range(g.chasm), false);
  grow('forest', range(g.forest), false);
  grow('sand', range(g.sand), false);
  grow('ice', range(g.ice), false);

  let mountains = range(g.mountain);
  let guard = 0;
  while (mountains > 0 && guard++ < 200) {
    const i = rint(h, 64);
    if (tiles[i].t !== 'ground') continue;
    tiles[i].t = 'mountain';
    tiles[i].hp = tiles[i].maxHp = 2;
    mountains--;
  }

  const nb = range(g.buildings);
  for (let k = 0; k < nb; k++) {
    const cand = tiles.map((_, i) => i).filter((i) => tiles[i].t === 'ground');
    const choice = weighted(h, cand, (i) => {
      const y = iy(i);
      let w = y >= 3 ? 3 : y === 2 ? 1 : 0.35;
      for (const d of DIRS) {
        const nx = ix(i) + DX[d];
        const ny = y + DY[d];
        if (inb(nx, ny) && tiles[idx(nx, ny)].t === 'building') w += 1.6;
      }
      return w;
    });
    if (choice === undefined) break;
    const t = tiles[choice];
    t.t = 'building';
    t.hp = t.maxHp = rnd(h) < g.tall ? 2 : 1;
  }

  for (const t of tiles) if (t.t === 'ice') t.hp = t.maxHp = 2;

  const acid = range(g.acid);
  const groundTiles = shuffle(h, tiles.map((_, i) => i).filter((i) => tiles[i].t === 'ground'));
  for (let k = 0; k < acid && k < groundTiles.length; k++) tiles[groundTiles[k]].acid = true;

  for (const obj of objs) {
    const cand = tiles
      .map((_, i) => i)
      .filter((i) => tiles[i].t === 'building' && !tiles[i].obj && iy(i) >= 2 && iy(i) <= 6 && ix(i) >= 1 && ix(i) <= 6);
    let i = cand.length ? pick(h, cand) : -1;
    if (i < 0) {
      const g2 = tiles.map((_, j) => j).filter((j) => tiles[j].t === 'ground' && iy(j) >= 3);
      if (!g2.length) continue;
      i = pick(h, g2);
      tiles[i].t = 'building';
    }
    tiles[i].obj = obj;
    tiles[i].hp = tiles[i].maxHp = obj === 'relay' ? 1 : 2;
  }
  return tiles;
}

function largestComponentShare(tiles: Tile[]): number {
  const walk = (t: Tile): boolean => isGroundish(t);
  const seen = new Set<number>();
  let total = 0;
  let best = 0;
  for (let i = 0; i < 64; i++) {
    if (!walk(tiles[i])) continue;
    total++;
    if (seen.has(i)) continue;
    let size = 0;
    const q = [i];
    seen.add(i);
    while (q.length) {
      const c = q.pop()!;
      size++;
      for (const d of DIRS) {
        const nx = ix(c) + DX[d];
        const ny = iy(c) + DY[d];
        if (!inb(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (seen.has(ni) || !walk(tiles[ni])) continue;
        seen.add(ni);
        q.push(ni);
      }
    }
    best = Math.max(best, size);
  }
  return total ? best / total : 0;
}

function validMap(tiles: Tile[]): boolean {
  const ok = (i: number): boolean => isGroundish(tiles[i]) && !tiles[i].acid;
  let deploy = 0;
  let enemy = 0;
  let buildings = 0;
  for (let i = 0; i < 64; i++) {
    if (tiles[i].t === 'building') buildings++;
    if (!ok(i)) continue;
    if (iy(i) >= 4 && iy(i) <= 6) deploy++;
    if (iy(i) <= 3) enemy++;
  }
  return deploy >= 7 && enemy >= 9 && buildings >= 5 && largestComponentShare(tiles) >= 0.85;
}

export function createBattle(spec: MissionSpec, setup: BattleSetup): BattleState {
  const h = { rng: spec.seed };
  const objs: string[] = [];
  for (const o of spec.objectives) if (o.kind === 'relay' || o.kind === 'lab' || o.kind === 'uplink') objs.push(o.kind);
  let tiles = genTiles(h, spec.theme, objs);
  for (let tries = 0; tries < 60 && !validMap(tiles); tries++) tiles = genTiles(h, spec.theme, objs);

  const s: BattleState = {
    tiles,
    units: [],
    nextId: 1,
    turn: 0,
    maxTurns: spec.turns,
    phase: 'deploy',
    grid: setup.grid,
    gridMax: setup.gridMax,
    gridDef: setup.gridDef,
    rng: (spec.seed ^ 0x9e3779b9) >>> 0,
    theme: spec.theme,
    hazard: spec.hazard,
    enemyPool: spec.pool,
    alphaChance: spec.alphaChance,
    psionChance: spec.psionChance,
    spawnPlan: spec.spawnPlan,
    maxEnemies: spec.maxEnemies,
    objectives: spec.objectives,
    stats: { kills: 0, mechDamage: 0, blocked: 0, gridLost: 0, resisted: 0, pod: 'none', bossKilled: false, npcLost: false, bombLost: false },
    deployZone: [],
    resetUsed: false,
    lostReason: '',
    kind: spec.kind,
    podTurn: spec.objectives.some((o) => o.kind === 'pod') ? 2 : 0,
    version: 0,
  };

  // the bomb sits in the middle of the deployment area
  if (spec.objectives.some((o) => o.kind === 'bomb')) {
    const spots = [idx(3, 5), idx(4, 5), idx(3, 4), idx(4, 4)];
    const i = pick(h, spots);
    const t = s.tiles[i];
    Object.assign(t, { t: 'ground', hp: 0, maxHp: 0, acid: false, obj: '' });
    makeUnit(s, 'bomb', ix(i), iy(i), 'neutral');
  }

  // mechs wait off-board until deployed
  for (const m of setup.mechs) {
    const u = makeUnit(s, m.chassis, -1, -1, 'player');
    u.slot = m.slot;
    u.pilot = m.pilot.id;
    u.skill = m.pilot.ai ? '' : m.pilot.skill;
    if (m.pilot.level >= 1) u.maxHp += 2;
    if (m.pilot.level >= 2) u.move += 1;
    switch (u.skill) {
      case 'tough':
        u.maxHp += 2;
        break;
      case 'swift':
        u.move += 1;
        break;
      case 'flying':
        u.flying = true;
        break;
      case 'armored':
        u.armored = true;
        break;
      case 'fireproof':
        u.fireImmune = true;
        break;
      case 'evasive':
        u.smokeImmune = true;
        break;
      case 'shield':
        u.shield = true;
        break;
      case 'grid':
        s.gridDef += 10;
        break;
    }
    u.hp = u.maxHp;
    u.weapons = m.weapons.map((cfg) => {
      const inst = { id: cfg.id, up: cfg.up.slice(), uses: -1 };
      inst.uses = resolveWeapon(inst).uses;
      return inst;
    });
  }

  // deployment zone: open ground in the lower rows
  const zone = (lo: number, hi: number): number[] =>
    s.tiles
      .map((_, i) => i)
      .filter((i) => {
        const t = s.tiles[i];
        return iy(i) >= lo && iy(i) <= hi && isGroundish(t) && !t.acid && !unitAt(s, ix(i), iy(i));
      });
  let dz = zone(4, 6);
  if (dz.length < 6) dz = zone(3, 7);

  if (spec.objectives.some((o) => o.kind === 'tank')) {
    const i = pick(h, dz);
    makeUnit(s, 'tank', ix(i), iy(i), 'player');
    dz = dz.filter((j) => j !== i);
  }
  s.deployZone = dz;

  // starting Vek on the far side
  const enemyTiles = shuffle(
    h,
    s.tiles.map((_, i) => i).filter((i) => iy(i) <= 2 && isGroundish(s.tiles[i]) && !s.tiles[i].acid && !unitAt(s, ix(i), iy(i))),
  );
  const take = (): number | undefined => enemyTiles.pop();
  if (spec.boss) {
    const center = enemyTiles.filter((i) => ix(i) >= 2 && ix(i) <= 5);
    const i = center.length ? center[0] : take();
    if (i !== undefined) {
      const at = enemyTiles.indexOf(i);
      if (at >= 0) enemyTiles.splice(at, 1);
      makeUnit(s, spec.boss, ix(i), iy(i));
    }
  }
  if (spec.kind === 'final1') {
    const i = take();
    if (i !== undefined) makeUnit(s, 'psion_tyrant', ix(i), iy(i));
  }
  for (let k = 0; k < spec.initial; k++) {
    const i = take();
    if (i === undefined) break;
    let def = pickEnemyType(s);
    if (UNITS[def].psion && k === 0) def = pick(h, spec.pool);
    makeUnit(s, def, ix(i), iy(i));
  }
  return s;
}
