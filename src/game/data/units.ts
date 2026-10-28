export type PsionKind = 'shell' | 'regen' | 'blast' | 'tyrant';

export interface UnitDef {
  id: string;
  name: string;
  kind: 'mech' | 'enemy' | 'npc';
  hp: number;
  move: number;
  desc: string;
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
add({ id: 'brawler', name: 'Brawler Mech', kind: 'mech', cls: 'Prime', hp: 3, move: 3, massive: true, sprite: 'brawler',
  desc: 'Front-line bruiser built to punch Vek away from the city.' });
add({ id: 'cannon', name: 'Cannon Mech', kind: 'mech', cls: 'Brute', hp: 3, move: 3, massive: true, sprite: 'cannon',
  desc: 'Tracked gun platform. Excels at shoving targets from across the map.' });
add({ id: 'mortar', name: 'Mortar Mech', kind: 'mech', cls: 'Ranged', hp: 2, move: 3, massive: true, sprite: 'mortar',
  desc: 'Light artillery frame that strikes over obstacles and scatters the Vek.' });

add({ id: 'judo', name: 'Judo Mech', kind: 'mech', cls: 'Prime', hp: 4, move: 4, massive: true, armored: true, sprite: 'judo',
  desc: 'Armored grappler. Weapon damage against it is reduced by 1.' });
add({ id: 'gravity', name: 'Gravity Mech', kind: 'mech', cls: 'Science', hp: 3, move: 4, massive: true, flying: true, sprite: 'gravity',
  desc: 'Hovering graviton projector. Flies over water and chasms.' });
add({ id: 'phase', name: 'Phase Mech', kind: 'mech', cls: 'Science', hp: 2, move: 4, massive: true, flying: true, sprite: 'phase',
  desc: 'Experimental teleporter with a shield projector. Flies over water and chasms.' });

add({ id: 'flame', name: 'Flame Mech', kind: 'mech', cls: 'Prime', hp: 3, move: 3, massive: true, fireImmune: true, sprite: 'flame',
  desc: 'Thermal-hardened assault frame. Immune to fire.' });
add({ id: 'meteor', name: 'Meteor Mech', kind: 'mech', cls: 'Ranged', hp: 3, move: 3, massive: true, fireImmune: true, sprite: 'meteor',
  desc: 'Incendiary artillery walker. Immune to fire.' });
add({ id: 'arc', name: 'Arc Mech', kind: 'mech', cls: 'Brute', hp: 3, move: 3, massive: true, fireImmune: true, sprite: 'arc',
  desc: 'Tesla-coil brawler whose lightning leaps between bodies. Immune to fire.' });

// ------------------------------------------------------------------ the Hive (Vek)
function vek(
  id: string,
  name: string,
  hp: number,
  move: number,
  weapon: string,
  dmg: number,
  desc: string,
  extra: Partial<UnitDef> = {},
): void {
  add({ id, name, kind: 'enemy', hp, move, weapon, dmg, desc, sprite: extra.sprite ?? id.replace(/_a$/, ''), ...extra });
}

vek('wasp', 'Wasp', 2, 5, 'e_jab', 1, 'Fast flyer that stabs adjacent targets.', { flying: true });
vek('wasp_a', 'Alpha Wasp', 4, 5, 'e_jab', 2, 'Larger, deadlier Wasp.', { flying: true, alpha: true });
vek('spitter', 'Spitter', 3, 2, 'e_spit', 1, 'Spits magma at the first target in a straight line.');
vek('spitter_a', 'Alpha Spitter', 5, 2, 'e_spit', 3, 'Its spit can level a building in one shot.', { alpha: true });
vek('beetle', 'Mortar Beetle', 2, 3, 'e_lob', 1, 'Artillery bug: lobs shards over obstacles.');
vek('beetle_a', 'Alpha Mortar Beetle', 4, 3, 'e_lob', 3, 'Heavy artillery bug.', { alpha: true });
vek('leaper', 'Leaper', 1, 4, 'e_leap', 3, 'Fragile but vicious. Webs its prey before striking.');
vek('leaper_a', 'Alpha Leaper', 3, 4, 'e_leap', 5, 'Webs its prey and strikes with crushing force.', { alpha: true });
vek('rammer', 'Rammer', 4, 3, 'e_ram', 1, 'Armored beetle that charges in straight lines.');
vek('rammer_a', 'Alpha Rammer', 5, 3, 'e_ram', 3, 'A living battering ram.', { alpha: true });
vek('stinger', 'Stinger', 3, 3, 'e_sting', 1, 'Scorpion-like Vek. Webs its target in place.');
vek('stinger_a', 'Alpha Stinger', 5, 3, 'e_sting', 3, 'Webs and impales its target.', { alpha: true });
vek('crawler', 'Acid Crawler', 3, 2, 'e_acid', 1, 'Centipede that spews A.C.I.D. in a three-tile splash.');
vek('crawler_a', 'Alpha Acid Crawler', 5, 2, 'e_acid', 2, 'Its bile eats through armor.', { alpha: true });
vek('brood', 'Brood Mother', 2, 2, 'e_egg', 1, 'Throws eggs that hatch into Hatchlings.');
vek('brood_a', 'Alpha Brood Mother', 4, 2, 'e_egg', 1, 'Prolific egg-layer.', { alpha: true });
vek('burster', 'Burster', 3, 2, 'e_blob', 1, 'Lobs volatile blobs that explode the following turn.');
vek('burster_a', 'Alpha Burster', 4, 2, 'e_blob', 3, 'Its blobs detonate with tremendous force.', { alpha: true });

vek('hatchling', 'Hatchling', 1, 3, 'e_bite', 1, 'Newborn Vek. Weak but numerous.', { noSpawn: true });
vek('egg', 'Vek Egg', 1, 0, 'none', 0, 'Hatches into a Hatchling after one turn. Destroy it first!', { noSpawn: true, egg: true, stable: true });
vek('blob', 'Volatile Blob', 1, 0, 'e_explode', 1, 'Explodes at the end of the enemy turn, damaging adjacent tiles.', { noSpawn: true, stable: true });
vek('blob_a', 'Alpha Blob', 1, 0, 'e_explode', 3, 'A blob that detonates for heavy damage.', { noSpawn: true, stable: true, alpha: true, sprite: 'blob' });

vek('psion_shell', 'Shell Psion', 2, 2, 'none', 0, 'Psychic leader. While alive, all other Vek are Armored (weapon damage reduced by 1).', { flying: true, psion: 'shell', sprite: 'psion' });
vek('psion_regen', 'Blood Psion', 2, 2, 'none', 0, 'Psychic leader. While alive, all other Vek heal 1 HP every turn.', { flying: true, psion: 'regen', sprite: 'psion' });
vek('psion_blast', 'Blast Psion', 2, 2, 'none', 0, 'Psychic leader. While alive, Vek explode on death, damaging adjacent tiles.', { flying: true, psion: 'blast', sprite: 'psion' });
vek('psion_tyrant', 'Tyrant Psion', 3, 2, 'none', 0, 'Psychic overlord. While alive, deals 1 damage to every mech each turn.', { flying: true, psion: 'tyrant', sprite: 'psion', noSpawn: true });

vek('boss_matriarch', 'Hive Matriarch', 6, 4, 'e_sweep', 2, 'Leader of the swarm. Slashes three tiles at once.', { flying: true, massive: true, boss: true, size: 1.35, sprite: 'wasp' });
vek('boss_siege', 'Siege Titan', 6, 2, 'e_siege', 3, 'Colossal artillery beast. Its spores splash adjacent tiles.', { massive: true, boss: true, size: 1.35, sprite: 'beetle' });
vek('boss_jugg', 'Juggernaut', 6, 3, 'e_jug', 3, 'Armored charging leader. Weapon damage against it is reduced by 1.', { massive: true, armored: true, boss: true, size: 1.35, sprite: 'rammer' });
vek('boss_queen', 'Brood Queen', 6, 2, 'e_barrage', 2, 'Hurls egg sacs and lays a new egg beside herself every turn.', { massive: true, boss: true, size: 1.35, sprite: 'brood' });
vek('boss_tyrant', 'Hive Tyrant', 9, 2, 'e_psy', 3, 'The heart of the Hive. Its psychic lance strikes the first thing in its path — push the Tyrant or block the beam.', { massive: true, boss: true, size: 1.5, sprite: 'tyrant', noSpawn: true });

// ------------------------------------------------------------------ allied & neutral
add({ id: 'tank', name: 'Field Tank', kind: 'npc', hp: 1, move: 3, massive: false, controllable: true, weapons: ['tankgun'], sprite: 'tank',
  desc: 'Archive militia tank under your command. Keep it alive.' });
add({ id: 'bomb', name: 'Breach Bomb', kind: 'npc', hp: 4, move: 0, stable: true, massive: true, armored: true, sprite: 'bomb',
  desc: 'The device that will collapse the Hive. Armored: weapon damage against it is reduced by 1. If it is destroyed, the timeline is lost.' });

export function unitName(def: string): string {
  return UNITS[def]?.name ?? def;
}
