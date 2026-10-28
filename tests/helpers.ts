import type { BattleState, Terrain, Tile } from '../src/game/types';
import { makeUnit } from '../src/game/battle/effects';
import { idx } from '../src/game/util';

export function blankBattle(): BattleState {
  const tiles: Tile[] = Array.from({ length: 64 }, () => ({
    t: 'ground',
    hp: 0,
    maxHp: 0,
    fire: false,
    smoke: 0,
    acid: false,
    shield: '',
    obj: '',
    pod: false,
    spawn: '',
    hazard: false,
    v: 0,
    burnt: false,
  }));
  return {
    tiles,
    units: [],
    nextId: 1,
    turn: 1,
    maxTurns: 5,
    phase: 'player',
    grid: 5,
    gridMax: 7,
    gridDef: 0,
    rng: 12345,
    theme: 'verdant',
    hazard: '',
    enemyPool: ['spitter'],
    alphaChance: 0,
    psionChance: 0,
    spawnPlan: [0, 0, 0, 0, 0],
    maxEnemies: 6,
    objectives: [],
    stats: { kills: 0, mechDamage: 0, blocked: 0, gridLost: 0, resisted: 0, pod: 'none', bossKilled: false, npcLost: false, bombLost: false },
    deployZone: [],
    resetUsed: false,
    lostReason: '',
    kind: 'standard',
    podTurn: 0,
    title: 'Test',
    version: 0,
  };
}

export function setTile(s: BattleState, x: number, y: number, t: Terrain, hp = 0): Tile {
  const tile = s.tiles[idx(x, y)];
  tile.t = t;
  tile.hp = tile.maxHp = hp;
  return tile;
}

export function mech(s: BattleState, chassis: string, x: number, y: number, weapons: string[], slot = 0) {
  const u = makeUnit(s, chassis, x, y, 'player');
  u.slot = slot;
  u.weapons = weapons.map((id) => ({ id, up: [], uses: -1 }));
  return u;
}

export function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  };
}
