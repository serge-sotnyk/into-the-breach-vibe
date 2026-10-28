export interface SkillDef {
  id: string;
}

export const SKILLS: Record<string, SkillDef> = {
  armored: { id: 'armored' },
  flying: { id: 'flying' },
  afterburn: { id: 'afterburn' },
  medic: { id: 'medic' },
  shield: { id: 'shield' },
  evasive: { id: 'evasive' },
  grid: { id: 'grid' },
  fireproof: { id: 'fireproof' },
  swift: { id: 'swift' },
  eject: { id: 'eject' },
  veteran: { id: 'veteran' },
  tough: { id: 'tough' },
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

export function levelFor(xp: number): number {
  return xp >= LEVEL_XP[1] ? 2 : xp >= LEVEL_XP[0] ? 1 : 0;
}
