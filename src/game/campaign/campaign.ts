import type {
  BattleState,
  Campaign,
  Difficulty,
  IslandState,
  MissionKind,
  MissionSpec,
  ObjKind,
  Objective,
  Pilot,
  RegionState,
  Reward,
  ShopItem,
  Unit,
} from '../types';
import { FINAL_ISLAND, HAZARDS, ISLANDS, objectiveLabel, type IslandDef } from '../data/islands';
import { LEVEL_XP, PILOT_POOL, levelFor } from '../data/pilots';
import { SQUADS } from '../data/squads';
import { ARMORY, WEAPONS } from '../data/weapons';
import { UNITS } from '../data/units';
import { clamp, pick, rint, rnd, shuffle } from '../util';
import { objectiveSucceeded } from '../battle/objectives';
import { createBattle, type BattleSetup } from '../battle/mapgen';

export const CAMPAIGN_VERSION = 1;

export const DIFFICULTY: Record<Difficulty, { label: string; grid: number; gridMax: number; gridDef: number; alphaMul: number; spawnAdj: number; desc: string }> = {
  easy: { label: 'Casual', grid: 8, gridMax: 8, gridDef: 25, alphaMul: 0.6, spawnAdj: -1, desc: 'Fewer Vek, sturdier grid. Learn the ropes.' },
  normal: { label: 'Standard', grid: 7, gridMax: 8, gridDef: 20, alphaMul: 1, spawnAdj: 0, desc: 'The intended experience.' },
  hard: { label: 'Veteran', grid: 6, gridMax: 7, gridDef: 12, alphaMul: 1.35, spawnAdj: 1, desc: 'More Vek, more Alphas, less margin.' },
};

/** Islands that must be secured before the final assault unlocks. */
export const FINAL_UNLOCK = 2;

export const REGION_LAYOUT: [number, number][] = [
  [0.2, 0.32],
  [0.44, 0.18],
  [0.73, 0.27],
  [0.24, 0.7],
  [0.52, 0.8],
  [0.8, 0.64],
];
export const HQ_POS: [number, number] = [0.52, 0.5];
export const REGIONS_BEFORE_BOSS = 3;

function newPilot(h: { rng: number }, name: string, skill: string): Pilot {
  return { id: `p${rint(h, 1e9)}`, name, skill, xp: 0, level: 0, ai: false, look: rint(h, 1e6) };
}

export function aiPilot(h: { rng: number }): Pilot {
  return { id: `ai${rint(h, 1e9)}`, name: 'Autopilot', skill: '', xp: 0, level: 0, ai: true, look: 0 };
}

export function newCampaign(squadId: string, difficulty: Difficulty, seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0): Campaign {
  const h = { rng: seed };
  const squad = SQUADS[squadId];
  const diff = DIFFICULTY[difficulty];
  const roster = shuffle(h, PILOT_POOL.slice()).slice(0, 3);
  const c: Campaign = {
    version: CAMPAIGN_VERSION,
    id: `c${seed.toString(36)}`,
    seed,
    rng: (seed * 2654435761) >>> 0,
    difficulty,
    squad: squadId,
    mechs: squad.mechs.map((m, i) => ({
      chassis: m.chassis,
      pilot: newPilot(h, roster[i].name, roster[i].skill),
      weapons: [{ id: m.weapons[0], up: [] }, m.weapons[1] ? { id: m.weapons[1], up: [] } : null],
    })),
    reserve: [],
    inventory: [],
    grid: diff.grid,
    gridMax: diff.gridMax,
    gridDef: diff.gridDef,
    rep: 0,
    cores: 1,
    islands: ISLANDS.map((d) => ({ id: d.id, secured: false, regions: [], tier: 0 })),
    current: -1,
    secured: 0,
    finalStage: 0,
    finalMissions: [],
    shop: [],
    phase: 'world',
    stats: { kills: 0, missions: 0, buildingsLost: 0, pilotsLost: 0, bonusDone: 0, bonusTotal: 0 },
    playMs: 0,
    createdAt: Date.now(),
    usedPilots: roster.map((p) => p.name),
    log: [],
  };
  return c;
}

// ------------------------------------------------------------------ missions

function reward(rep = 0, power = 0, core = 0, pilot = false): Reward {
  return { rep, power, core, pilot };
}

function objectiveFor(kind: ObjKind, tier: number): Objective {
  switch (kind) {
    case 'kill':
      return { kind, n: 6 + Math.min(tier, 2), reward: reward(1) };
    case 'relay':
      return { kind, n: 0, reward: reward(0, 1) };
    case 'lab':
      return { kind, n: 0, reward: reward(2) };
    case 'lowdmg':
      return { kind, n: 4, reward: reward(0, 1) };
    case 'block':
      return { kind, n: 2, reward: reward(1) };
    case 'pod':
      return { kind, n: 0, reward: reward(0, 0, 1, true) };
    case 'tank':
      return { kind, n: 0, reward: reward(2) };
    case 'boss':
      return { kind, n: 0, reward: reward(2, 0, 1) };
    case 'bomb':
      return { kind, n: 0, reward: reward() };
    case 'uplink':
      return { kind, n: 0, reward: reward(0, 2) };
  }
}

function briefing(island: IslandDef | typeof FINAL_ISLAND, name: string, kind: MissionKind, boss: string, hazard: string): string {
  const corp = 'corp' in island ? island.corp : 'the resistance';
  const lines: string[] = [];
  if (kind === 'boss') lines.push(`The ${UNITS[boss].name} has surfaced near ${name}. Destroy it and ${corp} will hand control of the island back to you.`);
  else if (kind === 'final1') lines.push('Fight through the caldera rim and hold the landing zone while the Breach Bomb is flown in.');
  else if (kind === 'final2') lines.push('The bomb is armed. Hold the Hive Heart until detonation — whatever it takes.');
  else
    lines.push(
      pick({ rng: name.length * 7919 + boss.length }, [
        `Vek are tunnelling up beneath ${name}. Keep ${corp}'s buildings powered.`,
        `Seismic sensors at ${name} show a Vek brood surfacing. Hold the line.`,
        `${name} is under attack. Civilians are sheltering in the buildings — protect them.`,
      ]),
    );
  if (hazard) lines.push(`${HAZARDS[hazard].name}: ${HAZARDS[hazard].desc}`);
  return lines.join(' ');
}

function genMission(c: Campaign, h: { rng: number }, island: IslandDef, name: string, kind: MissionKind, tier: number): MissionSpec {
  const diff = DIFFICULTY[c.difficulty];
  const turns = kind === 'boss' ? 5 : rnd(h) < 0.5 ? 4 : 5;
  const objectives: Objective[] = [];
  if (kind === 'boss') {
    objectives.push(objectiveFor('boss', tier));
    objectives.push(objectiveFor(pick(h, ['kill', 'lowdmg', 'relay'] as ObjKind[]), tier));
  } else {
    const pool: ObjKind[] = shuffle(h, ['kill', 'relay', 'lab', 'lowdmg', 'block', 'pod', 'tank']);
    objectives.push(objectiveFor(pool[0], tier), objectiveFor(pool[1], tier));
  }
  const hazard = kind !== 'boss' && rnd(h) < 0.55 ? pick(h, island.hazards) : '';
  const alphaBase = [0.08, 0.2, 0.32, 0.45, 0.55][clamp(tier, 0, 4)];
  const spawnPlan: number[] = [];
  for (let t = 0; t < turns; t++) {
    const extra = rnd(h) < 0.3 + 0.12 * tier ? 1 : 0;
    spawnPlan.push(clamp(1 + extra + diff.spawnAdj + (tier >= 3 && t === 0 ? 1 : 0), 1, 3));
  }
  return {
    id: `m${rint(h, 1e9)}`,
    name,
    kind,
    seed: rint(h, 2 ** 31),
    theme: island.id,
    turns,
    objectives,
    hazard,
    pool: island.pool,
    initial: clamp(2 + (tier >= 3 ? 1 : 0) + (c.difficulty === 'hard' ? 1 : 0), 2, 4),
    spawnPlan,
    maxEnemies: clamp(5 + (tier >= 2 ? 1 : 0) + diff.spawnAdj, 4, 7),
    alphaChance: clamp(alphaBase * diff.alphaMul, 0, 0.85),
    psionChance: tier === 0 ? 0.04 : 0.12 + 0.05 * tier,
    boss: kind === 'boss' ? island.boss : '',
    briefing: briefing(island, name, kind, kind === 'boss' ? island.boss : '', hazard),
  };
}

function genFinal(c: Campaign, h: { rng: number }): MissionSpec[] {
  const diff = DIFFICULTY[c.difficulty];
  const tier = 4;
  const base = {
    theme: 'caldera',
    pool: FINAL_ISLAND.pool,
    alphaChance: clamp(0.5 * diff.alphaMul, 0, 0.85),
    psionChance: 0.2,
    hazard: 'volcanic',
  };
  const m1: MissionSpec = {
    ...base,
    id: `f1${rint(h, 1e9)}`,
    name: 'Caldera Rim',
    kind: 'final1',
    seed: rint(h, 2 ** 31),
    turns: 4,
    objectives: [objectiveFor('uplink', tier), objectiveFor('kill', tier)],
    initial: 3,
    spawnPlan: [2, 3, 2, 0].map((n) => clamp(n + diff.spawnAdj, 1, 3)),
    maxEnemies: clamp(6 + diff.spawnAdj, 5, 7),
    boss: '',
    briefing: '',
  };
  m1.briefing = briefing(FINAL_ISLAND, m1.name, 'final1', '', 'volcanic');
  const m2: MissionSpec = {
    ...base,
    id: `f2${rint(h, 1e9)}`,
    name: 'Hive Heart',
    kind: 'final2',
    seed: rint(h, 2 ** 31),
    turns: 4,
    objectives: [objectiveFor('bomb', tier), objectiveFor('boss', tier)],
    initial: 2,
    spawnPlan: [2, 2, 2, 0].map((n) => clamp(n + diff.spawnAdj, 1, 3)),
    maxEnemies: clamp(6 + diff.spawnAdj, 5, 7),
    boss: FINAL_ISLAND.boss,
    briefing: '',
    hazard: '',
  };
  m2.briefing = briefing(FINAL_ISLAND, m2.name, 'final2', FINAL_ISLAND.boss, '');
  return [m1, m2];
}

export function islandDef(id: string): IslandDef {
  return ISLANDS.find((d) => d.id === id)!;
}

/** Enter an island from the world map, generating its regions the first time. */
export function enterIsland(c: Campaign, index: number): void {
  const isl = c.islands[index];
  if (!isl || isl.secured) return;
  if (!isl.regions.length) {
    const def = islandDef(isl.id);
    isl.tier = c.secured;
    const regions: RegionState[] = def.regions.map((name, i) => ({
      id: `${isl.id}-${i}`,
      name,
      px: REGION_LAYOUT[i][0],
      py: REGION_LAYOUT[i][1],
      boss: false,
      done: false,
      mission: genMission(c, c, def, name, 'standard', isl.tier),
      result: null,
    }));
    regions.push({
      id: `${isl.id}-hq`,
      name: def.hq,
      px: HQ_POS[0],
      py: HQ_POS[1],
      boss: true,
      done: false,
      mission: genMission(c, c, def, def.hq, 'boss', isl.tier),
      result: null,
    });
    isl.regions = regions;
  }
  c.current = index;
  c.phase = 'island';
}

export function regionsDone(isl: IslandState): number {
  return isl.regions.filter((r) => r.done && !r.boss).length;
}

export function regionAvailable(isl: IslandState, r: RegionState): boolean {
  if (r.done) return false;
  const done = regionsDone(isl);
  return r.boss ? done >= REGIONS_BEFORE_BOSS : done < REGIONS_BEFORE_BOSS;
}

export function finalUnlocked(c: Campaign): boolean {
  return c.secured >= FINAL_UNLOCK;
}

export function enterFinal(c: Campaign): void {
  if (!finalUnlocked(c)) return;
  if (!c.finalMissions.length) c.finalMissions = genFinal(c, c);
  c.phase = 'final';
  c.current = -1;
}

export function currentMission(c: Campaign, regionId: string): MissionSpec | null {
  if (c.phase === 'final') return c.finalMissions[c.finalStage] ?? null;
  const isl = c.islands[c.current];
  return isl?.regions.find((r) => r.id === regionId)?.mission ?? null;
}

// ------------------------------------------------------------------ battle bridge

export function battleSetup(c: Campaign): BattleSetup {
  return {
    mechs: c.mechs.map((m, slot) => ({
      chassis: m.chassis,
      pilot: m.pilot,
      slot,
      weapons: m.weapons.filter((w): w is NonNullable<typeof w> => !!w).map((w) => ({ id: w.id, up: w.up.slice() })),
    })),
    grid: c.grid,
    gridMax: c.gridMax,
    gridDef: c.gridDef,
  };
}

export function startMission(c: Campaign, spec: MissionSpec): BattleState {
  return createBattle(spec, battleSetup(c));
}

export interface ObjectiveReport {
  label: string;
  success: boolean;
  reward: Reward;
}

export interface PilotReport {
  name: string;
  chassis: string;
  xpGained: number;
  level: number;
  leveled: boolean;
  died: boolean;
  ejected: boolean;
  ai: boolean;
}

export interface MissionReport {
  victory: boolean;
  missionName: string;
  objectives: ObjectiveReport[];
  rep: number;
  power: number;
  cores: number;
  defense: number;
  newPilot: Pilot | null;
  pilots: PilotReport[];
  gridLost: number;
  kills: number;
  islandSecured: string;
  finalNext: boolean;
  campaignWon: boolean;
}

function grantPilot(c: Campaign): Pilot | null {
  const free = PILOT_POOL.filter((p) => !c.usedPilots.includes(p.name));
  if (!free.length) return null;
  const p = pick(c, free);
  c.usedPilots.push(p.name);
  const pilot = newPilot(c, p.name, p.skill);
  // an AI-piloted mech gets the new recruit straight away
  const aiMech = c.mechs.find((m) => m.pilot.ai);
  if (aiMech) aiMech.pilot = pilot;
  else c.reserve.push(pilot);
  return pilot;
}

/** Folds a finished battle into the campaign and reports what changed. */
export function applyBattle(c: Campaign, regionId: string, s: BattleState): MissionReport {
  const victory = s.phase === 'won';
  const spec = currentMission(c, regionId);
  const report: MissionReport = {
    victory,
    missionName: s.title,
    objectives: [],
    rep: 0,
    power: 0,
    cores: 0,
    defense: 0,
    newPilot: null,
    pilots: [],
    gridLost: s.stats.gridLost,
    kills: s.stats.kills,
    islandSecured: '',
    finalNext: false,
    campaignWon: false,
  };
  c.stats.kills += s.stats.kills;
  c.stats.buildingsLost += s.stats.gridLost;
  c.grid = clamp(s.grid, 0, c.gridMax);

  for (const o of s.objectives) {
    const ok = objectiveSucceeded(s, o);
    report.objectives.push({ label: objectiveLabel(o, spec?.boss ?? ''), success: ok, reward: o.reward });
    if (o.kind !== 'bomb') {
      c.stats.bonusTotal++;
      if (ok) c.stats.bonusDone++;
    }
    if (!ok) continue;
    report.rep += o.reward.rep;
    report.power += o.reward.power;
    report.cores += o.reward.core;
    if (o.reward.pilot && rnd(c) < 0.6) report.newPilot = grantPilot(c);
  }

  if (!victory) {
    c.phase = 'defeat';
    return report;
  }

  c.stats.missions++;
  c.rep += report.rep;
  c.cores += report.cores;
  for (let i = 0; i < report.power; i++) {
    if (c.grid < c.gridMax) c.grid++;
    else {
      c.gridDef = Math.min(50, c.gridDef + 3);
      report.defense += 3;
    }
  }

  // pilots: experience, promotions and losses
  const mechUnits = s.units.filter((u: Unit) => u.slot >= 0 && UNITS[u.def].kind === 'mech');
  for (const u of mechUnits) {
    const m = c.mechs[u.slot];
    if (!m) continue;
    const p = m.pilot;
    const pr: PilotReport = { name: p.name, chassis: UNITS[m.chassis].name, xpGained: 0, level: p.level, leveled: false, died: false, ejected: false, ai: p.ai };
    if (u.dead) {
      if (p.ai) {
        // the autopilot is simply rebooted
      } else if (p.skill === 'eject') {
        pr.ejected = true;
      } else {
        pr.died = true;
        c.stats.pilotsLost++;
        m.pilot = c.reserve.shift() ?? aiPilot(c);
      }
    }
    if (!p.ai && !pr.died) {
      let gain = u.kills + (u.dead ? 0 : 1);
      if (p.skill === 'veteran') gain *= 2;
      p.xp += gain;
      const lvl = levelFor(p.xp);
      pr.xpGained = gain;
      if (lvl > p.level) {
        p.level = lvl;
        pr.leveled = true;
      }
      pr.level = p.level;
    }
    report.pilots.push(pr);
  }

  if (c.phase === 'final') {
    if (c.finalStage === 0) {
      c.finalStage = 1;
      report.finalNext = true;
    } else {
      c.finalStage = 2;
      c.phase = 'victory';
      report.campaignWon = true;
    }
    return report;
  }

  const isl = c.islands[c.current];
  const region = isl?.regions.find((r) => r.id === regionId);
  if (region) {
    region.done = true;
    region.result = { success: report.objectives.map((o) => o.success), gridLost: s.stats.gridLost };
    if (region.boss) {
      isl.secured = true;
      c.secured++;
      c.cores += 1;
      report.cores += 1;
      if (c.grid < c.gridMax) {
        c.grid++;
        report.power += 1;
      }
      report.islandSecured = islandDef(isl.id).name;
      c.shop = genShop(c);
      c.phase = 'shop';
    }
  }
  return report;
}

export function xpToNext(p: Pilot): number {
  return p.level >= 2 ? 0 : LEVEL_XP[p.level] - p.xp;
}

// ------------------------------------------------------------------ shop

export function ownedWeapons(c: Campaign): Set<string> {
  const s = new Set<string>(c.inventory);
  for (const m of c.mechs) for (const w of m.weapons) if (w) s.add(w.id);
  return s;
}

export function genShop(c: Campaign): ShopItem[] {
  const owned = ownedWeapons(c);
  const pool = shuffle(c, ARMORY.filter((id) => !owned.has(id)));
  const items: ShopItem[] = pool.slice(0, 4).map((id) => ({ kind: 'weapon', id, price: WEAPONS[id].price, sold: false }));
  items.push({ kind: 'core', id: 'core-a', price: 3, sold: false });
  items.push({ kind: 'core', id: 'core-b', price: 3, sold: false });
  items.push({ kind: 'defense', id: 'defense', price: 2, sold: false });
  return items;
}

export const POWER_PRICE = 1;

export function buyPower(c: Campaign): boolean {
  if (c.rep < POWER_PRICE || c.grid >= c.gridMax) return false;
  c.rep -= POWER_PRICE;
  c.grid++;
  return true;
}

export function buyItem(c: Campaign, i: number): boolean {
  const it = c.shop[i];
  if (!it || it.sold || c.rep < it.price) return false;
  c.rep -= it.price;
  it.sold = true;
  if (it.kind === 'weapon') c.inventory.push(it.id);
  if (it.kind === 'core') c.cores++;
  if (it.kind === 'defense') c.gridDef = Math.min(50, c.gridDef + 5);
  return true;
}

export function leaveShop(c: Campaign): void {
  c.shop = [];
  c.current = -1;
  c.phase = 'world';
}

// ------------------------------------------------------------------ hangar

export function weaponCost(id: string, up: boolean[]): number {
  const d = WEAPONS[id];
  return d.power + d.up.reduce((sum, u, i) => sum + (up[i] ? u.cost : 0), 0);
}

export function allocatedCores(c: Campaign): number {
  let n = 0;
  for (const m of c.mechs) for (const w of m.weapons) if (w) n += weaponCost(w.id, w.up);
  return n;
}

export function freeCores(c: Campaign): number {
  return c.cores - allocatedCores(c);
}

export function equipWeapon(c: Campaign, mech: number, slot: number, invIndex: number): string {
  const m = c.mechs[mech];
  const id = c.inventory[invIndex];
  if (!m || !id) return 'Invalid selection';
  const prev = m.weapons[slot];
  const refund = prev ? weaponCost(prev.id, prev.up) : 0;
  if (freeCores(c) + refund < WEAPONS[id].power) return `Needs ${WEAPONS[id].power} free reactor core${WEAPONS[id].power > 1 ? 's' : ''}`;
  c.inventory.splice(invIndex, 1);
  if (prev) c.inventory.push(prev.id);
  m.weapons[slot] = { id, up: [] };
  return '';
}

export function unequipWeapon(c: Campaign, mech: number, slot: number): string {
  const m = c.mechs[mech];
  const w = m?.weapons[slot];
  if (!w) return '';
  if (m.weapons.filter(Boolean).length <= 1) return 'A mech needs at least one weapon';
  c.inventory.push(w.id);
  m.weapons[slot] = null;
  return '';
}

export function toggleUpgrade(c: Campaign, mech: number, slot: number, upIdx: number): string {
  const w = c.mechs[mech]?.weapons[slot];
  if (!w) return '';
  const def = WEAPONS[w.id].up[upIdx];
  if (!def) return '';
  if (w.up[upIdx]) {
    w.up[upIdx] = false;
    return '';
  }
  if (freeCores(c) < def.cost) return `Needs ${def.cost} free reactor core${def.cost > 1 ? 's' : ''}`;
  w.up[upIdx] = true;
  return '';
}

export function swapPilot(c: Campaign, mech: number, reserveIdx: number): void {
  const m = c.mechs[mech];
  const p = c.reserve[reserveIdx];
  if (!m || !p) return;
  c.reserve.splice(reserveIdx, 1);
  if (!m.pilot.ai) c.reserve.push(m.pilot);
  m.pilot = p;
}
