export interface ThemePal {
  sky: [string, string, string];
  sea: [string, string];
  ground: [string, string, string];
  speck: string;
  cliff: [string, string];
  water: [string, string];
  waterHi: string;
  forest: [string, string];
  trunk: string;
  sand: [string, string];
  ice: [string, string];
  mountain: [string, string, string];
  rubble: string;
  wall: [string, string];
  roof: [string, string];
  window: string;
  lava: [string, string];
  accent: string;
}

export const THEMES: Record<string, ThemePal> = {
  verdant: {
    sky: ['#0d1b24', '#16323a', '#244a46'],
    sea: ['#123845', '#0a1f29'],
    ground: ['#6f9a4c', '#4b6d35', '#3c5a2b'],
    speck: '#87b25f',
    cliff: ['#5d4a33', '#3f3223'],
    water: ['#2b7fa3', '#1d5f80'],
    waterHi: '#8fd4ef',
    forest: ['#2f6b39', '#1f4d29'],
    trunk: '#5a3d24',
    sand: ['#d8c27f', '#b59f5f'],
    ice: ['#bfe4f2', '#8cc3d8'],
    mountain: ['#9a8d78', '#776b59', '#5d5345'],
    rubble: '#6d6250',
    wall: ['#d9cdb4', '#b3a68b'],
    roof: ['#b2553c', '#8a3f2c'],
    window: '#ffd66b',
    lava: ['#ff7b2e', '#c13b16'],
    accent: '#c3e88d',
  },
  dune: {
    sky: ['#24160f', '#4a2c1a', '#7a4a26'],
    sea: ['#30484d', '#1b2a2e'],
    ground: ['#c9a463', '#a07f45', '#856836'],
    speck: '#dcbb7c',
    cliff: ['#7e5a35', '#5b4026'],
    water: ['#3c8c96', '#2a6a73'],
    waterHi: '#a8e3e6',
    forest: ['#6d7d3a', '#525e2b'],
    trunk: '#5a3d24',
    sand: ['#e8cf8f', '#c9ad6b'],
    ice: ['#cfe8ee', '#9cc8d4'],
    mountain: ['#b4825a', '#8d6243', '#6f4b33'],
    rubble: '#8b6a48',
    wall: ['#e6d3ad', '#c2ac84'],
    roof: ['#5f8f9a', '#47707a'],
    window: '#ffe08a',
    lava: ['#ff7b2e', '#c13b16'],
    accent: '#ffcf7a',
  },
  glacier: {
    sky: ['#0b1626', '#1b3150', '#33557a'],
    sea: ['#1c3a55', '#0e2236'],
    ground: ['#d7e6ee', '#a9bfcc', '#8ea7b6'],
    speck: '#f2f8fb',
    cliff: ['#6a7d8c', '#4b5b68'],
    water: ['#2a6fa0', '#1c5280'],
    waterHi: '#bfe7ff',
    forest: ['#2d5a4f', '#1f4239'],
    trunk: '#4a3a2c',
    sand: ['#d8c9a0', '#b8a87e'],
    ice: ['#bfeaff', '#86c5e3'],
    mountain: ['#8c9cab', '#6b7a88', '#55626e'],
    rubble: '#7d8a96',
    wall: ['#a9b8c6', '#8293a3'],
    roof: ['#3f5f82', '#2f4865'],
    window: '#9ff3ff',
    lava: ['#ff7b2e', '#c13b16'],
    accent: '#9fe6ff',
  },
  cinder: {
    sky: ['#120d10', '#2a1a1d', '#46282a'],
    sea: ['#253128', '#141c17'],
    ground: ['#7a7064', '#5a5148', '#4a433b'],
    speck: '#8d8478',
    cliff: ['#4d3f36', '#352b25'],
    water: ['#3f6f5d', '#2c5244'],
    waterHi: '#9fd6b8',
    forest: ['#4b5d36', '#36452a'],
    trunk: '#3d2d22',
    sand: ['#a39070', '#857356'],
    ice: ['#c6dde4', '#93b6c0'],
    mountain: ['#6e625a', '#554b45', '#433b36'],
    rubble: '#5e544b',
    wall: ['#8b8378', '#6c655c'],
    roof: ['#a8632f', '#7f4a22'],
    window: '#ffb648',
    lava: ['#ff7b2e', '#c13b16'],
    accent: '#ffb648',
  },
  caldera: {
    sky: ['#14070a', '#3a0f12', '#6b1d14'],
    sea: ['#3a0d08', '#1c0504'],
    ground: ['#4a3b3a', '#352a29', '#2a2120'],
    speck: '#5e4a47',
    cliff: ['#2e2120', '#1d1514'],
    water: ['#2b5f7a', '#1d4258'],
    waterHi: '#9fd6ef',
    forest: ['#3d4a2c', '#2b3520'],
    trunk: '#3d2d22',
    sand: ['#7a6450', '#5d4b3c'],
    ice: ['#c6dde4', '#93b6c0'],
    mountain: ['#5a4644', '#443533', '#352927'],
    rubble: '#4a3b39',
    wall: ['#6a6170', '#4f4856'],
    roof: ['#2e2a36', '#221f29'],
    window: '#ff7b54',
    lava: ['#ff8a2e', '#c43a12'],
    accent: '#ff7b54',
  },
};

export function theme(id: string): ThemePal {
  return THEMES[id] ?? THEMES.verdant;
}

/** Simple deterministic hash -> [0,1). */
export function hash01(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
