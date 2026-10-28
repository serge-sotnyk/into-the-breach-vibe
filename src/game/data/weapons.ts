import type { Vfx } from '../types';

export type WKind =
  | 'melee'
  | 'projectile'
  | 'artillery'
  | 'laser'
  | 'charge'
  | 'leap'
  | 'pull'
  | 'grav'
  | 'throw'
  | 'repulse'
  | 'swap'
  | 'shieldArt'
  | 'smokeRun'
  | 'chain'
  | 'flame'
  | 'cryo'
  | 'wind'
  | 'eggToss'
  | 'blobToss'
  | 'explode'
  | 'none';

export interface WeaponFlags {
  push: boolean;
  pushAdj: boolean;
  fire: boolean;
  acid: boolean;
  smoke: boolean;
  freeze: boolean;
  safeB: boolean;
  safeAlly: boolean;
  sweep: boolean;
  splash: boolean;
  web: boolean;
  flip: boolean;
  cluster: boolean;
  selfFreeze: boolean;
  smokeBehind: boolean;
  decay: boolean;
  shieldSelf: boolean;
}

export interface UpgradeMod {
  dmgAdd?: number;
  rangeAdd?: number;
  usesAdd?: number;
  adjAdd?: number;
  selfAdd?: number;
  set?: Partial<WeaponFlags>;
}

export interface Upgrade {
  /** text comes from a shared template instead of the weapon's own keys */
  tpl?: 'damage';
  cost: number;
  mod: UpgradeMod;
}

export interface WeaponDef extends WeaponFlags {
  id: string;
  kind: WKind;
  dmg: number;
  adjDmg: number;
  selfDmg: number;
  range: number;
  minRange: number;
  uses: number;
  power: number;
  price: number;
  icon: string;
  vfx: Vfx;
  up: Upgrade[];
  enemy: boolean;
}

const BASE: Omit<WeaponDef, 'id' | 'kind'> = {
  dmg: 0,
  adjDmg: 0,
  selfDmg: 0,
  range: 7,
  minRange: 1,
  uses: -1,
  power: 0,
  price: 0,
  icon: 'gun',
  vfx: 'shot',
  up: [],
  enemy: false,
  push: false,
  pushAdj: false,
  fire: false,
  acid: false,
  smoke: false,
  freeze: false,
  safeB: false,
  safeAlly: false,
  sweep: false,
  splash: false,
  web: false,
  flip: false,
  cluster: false,
  selfFreeze: false,
  smokeBehind: false,
  decay: false,
  shieldSelf: false,
};

type WIn = Partial<WeaponDef> & Pick<WeaponDef, 'id' | 'kind'>;
const w = (d: WIn): WeaponDef => ({ ...BASE, ...d });

const dmgUp = (n: number, cost: number): Upgrade => ({ tpl: 'damage', cost, mod: { dmgAdd: n } });

export const WEAPONS: Record<string, WeaponDef> = {};

const list: WeaponDef[] = [
  // ------------------------------------------------------------ squad weapons
  w({
    id: 'fist', kind: 'melee', dmg: 2, push: true, icon: 'fist', vfx: 'punch', price: 2,
    up: [dmgUp(1, 2), dmgUp(1, 3)],
  }),
  w({
    id: 'cannon', kind: 'projectile', dmg: 1, push: true, icon: 'cannon', vfx: 'shot', price: 2,
    up: [dmgUp(1, 2), dmgUp(1, 3)],
  }),
  w({
    id: 'mortar', kind: 'artillery', dmg: 1, pushAdj: true, minRange: 2, icon: 'mortar', vfx: 'arc', price: 2,
    up: [
      { cost: 1, mod: { set: { safeB: true } } },
      dmgUp(2, 3),
    ],
  }),
  w({
    id: 'vice', kind: 'throw', dmg: 1, icon: 'grab', vfx: 'punch', price: 2,
    up: [
      { cost: 1, mod: { set: { safeAlly: true } } },
      dmgUp(2, 3),
    ],
  }),
  w({
    id: 'gravwell', kind: 'grav', dmg: 0, minRange: 2, icon: 'grav', vfx: 'arc', price: 2,
    up: [dmgUp(1, 2)],
  }),
  w({
    id: 'swap', kind: 'swap', range: 2, icon: 'swap', vfx: 'swap', price: 2, power: 0,
    up: [
      { cost: 1, mod: { rangeAdd: 1 } },
      { cost: 2, mod: { rangeAdd: 1 } },
    ],
  }),
  w({
    id: 'dome', kind: 'shieldArt', range: 3, minRange: 0, uses: 2, icon: 'shield', vfx: 'shield', power: 0, price: 2,
    up: [{ cost: 2, mod: { usesAdd: 1 } }],
  }),
  w({
    id: 'flamer', kind: 'flame', dmg: 0, range: 1, fire: true, push: true, icon: 'flame', vfx: 'flame', price: 2,
    up: [
      { cost: 1, mod: { rangeAdd: 1 } },
      dmgUp(1, 3),
    ],
  }),
  w({
    id: 'firestorm', kind: 'artillery', dmg: 0, fire: true, pushAdj: true, minRange: 2, icon: 'mortar', vfx: 'arc', price: 2,
    up: [
      { cost: 1, mod: { set: { safeB: true } } },
      dmgUp(1, 2),
    ],
  }),
  w({
    id: 'whip', kind: 'chain', dmg: 2, icon: 'bolt', vfx: 'bolt', price: 2,
    up: [
      { cost: 1, mod: { set: { safeAlly: true } } },
      dmgUp(1, 3),
    ],
  }),

  // ------------------------------------------------------------ armory (shop / pods)
  w({
    id: 'rockets', kind: 'projectile', dmg: 2, push: true, smokeBehind: true, icon: 'rocket', vfx: 'shot', power: 1, price: 3,
    up: [dmgUp(1, 3)],
  }),
  w({
    id: 'beam', kind: 'laser', dmg: 3, decay: true, icon: 'beam', vfx: 'beam', power: 1, price: 3,
    up: [
      { cost: 1, mod: { set: { safeAlly: true } } },
      dmgUp(1, 3),
    ],
  }),
  w({
    id: 'ram', kind: 'charge', dmg: 2, push: true, selfDmg: 1, icon: 'ram', vfx: 'punch', power: 1, price: 2,
    up: [dmgUp(1, 2), { cost: 1, mod: { selfAdd: -1 } }],
  }),
  w({
    id: 'leap', kind: 'leap', dmg: 1, adjDmg: 1, pushAdj: true, selfDmg: 1, range: 3, icon: 'leap', vfx: 'pulse', power: 1, price: 2,
    up: [dmgUp(1, 2), { cost: 1, mod: { selfAdd: -1 } }],
  }),
  w({
    id: 'hook', kind: 'pull', icon: 'hook', vfx: 'hook', power: 0, price: 2,
  }),
  w({
    id: 'pulse', kind: 'repulse', dmg: 0, pushAdj: true, minRange: 0, icon: 'pulse', vfx: 'pulse', power: 1, price: 2,
    up: [
      { cost: 1, mod: { set: { shieldSelf: true } } },
      dmgUp(1, 2),
    ],
  }),
  w({
    id: 'cryo', kind: 'cryo', minRange: 2, freeze: true, selfFreeze: true, icon: 'frost', vfx: 'frost', power: 1, price: 2,
    up: [{ cost: 1, mod: { set: { selfFreeze: false } } }],
  }),
  w({
    id: 'gale', kind: 'wind', uses: 1, icon: 'wind', vfx: 'wind', power: 1, price: 3,
    up: [{ cost: 2, mod: { usesAdd: 1 } }],
  }),
  w({
    id: 'acidmortar', kind: 'artillery', dmg: 0, acid: true, pushAdj: true, minRange: 2, icon: 'acid', vfx: 'arc', power: 1, price: 2,
    up: [dmgUp(1, 2)],
  }),
  w({
    id: 'aegis', kind: 'melee', dmg: 1, flip: true, icon: 'aegis', vfx: 'punch', power: 1, price: 3,
    up: [dmgUp(1, 2)],
  }),
  w({
    id: 'cluster', kind: 'artillery', dmg: 1, cluster: true, pushAdj: true, minRange: 2, icon: 'cluster', vfx: 'arc', power: 1, price: 3,
    up: [
      { cost: 1, mod: { set: { safeB: true } } },
      dmgUp(1, 3),
    ],
  }),
  w({
    id: 'smokerun', kind: 'smokeRun', dmg: 0, range: 4, minRange: 2, smoke: true, icon: 'smoke', vfx: 'shot', power: 0, price: 2,
    up: [dmgUp(1, 2)],
  }),

  w({
    id: 'tankgun', kind: 'projectile', dmg: 1, push: true, icon: 'cannon', vfx: 'shot',
  }),

  // ------------------------------------------------------------ hive weapons
  w({ id: 'e_jab', kind: 'melee', enemy: true, icon: 'claw', vfx: 'punch' }),
  w({ id: 'e_bite', kind: 'melee', enemy: true, icon: 'claw', vfx: 'punch' }),
  w({ id: 'e_spit', kind: 'projectile', enemy: true, icon: 'spit', vfx: 'spit' }),
  w({ id: 'e_lob', kind: 'artillery', minRange: 2, enemy: true, icon: 'mortar', vfx: 'arc' }),
  w({ id: 'e_leap', kind: 'melee', web: true, enemy: true, icon: 'claw', vfx: 'punch' }),
  w({ id: 'e_ram', kind: 'charge', push: true, enemy: true, icon: 'ram', vfx: 'punch' }),
  w({ id: 'e_sting', kind: 'melee', web: true, enemy: true, icon: 'claw', vfx: 'punch' }),
  w({ id: 'e_acid', kind: 'projectile', acid: true, splash: true, enemy: true, icon: 'acid', vfx: 'spit' }),
  w({ id: 'e_egg', kind: 'eggToss', minRange: 2, range: 3, enemy: true, icon: 'egg', vfx: 'arc' }),
  w({ id: 'e_blob', kind: 'blobToss', minRange: 2, range: 3, enemy: true, icon: 'egg', vfx: 'arc' }),
  w({ id: 'e_explode', kind: 'explode', minRange: 0, enemy: true, icon: 'burst', vfx: 'explode' }),
  w({ id: 'e_sweep', kind: 'melee', sweep: true, enemy: true, icon: 'claw', vfx: 'punch' }),
  w({ id: 'e_siege', kind: 'artillery', minRange: 2, adjDmg: 1, enemy: true, icon: 'mortar', vfx: 'arc' }),
  w({ id: 'e_jug', kind: 'charge', push: true, enemy: true, icon: 'ram', vfx: 'punch' }),
  w({ id: 'e_barrage', kind: 'artillery', minRange: 2, enemy: true, icon: 'mortar', vfx: 'arc' }),
  w({ id: 'e_psy', kind: 'projectile', enemy: true, icon: 'beam', vfx: 'beam' }),
  w({ id: 'none', kind: 'none', enemy: true, icon: 'none', vfx: 'shot' }),
];

for (const d of list) WEAPONS[d.id] = d;

/** Weapons that can appear in shops and time pods. */
export const ARMORY: string[] = list.filter((d) => !d.enemy && d.price > 0).map((d) => d.id);
