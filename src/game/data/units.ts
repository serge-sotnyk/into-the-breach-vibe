export type PsionKind = 'shell' | 'regen' | 'blast' | 'tyrant';

export interface UnitDef {
  id: string;
  kind: 'mech' | 'enemy' | 'npc';
  hp: number;
  move: number;
  sprite: string;
  flying?: boolean;
  massive?: boolean;
  armored?: boolean;
  stable?: boolean;
  fireImmune?: boolean;
  weapon?: string;
  dmg?: number;
  cls?: string;
  alpha?: boolean;
  boss?: boolean;
  psion?: PsionKind;
  size?: number;
  noSpawn?: boolean;
  egg?: boolean;
  controllable?: boolean;
  weapons?: string[];
}

export const UNITS: Record<string, UnitDef> = {};

function add(d: UnitDef): void {
  UNITS[d.id] = d;
}

// ------------------------------------------------------------------ mech chassis
add({ id: 'brawler', kind: 'mech', cls: 'Prime', hp: 3, move: 3, massive: true, sprite: 'brawler' });
add({ id: 'cannon', kind: 'mech', cls: 'Brute', hp: 3, move: 3, massive: true, sprite: 'cannon' });
add({ id: 'mortar', kind: 'mech', cls: 'Ranged', hp: 2, move: 3, massive: true, sprite: 'mortar' });

add({ id: 'judo', kind: 'mech', cls: 'Prime', hp: 4, move: 4, massive: true, armored: true, sprite: 'judo' });
add({ id: 'gravity', kind: 'mech', cls: 'Science', hp: 3, move: 4, massive: true, flying: true, sprite: 'gravity' });
add({ id: 'phase', kind: 'mech', cls: 'Science', hp: 2, move: 4, massive: true, flying: true, sprite: 'phase' });

add({ id: 'flame', kind: 'mech', cls: 'Prime', hp: 3, move: 3, massive: true, fireImmune: true, sprite: 'flame' });
add({ id: 'meteor', kind: 'mech', cls: 'Ranged', hp: 3, move: 3, massive: true, fireImmune: true, sprite: 'meteor' });
add({ id: 'arc', kind: 'mech', cls: 'Brute', hp: 3, move: 3, massive: true, fireImmune: true, sprite: 'arc' });

// ------------------------------------------------------------------ the Hive (Vek)
function vek(
  id: string,
  hp: number,
  move: number,
  weapon: string,
  dmg: number,
  extra: Partial<UnitDef> = {},
): void {
  add({ id, kind: 'enemy', hp, move, weapon, dmg, sprite: extra.sprite ?? id.replace(/_a$/, ''), ...extra });
}

vek('wasp', 2, 5, 'e_jab', 1, { flying: true });
vek('wasp_a', 4, 5, 'e_jab', 2, { flying: true, alpha: true });
vek('spitter', 3, 2, 'e_spit', 1);
vek('spitter_a', 5, 2, 'e_spit', 3, { alpha: true });
vek('beetle', 2, 3, 'e_lob', 1);
vek('beetle_a', 4, 3, 'e_lob', 3, { alpha: true });
vek('leaper', 1, 4, 'e_leap', 3);
vek('leaper_a', 3, 4, 'e_leap', 5, { alpha: true });
vek('rammer', 4, 3, 'e_ram', 1);
vek('rammer_a', 5, 3, 'e_ram', 3, { alpha: true });
vek('stinger', 3, 3, 'e_sting', 1);
vek('stinger_a', 5, 3, 'e_sting', 3, { alpha: true });
vek('crawler', 3, 2, 'e_acid', 1);
vek('crawler_a', 5, 2, 'e_acid', 2, { alpha: true });
vek('brood', 2, 2, 'e_egg', 1);
vek('brood_a', 4, 2, 'e_egg', 1, { alpha: true });
vek('burster', 3, 2, 'e_blob', 1);
vek('burster_a', 4, 2, 'e_blob', 3, { alpha: true });

vek('hatchling', 1, 3, 'e_bite', 1, { noSpawn: true });
vek('egg', 1, 0, 'none', 0, { noSpawn: true, egg: true, stable: true });
vek('blob', 1, 0, 'e_explode', 1, { noSpawn: true, stable: true });
vek('blob_a', 1, 0, 'e_explode', 3, { noSpawn: true, stable: true, alpha: true, sprite: 'blob' });

vek('psion_shell', 2, 2, 'none', 0, { flying: true, psion: 'shell', sprite: 'psion' });
vek('psion_regen', 2, 2, 'none', 0, { flying: true, psion: 'regen', sprite: 'psion' });
vek('psion_blast', 2, 2, 'none', 0, { flying: true, psion: 'blast', sprite: 'psion' });
vek('psion_tyrant', 3, 2, 'none', 0, { flying: true, psion: 'tyrant', sprite: 'psion', noSpawn: true });

vek('boss_matriarch', 6, 4, 'e_sweep', 2, { flying: true, massive: true, boss: true, size: 1.35, sprite: 'wasp' });
vek('boss_siege', 6, 2, 'e_siege', 3, { massive: true, boss: true, size: 1.35, sprite: 'beetle' });
vek('boss_jugg', 6, 3, 'e_jug', 3, { massive: true, armored: true, boss: true, size: 1.35, sprite: 'rammer' });
vek('boss_queen', 6, 2, 'e_barrage', 2, { massive: true, boss: true, size: 1.35, sprite: 'brood' });
vek('boss_tyrant', 9, 2, 'e_psy', 3, { massive: true, boss: true, size: 1.5, sprite: 'tyrant', noSpawn: true });

// ------------------------------------------------------------------ allied & neutral
add({ id: 'tank', kind: 'npc', hp: 1, move: 3, massive: false, controllable: true, weapons: ['tankgun'], sprite: 'tank' });
add({ id: 'bomb', kind: 'npc', hp: 4, move: 0, stable: true, massive: true, armored: true, sprite: 'bomb' });
