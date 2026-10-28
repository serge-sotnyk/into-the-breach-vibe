export interface IslandDef {
  id: string;
  pool: string[];
  boss: string;
  hazards: string[];
  /** number of regular regions (the HQ comes on top) */
  regions: number;
}

export const ISLANDS: IslandDef[] = [
  {
    id: 'verdant',
    pool: ['wasp', 'spitter', 'beetle', 'leaper', 'stinger'],
    boss: 'boss_matriarch',
    hazards: ['airstrike', 'lightning', 'tidal'],
    regions: 6,
  },
  {
    id: 'dune',
    pool: ['beetle', 'rammer', 'crawler', 'wasp', 'spitter'],
    boss: 'boss_siege',
    hazards: ['seismic', 'sandstorm'],
    regions: 6,
  },
  {
    id: 'glacier',
    pool: ['rammer', 'stinger', 'spitter', 'leaper', 'brood'],
    boss: 'boss_jugg',
    hazards: ['icestorm', 'lightning'],
    regions: 6,
  },
  {
    id: 'cinder',
    pool: ['crawler', 'burster', 'brood', 'wasp', 'beetle'],
    boss: 'boss_queen',
    hazards: ['acidrain', 'seismic'],
    regions: 6,
  },
];

export const FINAL_ISLAND = {
  id: 'caldera',
  pool: ['wasp', 'spitter', 'beetle', 'leaper', 'rammer', 'stinger', 'crawler', 'burster'],
  boss: 'boss_tyrant',
};

export interface HazardDef {
  id: string;
}

export const HAZARDS: Record<string, HazardDef> = {
  airstrike: { id: 'airstrike' },
  lightning: { id: 'lightning' },
  tidal: { id: 'tidal' },
  seismic: { id: 'seismic' },
  sandstorm: { id: 'sandstorm' },
  icestorm: { id: 'icestorm' },
  acidrain: { id: 'acidrain' },
  volcanic: { id: 'volcanic' },
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
