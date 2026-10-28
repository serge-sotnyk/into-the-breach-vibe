import type { ObjKind, Objective } from '../types';
import { UNITS } from './units';

export interface IslandDef {
  id: string;
  name: string;
  corp: string;
  ceo: string;
  desc: string;
  pool: string[];
  boss: string;
  hazards: string[];
  regions: string[];
  hq: string;
}

export const ISLANDS: IslandDef[] = [
  {
    id: 'verdant',
    name: 'Verdant Reach',
    corp: 'Archon Agricultural',
    ceo: 'Director Imani Hale',
    desc: 'Terraced farmland, forests and rivers. Archon feeds what is left of humanity.',
    pool: ['wasp', 'spitter', 'beetle', 'leaper', 'stinger'],
    boss: 'boss_matriarch',
    hazards: ['airstrike', 'lightning', 'tidal'],
    regions: ['Old Orchard', 'Mill Valley', 'Riverbend', 'Seed Vault', 'Greenhollow', 'Pinecrest'],
    hq: 'Archon Granary',
  },
  {
    id: 'dune',
    name: 'Dune Sprawl',
    corp: 'Sandharbor Dynamics',
    ceo: 'Overseer Tomas Reyes',
    desc: 'Sun-blasted test ranges and fault lines. Sandharbor builds the grid’s turbines.',
    pool: ['beetle', 'rammer', 'crawler', 'wasp', 'spitter'],
    boss: 'boss_siege',
    hazards: ['seismic', 'sandstorm'],
    regions: ['Glass Flats', 'Rust Canyon', 'Mirage Basin', 'Turbine Row', 'Saltpan', 'Dustwell'],
    hq: 'Sandharbor Citadel',
  },
  {
    id: 'glacier',
    name: 'Glacier Spire',
    corp: 'Boreal Robotics',
    ceo: 'Chief Engineer Yuki Arden',
    desc: 'Frozen research archipelago where Boreal’s robots keep the cold fusion plants alive.',
    pool: ['rammer', 'stinger', 'spitter', 'leaper', 'brood'],
    boss: 'boss_jugg',
    hazards: ['icestorm', 'lightning'],
    regions: ['Frostgate', 'Cryo Labs', 'Whiteout Pass', 'Polar Array', 'Rime Harbor', 'Shard Fields'],
    hq: 'Boreal Core',
  },
  {
    id: 'cinder',
    name: 'Cinder Works',
    corp: 'Cinder Industrial',
    ceo: 'Foreman Odile Marsh',
    desc: 'Toxic refineries and slag pits. Cinder recycles the old world into the new.',
    pool: ['crawler', 'burster', 'brood', 'wasp', 'beetle'],
    boss: 'boss_queen',
    hazards: ['acidrain', 'seismic'],
    regions: ['Slag Pits', 'Refinery 9', 'Vat District', 'Scrapyard', 'Smelter Row', 'Tailings Dam'],
    hq: 'Cinder Foundry',
  },
];

export const FINAL_ISLAND = {
  id: 'caldera',
  name: 'Hive Caldera',
  desc: 'The volcanic heart of the Vek infestation. Plant the Breach Bomb and end this timeline’s nightmare.',
  pool: ['wasp', 'spitter', 'beetle', 'leaper', 'rammer', 'stinger', 'crawler', 'burster'],
  boss: 'boss_tyrant',
};

export interface HazardDef {
  id: string;
  name: string;
  desc: string;
}

export const HAZARDS: Record<string, HazardDef> = {
  airstrike: { id: 'airstrike', name: 'Air Support', desc: 'Allied bombers will strike the marked tiles for 3 damage. Push Vek onto them!' },
  lightning: { id: 'lightning', name: 'Lightning Storm', desc: 'Lightning will strike the marked tiles, destroying any unit standing there.' },
  tidal: { id: 'tidal', name: 'Tidal Wave', desc: 'Each turn the sea floods a strip of the map. Ground units on flooded tiles drown.' },
  seismic: { id: 'seismic', name: 'Seismic Activity', desc: 'Marked tiles will collapse into chasms. Ground units on them fall to their doom.' },
  sandstorm: { id: 'sandstorm', name: 'Sandstorm', desc: 'Marked tiles will be blanketed in smoke. Units in smoke cannot attack.' },
  icestorm: { id: 'icestorm', name: 'Ice Storm', desc: 'The marked area will freeze solid. Units are frozen and water turns to ice.' },
  acidrain: { id: 'acidrain', name: 'Acid Rain', desc: 'Marked tiles will be doused in A.C.I.D., doubling weapon damage dealt to units there.' },
  volcanic: { id: 'volcanic', name: 'Volcanic Rain', desc: 'Molten rocks will strike the marked tiles for 2 damage and set them ablaze.' },
};

export interface TerrainGen {
  water: [number, number];
  chasm: [number, number];
  mountain: [number, number];
  forest: [number, number];
  sand: [number, number];
  ice: [number, number];
  lava: [number, number];
  acid: [number, number];
  buildings: [number, number];
  tall: number;
}

export const TERRAIN_GEN: Record<string, TerrainGen> = {
  verdant: { water: [3, 6], chasm: [0, 0], mountain: [3, 5], forest: [4, 7], sand: [0, 0], ice: [0, 0], lava: [0, 0], acid: [0, 0], buildings: [8, 11], tall: 0.3 },
  dune: { water: [0, 2], chasm: [1, 3], mountain: [4, 6], forest: [0, 1], sand: [6, 10], ice: [0, 0], lava: [0, 0], acid: [0, 0], buildings: [8, 10], tall: 0.35 },
  glacier: { water: [3, 5], chasm: [0, 1], mountain: [4, 6], forest: [0, 2], sand: [0, 0], ice: [8, 12], lava: [0, 0], acid: [0, 0], buildings: [8, 10], tall: 0.4 },
  cinder: { water: [0, 2], chasm: [3, 5], mountain: [2, 4], forest: [0, 0], sand: [0, 0], ice: [0, 0], lava: [0, 0], acid: [3, 5], buildings: [9, 12], tall: 0.45 },
  caldera: { water: [0, 0], chasm: [1, 3], mountain: [4, 6], forest: [0, 0], sand: [0, 0], ice: [0, 0], lava: [5, 8], acid: [0, 0], buildings: [5, 7], tall: 0.5 },
};

export function objectiveLabel(o: Objective, bossDef = ''): string {
  switch (o.kind as ObjKind) {
    case 'kill':
      return `Kill at least ${o.n} enemies`;
    case 'relay':
      return 'Protect the Power Relay';
    case 'lab':
      return 'Protect the Research Lab';
    case 'lowdmg':
      return `Mechs take less than ${o.n} damage`;
    case 'block':
      return `Block ${o.n} enemy spawns`;
    case 'pod':
      return 'Recover the Time Pod';
    case 'tank':
      return 'Keep the Field Tank alive';
    case 'boss':
      return `Destroy the ${UNITS[bossDef]?.name ?? 'Hive leader'}`;
    case 'bomb':
      return 'Protect the Breach Bomb';
    case 'uplink':
      return 'Protect the Seismic Uplink';
  }
  return o.kind;
}

export function objectiveHint(kind: ObjKind): string {
  switch (kind) {
    case 'kill':
      return 'Every Vek destroyed counts, however it dies.';
    case 'relay':
      return 'The relay (yellow beacon) restores +1 Grid Power if it survives the battle.';
    case 'lab':
      return 'The lab (dish on the roof) is a 2-HP building. Do not let it be destroyed.';
    case 'lowdmg':
      return 'Counts all damage your mechs take, including bumps and fire.';
    case 'block':
      return 'Stand on a glowing spawn tile to stop a Vek from emerging (costs 1 HP).';
    case 'pod':
      return 'A time pod lands on turn 2. Move a mech onto it before the Vek destroy it.';
    case 'tank':
      return 'The tank is yours to command. It has only 1 HP.';
    case 'boss':
      return 'The leader is tough and massive — water will not drown it.';
    case 'bomb':
      return 'If the bomb is destroyed the timeline is lost.';
    case 'uplink':
      return 'The uplink is a fortified 2-HP building guiding the bomb drop.';
  }
  return '';
}
