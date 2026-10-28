export interface SquadPalette {
  main: string;
  dark: string;
  light: string;
  trim: string;
  glow: string;
}

export interface SquadDef {
  id: string;
  name: string;
  tagline: string;
  desc: string;
  mechs: { chassis: string; weapons: string[] }[];
  palette: SquadPalette;
  difficulty: string;
}

export const SQUADS: Record<string, SquadDef> = {
  ironclad: {
    id: 'ironclad',
    name: 'Ironclad',
    tagline: 'Punch. Shove. Bombard.',
    desc: 'A balanced squad that wins by shoving Vek into each other and off their firing lines.',
    mechs: [
      { chassis: 'brawler', weapons: ['fist'] },
      { chassis: 'cannon', weapons: ['cannon'] },
      { chassis: 'mortar', weapons: ['mortar'] },
    ],
    palette: { main: '#d9a441', dark: '#7a5320', light: '#f3d27a', trim: '#3b3f46', glow: '#7ff3ff' },
    difficulty: 'Recommended',
  },
  tempest: {
    id: 'tempest',
    name: 'Tempest',
    tagline: 'Throw. Pull. Swap.',
    desc: 'Manipulation specialists. Little raw damage — hurl Vek into water, chasms and each other instead.',
    mechs: [
      { chassis: 'judo', weapons: ['vice'] },
      { chassis: 'gravity', weapons: ['gravwell'] },
      { chassis: 'phase', weapons: ['swap', 'dome'] },
    ],
    palette: { main: '#4fc7c0', dark: '#1d5c62', light: '#b8f4ec', trim: '#e9eef2', glow: '#ffe066' },
    difficulty: 'Advanced',
  },
  inferno: {
    id: 'inferno',
    name: 'Inferno',
    tagline: 'Burn. Chain. Scorch.',
    desc: 'Fire-immune mechs that set the battlefield ablaze and chain lightning through packed Vek.',
    mechs: [
      { chassis: 'flame', weapons: ['flamer'] },
      { chassis: 'meteor', weapons: ['firestorm'] },
      { chassis: 'arc', weapons: ['whip'] },
    ],
    palette: { main: '#d8553a', dark: '#5e1f1a', light: '#ffb08a', trim: '#2b2b33', glow: '#ffd166' },
    difficulty: 'Intermediate',
  },
};
