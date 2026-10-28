import type { BattleState, MissionSpec } from '../game/types';
import { createBattle } from '../game/battle/mapgen';

const cache = new Map<string, BattleState>();

/** A terrain-only board for an island theme, used as its map art. */
export function islandBoard(theme: string, seed: number, objs: ('relay' | 'lab' | 'uplink')[] = []): BattleState {
  const key = `${theme}:${seed}:${objs.join(',')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const spec: MissionSpec = {
    id: 'thumb',
    kind: 'standard',
    seed,
    theme,
    turns: 1,
    objectives: objs.map((kind) => ({ kind, n: 0, reward: { rep: 0, power: 0, core: 0, pilot: false } })),
    hazard: '',
    pool: ['wasp'],
    initial: 0,
    spawnPlan: [0],
    maxEnemies: 0,
    alphaChance: 0,
    psionChance: 0,
    boss: '',
  };
  const s = createBattle(spec, { mechs: [], grid: 1, gridMax: 1, gridDef: 0 });
  cache.set(key, s);
  return s;
}
