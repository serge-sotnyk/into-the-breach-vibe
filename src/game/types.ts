// Core data model. Everything here is plain JSON so battles and campaigns can be
// cloned, simulated for previews and persisted without custom serialization.

export type Dir = 0 | 1 | 2 | 3; // 0 = north (y-1), 1 = east (x+1), 2 = south (y+1), 3 = west (x-1)
export const DIRS: readonly Dir[] = [0, 1, 2, 3];
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const BW = 8;
export const BH = 8;

export type Terrain =
  | 'ground'
  | 'building'
  | 'mountain'
  | 'water'
  | 'chasm'
  | 'forest'
  | 'sand'
  | 'ice'
  | 'lava'
  | 'rubble';

export interface Tile {
  t: Terrain;
  /** building health / mountain health / ice integrity (2 intact, 1 cracked) */
  hp: number;
  maxHp: number;
  fire: boolean;
  /** turns of smoke remaining (0 = clear) */
  smoke: number;
  /** acid pool */
  acid: boolean;
  /** protective layer on a building: energy shield or ice */
  shield: '' | 'shield' | 'ice';
  /** objective building tag ('' none, 'relay', 'lab', 'uplink') */
  obj: string;
  pod: boolean;
  /** enemy definition that will emerge from this tile ('' none) */
  spawn: string;
  /** marked by the mission's environmental hazard */
  hazard: boolean;
  /** visual variety seed */
  v: number;
  burnt: boolean;
}

export type Team = 'player' | 'enemy' | 'neutral';

export interface WeaponInst {
  id: string;
  up: boolean[];
  /** remaining uses this battle, -1 = unlimited */
  uses: number;
}

export interface Plan {
  w: string;
  dir: Dir;
  dist: number;
  order: number;
}

export interface Unit {
  id: number;
  def: string;
  team: Team;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  move: number;
  flying: boolean;
  massive: boolean;
  armored: boolean;
  stable: boolean;
  fireImmune: boolean;
  smokeImmune: boolean;
  fire: boolean;
  acid: boolean;
  frozen: boolean;
  shield: boolean;
  webbedBy: number;
  /** destroyed mech wreck (stays on the board as an obstacle) */
  dead: boolean;
  controllable: boolean;
  weapons: WeaponInst[];
  moved: boolean;
  acted: boolean;
  pilot: string;
  skill: string;
  /** squad slot for mechs, -1 otherwise */
  slot: number;
  alpha: boolean;
  boss: boolean;
  plan: Plan | null;
  face: 1 | -1;
  kills: number;
  /** eggs: planning phases left before hatching */
  hatch: number;
}

export type Phase = 'deploy' | 'player' | 'enemy' | 'won' | 'lost';

export interface Reward {
  rep: number;
  power: number;
  core: number;
  pilot: boolean;
}

export type ObjKind = 'kill' | 'relay' | 'lab' | 'lowdmg' | 'block' | 'pod' | 'tank' | 'boss' | 'bomb' | 'uplink';

export interface Objective {
  kind: ObjKind;
  n: number;
  reward: Reward;
}

export interface BattleStats {
  kills: number;
  mechDamage: number;
  blocked: number;
  gridLost: number;
  resisted: number;
  pod: 'none' | 'landed' | 'collected' | 'destroyed';
  bossKilled: boolean;
  npcLost: boolean;
  bombLost: boolean;
}

export type MissionKind = 'standard' | 'boss' | 'final1' | 'final2';

export interface BattleState {
  tiles: Tile[];
  units: Unit[];
  nextId: number;
  turn: number;
  maxTurns: number;
  phase: Phase;
  grid: number;
  gridMax: number;
  gridDef: number;
  rng: number;
  theme: string;
  hazard: string;
  enemyPool: string[];
  alphaChance: number;
  psionChance: number;
  spawnPlan: number[];
  maxEnemies: number;
  objectives: Objective[];
  stats: BattleStats;
  deployZone: number[];
  resetUsed: boolean;
  lostReason: string;
  kind: MissionKind;
  podTurn: number;
  title: string;
  version: number;
}

// ---------------------------------------------------------------- effects

export type Vfx =
  | 'punch'
  | 'shot'
  | 'arc'
  | 'beam'
  | 'hook'
  | 'pulse'
  | 'bolt'
  | 'flame'
  | 'frost'
  | 'explode'
  | 'wind'
  | 'spit'
  | 'swap'
  | 'shield';

export interface DmgOpts {
  push?: Dir;
  fire?: boolean;
  acid?: boolean;
  freeze?: boolean;
  smoke?: number;
  safeB?: boolean;
  safeAlly?: boolean;
  flip?: boolean;
  pure?: boolean;
  how?: string;
}

export type Effect =
  | ({ k: 'dmg'; x: number; y: number; amt: number } & DmgOpts)
  | { k: 'move'; id: number; x: number; y: number; style: SlideStyle }
  | { k: 'swap'; a: number; b: number }
  | { k: 'vfx'; v: Vfx; fx: number; fy: number; tx: number; ty: number }
  | { k: 'spawnUnit'; x: number; y: number; def: string }
  | { k: 'shield'; x: number; y: number }
  | { k: 'wind'; dir: Dir }
  | { k: 'selfDmg'; id: number; amt: number }
  | { k: 'kill'; id: number };

export type SlideStyle = 'push' | 'charge' | 'leap' | 'teleport' | 'pull' | 'throw' | 'fly';

// ---------------------------------------------------------------- animation events

export type AnimEv =
  | { e: 'move'; id: number; path: number[] }
  | { e: 'slide'; id: number; fx: number; fy: number; tx: number; ty: number; style: SlideStyle }
  | { e: 'bump'; id: number; x: number; y: number; dir: Dir }
  | { e: 'nopush'; id: number; x: number; y: number; dir: Dir }
  | { e: 'hit'; x: number; y: number; amt: number; id: number }
  | { e: 'block'; x: number; y: number; kind: 'shield' | 'ice' | 'armor' | 'grid' }
  | { e: 'die'; id: number; x: number; y: number; how: string }
  | { e: 'building'; x: number; y: number; lost: number }
  | { e: 'terrain'; x: number; y: number; what: string }
  | { e: 'status'; x: number; y: number; what: string; id: number }
  | { e: 'vfx'; v: Vfx; fx: number; fy: number; tx: number; ty: number }
  | { e: 'spawn'; id: number; x: number; y: number }
  | { e: 'spawnBlocked'; x: number; y: number }
  | { e: 'hazard'; x: number; y: number; kind: string }
  | { e: 'banner'; text: string; sub: string; tone: 'player' | 'enemy' | 'neutral' }
  | { e: 'heal'; x: number; y: number; amt: number }
  | { e: 'plan'; id: number }
  | { e: 'pod'; x: number; y: number; what: 'land' | 'collect' | 'destroy' }
  | { e: 'tick'; x: number; y: number; what: string }
  | { e: 'flip'; id: number }
  | { e: 'pause'; ms: number };

export interface Step {
  ev: AnimEv;
  snap: BattleState;
}

// ---------------------------------------------------------------- campaign

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Pilot {
  id: string;
  name: string;
  skill: string;
  xp: number;
  level: number;
  ai: boolean;
  look: number;
}

export interface WeaponCfg {
  id: string;
  up: boolean[];
}

export interface MechCfg {
  chassis: string;
  pilot: Pilot;
  weapons: (WeaponCfg | null)[];
}

export interface MissionSpec {
  id: string;
  name: string;
  kind: MissionKind;
  seed: number;
  theme: string;
  turns: number;
  objectives: Objective[];
  hazard: string;
  pool: string[];
  initial: number;
  spawnPlan: number[];
  maxEnemies: number;
  alphaChance: number;
  psionChance: number;
  boss: string;
  briefing: string;
}

export interface RegionState {
  id: string;
  name: string;
  /** position on the island map, 0..1 */
  px: number;
  py: number;
  boss: boolean;
  done: boolean;
  mission: MissionSpec | null;
  result: { success: boolean[]; gridLost: number } | null;
}

export interface IslandState {
  id: string;
  secured: boolean;
  regions: RegionState[];
  tier: number;
}

export interface ShopItem {
  kind: 'weapon' | 'core' | 'power' | 'defense';
  id: string;
  price: number;
  sold: boolean;
}

export interface CampaignStats {
  kills: number;
  missions: number;
  buildingsLost: number;
  pilotsLost: number;
  bonusDone: number;
  bonusTotal: number;
}

export type CampaignPhase = 'world' | 'island' | 'shop' | 'final' | 'victory' | 'defeat';

export interface Campaign {
  version: number;
  id: string;
  seed: number;
  rng: number;
  difficulty: Difficulty;
  squad: string;
  mechs: MechCfg[];
  reserve: Pilot[];
  inventory: string[];
  grid: number;
  gridMax: number;
  gridDef: number;
  rep: number;
  cores: number;
  islands: IslandState[];
  current: number;
  secured: number;
  finalStage: number;
  finalMissions: MissionSpec[];
  shop: ShopItem[];
  phase: CampaignPhase;
  stats: CampaignStats;
  playMs: number;
  createdAt: number;
  usedPilots: string[];
  log: string[];
}
