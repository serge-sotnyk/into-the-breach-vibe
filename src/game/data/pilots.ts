export interface SkillDef {
  id: string;
  name: string;
  desc: string;
}

export const SKILLS: Record<string, SkillDef> = {
  armored: { id: 'armored', name: 'Bulwark', desc: 'Mech gains Armor: weapon damage it takes is reduced by 1.' },
  flying: { id: 'flying', name: 'Skyborne', desc: 'Mech gains Flying: hovers over water and chasms.' },
  afterburn: { id: 'afterburn', name: 'Afterburner', desc: 'Can still move after attacking, if the mech has not moved yet.' },
  medic: { id: 'medic', name: 'Field Medic', desc: 'Repair heals 2 HP and also heals adjacent allies for 1.' },
  shield: { id: 'shield', name: 'Phase Shield', desc: 'Mech starts every battle with a Shield.' },
  evasive: { id: 'evasive', name: 'Evasive', desc: 'Immune to webs and smoke.' },
  grid: { id: 'grid', name: 'Grid Specialist', desc: '+10% Grid Defense in every battle this pilot fights.' },
  fireproof: { id: 'fireproof', name: 'Fireproof', desc: 'Mech is immune to fire.' },
  swift: { id: 'swift', name: 'Swift', desc: 'Mech gains +1 Move.' },
  eject: { id: 'eject', name: 'Ejection Seat', desc: 'Survives when the mech is destroyed.' },
  veteran: { id: 'veteran', name: 'Veteran', desc: 'Earns double experience.' },
  tough: { id: 'tough', name: 'Ironwill', desc: 'Mech gains +2 max HP.' },
};

export const PILOT_POOL: { name: string; skill: string }[] = [
  { name: 'Mara Voss', skill: 'armored' },
  { name: 'Ike Tanaka', skill: 'flying' },
  { name: 'Rosa Quill', skill: 'afterburn' },
  { name: 'Dex Okafor', skill: 'medic' },
  { name: 'Juno Park', skill: 'shield' },
  { name: 'Camille Ruiz', skill: 'evasive' },
  { name: 'Sasha Kerr', skill: 'grid' },
  { name: 'Ozzie Brandt', skill: 'fireproof' },
  { name: 'Lena Moroz', skill: 'swift' },
  { name: 'Kofi Mensah', skill: 'eject' },
  { name: 'Ria Santos', skill: 'veteran' },
  { name: 'Ada Rook', skill: 'tough' },
];

/** XP needed to reach level 1 and level 2. */
export const LEVEL_XP = [6, 16];

export const LEVEL_PERKS = ['+2 Mech HP', '+1 Mech Move'];

export function levelFor(xp: number): number {
  return xp >= LEVEL_XP[1] ? 2 : xp >= LEVEL_XP[0] ? 1 : 0;
}
