export interface SquadPalette {
  main: string;
  dark: string;
  light: string;
  trim: string;
  glow: string;
}

export interface SquadDef {
  id: string;
  mechs: { chassis: string; weapons: string[] }[];
  palette: SquadPalette;
}

export const SQUADS: Record<string, SquadDef> = {
  ironclad: {
    id: 'ironclad',
    mechs: [
      { chassis: 'brawler', weapons: ['fist'] },
      { chassis: 'cannon', weapons: ['cannon'] },
      { chassis: 'mortar', weapons: ['mortar'] },
    ],
    palette: { main: '#d9a441', dark: '#7a5320', light: '#f3d27a', trim: '#3b3f46', glow: '#7ff3ff' },
  },
  tempest: {
    id: 'tempest',
    mechs: [
      { chassis: 'judo', weapons: ['vice'] },
      { chassis: 'gravity', weapons: ['gravwell'] },
      { chassis: 'phase', weapons: ['swap', 'dome'] },
    ],
    palette: { main: '#4fc7c0', dark: '#1d5c62', light: '#b8f4ec', trim: '#e9eef2', glow: '#ffe066' },
  },
  inferno: {
    id: 'inferno',
    mechs: [
      { chassis: 'flame', weapons: ['flamer'] },
      { chassis: 'meteor', weapons: ['firestorm'] },
      { chassis: 'arc', weapons: ['whip'] },
    ],
    palette: { main: '#d8553a', dark: '#5e1f1a', light: '#ffb08a', trim: '#2b2b33', glow: '#ffd166' },
  },
};
