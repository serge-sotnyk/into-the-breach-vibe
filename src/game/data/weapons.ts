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
  name: string;
  cost: number;
  desc: string;
  mod: UpgradeMod;
}

export interface WeaponDef extends WeaponFlags {
  id: string;
  name: string;
  kind: WKind;
  desc: string;
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

const BASE: Omit<WeaponDef, 'id' | 'name' | 'kind' | 'desc'> = {
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

type WIn = Partial<WeaponDef> & Pick<WeaponDef, 'id' | 'name' | 'kind' | 'desc'>;
const w = (d: WIn): WeaponDef => ({ ...BASE, ...d });

const dmgUp = (n: number, cost: number): Upgrade => ({
  name: `+${n} Damage`,
  cost,
  desc: `Increases damage by ${n}.`,
  mod: { dmgAdd: n },
});

export const WEAPONS: Record<string, WeaponDef> = {};

const list: WeaponDef[] = [
  // ------------------------------------------------------------ squad weapons
  w({
    id: 'fist', name: 'Piston Fist', kind: 'melee', dmg: 2, push: true, icon: 'fist', vfx: 'punch', price: 2,
    desc: 'Slam an adjacent tile with a hydraulic fist, pushing the target away.',
    up: [dmgUp(1, 2), dmgUp(1, 3)],
  }),
  w({
    id: 'cannon', name: 'Breaker Cannon', kind: 'projectile', dmg: 1, push: true, icon: 'cannon', vfx: 'shot', price: 2,
    desc: 'Fire a shell that strikes the first target in a line and pushes it.',
    up: [dmgUp(1, 2), dmgUp(1, 3)],
  }),
  w({
    id: 'mortar', name: 'Arc Mortar', kind: 'artillery', dmg: 1, pushAdj: true, minRange: 2, icon: 'mortar', vfx: 'arc', price: 2,
    desc: 'Lob a shell over obstacles. Damages the target and pushes the four adjacent tiles outward.',
    up: [
      { name: 'Buildings Immune', cost: 1, desc: 'This weapon no longer damages buildings.', mod: { set: { safeB: true } } },
      dmgUp(2, 3),
    ],
  }),
  w({
    id: 'vice', name: 'Vice Throw', kind: 'throw', dmg: 1, icon: 'grab', vfx: 'punch', price: 2,
    desc: 'Grab an adjacent unit and hurl it over your mech onto the tile behind, damaging it on landing.',
    up: [
      { name: 'Ally Immune', cost: 1, desc: 'Thrown allies take no damage.', mod: { set: { safeAlly: true } } },
      dmgUp(2, 3),
    ],
  }),
  w({
    id: 'gravwell', name: 'Grav Well', kind: 'grav', dmg: 0, minRange: 2, icon: 'grav', vfx: 'arc', price: 2,
    desc: 'Artillery graviton pulse that pulls the target one tile toward your mech.',
    up: [dmgUp(1, 2)],
  }),
  w({
    id: 'swap', name: 'Phase Swap', kind: 'swap', range: 2, icon: 'swap', vfx: 'swap', price: 2, power: 0,
    desc: 'Teleport to a tile in a line up to 2 away. Any unit there swaps places with you.',
    up: [
      { name: '+1 Range', cost: 1, desc: 'Teleport up to 3 tiles away.', mod: { rangeAdd: 1 } },
      { name: '+1 Range', cost: 2, desc: 'Teleport up to 4 tiles away.', mod: { rangeAdd: 1 } },
    ],
  }),
  w({
    id: 'dome', name: 'Shield Dome', kind: 'shieldArt', range: 3, minRange: 0, uses: 2, icon: 'shield', vfx: 'shield', power: 0, price: 2,
    desc: 'Project shields onto a tile and its four neighbors. Shields block one instance of damage — on mechs, Vek or buildings. 2 uses per battle.',
    up: [{ name: '+1 Use', cost: 2, desc: 'One extra use per battle.', mod: { usesAdd: 1 } }],
  }),
  w({
    id: 'flamer', name: 'Flamethrower', kind: 'flame', dmg: 0, range: 1, fire: true, push: true, icon: 'flame', vfx: 'flame', price: 2,
    desc: 'Spray fire in a line, igniting tiles and pushing the farthest target. Burning units take 1 damage every turn.',
    up: [
      { name: '+1 Range', cost: 1, desc: 'Sprays two tiles.', mod: { rangeAdd: 1 } },
      dmgUp(1, 3),
    ],
  }),
  w({
    id: 'firestorm', name: 'Firestorm Mortar', kind: 'artillery', dmg: 0, fire: true, pushAdj: true, minRange: 2, icon: 'mortar', vfx: 'arc', price: 2,
    desc: 'Lob an incendiary shell: ignites the target tile and pushes the adjacent tiles outward.',
    up: [
      { name: 'Buildings Immune', cost: 1, desc: 'This weapon no longer damages buildings.', mod: { set: { safeB: true } } },
      dmgUp(1, 2),
    ],
  }),
  w({
    id: 'whip', name: 'Arc Whip', kind: 'chain', dmg: 2, icon: 'bolt', vfx: 'bolt', price: 2,
    desc: 'Electrify an adjacent unit. The arc chains through every connected unit — allies included!',
    up: [
      { name: 'Ally Immune', cost: 1, desc: 'The arc no longer harms allied units.', mod: { set: { safeAlly: true } } },
      dmgUp(1, 3),
    ],
  }),

  // ------------------------------------------------------------ armory (shop / pods)
  w({
    id: 'rockets', name: 'Rocket Volley', kind: 'projectile', dmg: 2, push: true, smokeBehind: true, icon: 'rocket', vfx: 'shot', power: 1, price: 3,
    desc: 'Fire a heavy rocket at the first target in a line. The backblast leaves smoke behind your mech.',
    up: [dmgUp(1, 3)],
  }),
  w({
    id: 'beam', name: 'Burst Beam', kind: 'laser', dmg: 3, decay: true, icon: 'beam', vfx: 'beam', power: 1, price: 3,
    desc: 'Fire a piercing beam that hits every tile in a line until it strikes an obstacle. Damage drops by 1 per tile (minimum 1).',
    up: [
      { name: 'Ally Immune', cost: 1, desc: 'The beam passes harmlessly through allies.', mod: { set: { safeAlly: true } } },
      dmgUp(1, 3),
    ],
  }),
  w({
    id: 'ram', name: 'Ram Engines', kind: 'charge', dmg: 2, push: true, selfDmg: 1, icon: 'ram', vfx: 'punch', power: 1, price: 2,
    desc: 'Dash in a line and slam into the first obstacle, pushing it. Your mech takes 1 damage.',
    up: [dmgUp(1, 2), { name: 'Reinforced Hull', cost: 1, desc: 'No self damage.', mod: { selfAdd: -1 } }],
  }),
  w({
    id: 'leap', name: 'Thunder Leap', kind: 'leap', dmg: 1, adjDmg: 1, pushAdj: true, selfDmg: 1, range: 3, icon: 'leap', vfx: 'pulse', power: 1, price: 2,
    desc: 'Leap to a tile up to 3 away. On landing, damage and push all adjacent tiles. Your mech takes 1 damage.',
    up: [dmgUp(1, 2), { name: 'Shock Absorbers', cost: 1, desc: 'No self damage.', mod: { selfAdd: -1 } }],
  }),
  w({
    id: 'hook', name: 'Grapple Hook', kind: 'pull', icon: 'hook', vfx: 'hook', power: 0, price: 2,
    desc: 'Fire a hook. Units are dragged next to your mech; if it catches a mountain or building, your mech is pulled to it instead.',
  }),
  w({
    id: 'pulse', name: 'Shockwave Pulse', kind: 'repulse', dmg: 0, pushAdj: true, minRange: 0, icon: 'pulse', vfx: 'pulse', power: 1, price: 2,
    desc: 'Emit a shockwave that pushes all four adjacent tiles away from your mech.',
    up: [
      { name: 'Shield Self', cost: 1, desc: 'Also shields your mech.', mod: { set: { shieldSelf: true } } },
      dmgUp(1, 2),
    ],
  }),
  w({
    id: 'cryo', name: 'Cryo Lance', kind: 'cryo', minRange: 2, freeze: true, selfFreeze: true, icon: 'frost', vfx: 'frost', power: 1, price: 2,
    desc: 'Freeze a distant tile solid. Frozen units cannot act and ignore the next hit. Also freezes your own mech.',
    up: [{ name: 'Self Immune', cost: 1, desc: 'Your mech is no longer frozen.', mod: { set: { selfFreeze: false } } }],
  }),
  w({
    id: 'gale', name: 'Gale Generator', kind: 'wind', uses: 1, icon: 'wind', vfx: 'wind', power: 1, price: 3,
    desc: 'Unleash a hurricane that pushes every unit on the board one tile in the chosen direction. 1 use per battle.',
    up: [{ name: '+1 Use', cost: 2, desc: 'One extra use per battle.', mod: { usesAdd: 1 } }],
  }),
  w({
    id: 'acidmortar', name: 'Acid Mortar', kind: 'artillery', dmg: 0, acid: true, pushAdj: true, minRange: 2, icon: 'acid', vfx: 'arc', power: 1, price: 2,
    desc: 'Douse the target in A.C.I.D. (doubles all weapon damage it takes) and push adjacent tiles.',
    up: [dmgUp(1, 2)],
  }),
  w({
    id: 'aegis', name: 'Aegis Bash', kind: 'melee', dmg: 1, flip: true, icon: 'aegis', vfx: 'punch', power: 1, price: 3,
    desc: 'Bash an adjacent enemy and reverse the direction of its queued attack.',
    up: [dmgUp(1, 2)],
  }),
  w({
    id: 'cluster', name: 'Cluster Mortar', kind: 'artillery', dmg: 1, cluster: true, pushAdj: true, minRange: 2, icon: 'cluster', vfx: 'arc', power: 1, price: 3,
    desc: 'Bomblets damage the four tiles around the target and push them outward. The center is untouched.',
    up: [
      { name: 'Buildings Immune', cost: 1, desc: 'No longer damages buildings.', mod: { set: { safeB: true } } },
      dmgUp(1, 3),
    ],
  }),
  w({
    id: 'smokerun', name: 'Smoke Run', kind: 'smokeRun', dmg: 0, range: 4, minRange: 2, smoke: true, icon: 'smoke', vfx: 'shot', power: 0, price: 2,
    desc: 'Fly over a line of tiles, blanketing them in smoke. Units in smoke cannot attack.',
    up: [dmgUp(1, 2)],
  }),

  w({
    id: 'tankgun', name: 'Light Cannon', kind: 'projectile', dmg: 1, push: true, icon: 'cannon', vfx: 'shot',
    desc: 'A light shell that strikes the first target in a line and pushes it.',
  }),

  // ------------------------------------------------------------ hive weapons
  w({ id: 'e_jab', name: 'Stinger Jab', kind: 'melee', enemy: true, icon: 'claw', vfx: 'punch', desc: 'Stabs an adjacent tile.' }),
  w({ id: 'e_bite', name: 'Mandibles', kind: 'melee', enemy: true, icon: 'claw', vfx: 'punch', desc: 'Bites an adjacent tile.' }),
  w({ id: 'e_spit', name: 'Magma Spit', kind: 'projectile', enemy: true, icon: 'spit', vfx: 'spit', desc: 'Spits a glob at the first target in a line.' }),
  w({ id: 'e_lob', name: 'Chitin Mortar', kind: 'artillery', minRange: 2, enemy: true, icon: 'mortar', vfx: 'arc', desc: 'Lobs a bone shard over obstacles at a distant tile.' }),
  w({ id: 'e_leap', name: 'Pounce', kind: 'melee', web: true, enemy: true, icon: 'claw', vfx: 'punch', desc: 'Webs an adjacent target so it cannot move, then strikes it.' }),
  w({ id: 'e_ram', name: 'Horn Charge', kind: 'charge', push: true, enemy: true, icon: 'ram', vfx: 'punch', desc: 'Charges in a line and rams the first thing it hits, pushing it.' }),
  w({ id: 'e_sting', name: 'Webbing Sting', kind: 'melee', web: true, enemy: true, icon: 'claw', vfx: 'punch', desc: 'Webs an adjacent target so it cannot move, then stings it.' }),
  w({ id: 'e_acid', name: 'Acid Bile', kind: 'projectile', acid: true, splash: true, enemy: true, icon: 'acid', vfx: 'spit', desc: 'Spews bile that damages the first target in a line and its two side tiles, coating them in A.C.I.D.' }),
  w({ id: 'e_egg', name: 'Egg Toss', kind: 'eggToss', minRange: 2, range: 3, enemy: true, icon: 'egg', vfx: 'arc', desc: 'Throws an egg that hatches into a Hatchling after a turn. If the tile is occupied, the egg bursts for 1 damage.' }),
  w({ id: 'e_blob', name: 'Blob Lob', kind: 'blobToss', minRange: 2, range: 3, enemy: true, icon: 'egg', vfx: 'arc', desc: 'Lobs a volatile blob that explodes next turn. If the tile is occupied, it bursts for 1 damage.' }),
  w({ id: 'e_explode', name: 'Rupture', kind: 'explode', minRange: 0, enemy: true, icon: 'burst', vfx: 'explode', desc: 'Explodes, damaging all four adjacent tiles.' }),
  w({ id: 'e_sweep', name: 'Razor Sweep', kind: 'melee', sweep: true, enemy: true, icon: 'claw', vfx: 'punch', desc: 'Slashes the tile ahead and both tiles beside it.' }),
  w({ id: 'e_siege', name: 'Siege Spore', kind: 'artillery', minRange: 2, adjDmg: 1, enemy: true, icon: 'mortar', vfx: 'arc', desc: 'Lobs a massive spore: heavy damage on the target, 1 damage to adjacent tiles.' }),
  w({ id: 'e_jug', name: 'Juggernaut Charge', kind: 'charge', push: true, enemy: true, icon: 'ram', vfx: 'punch', desc: 'An unstoppable charge that rams the first thing in its path.' }),
  w({ id: 'e_barrage', name: 'Brood Barrage', kind: 'artillery', minRange: 2, enemy: true, icon: 'mortar', vfx: 'arc', desc: 'Hurls a hardened egg sac at a distant tile.' }),
  w({ id: 'e_psy', name: 'Psychic Lance', kind: 'projectile', enemy: true, icon: 'beam', vfx: 'beam', desc: 'Fires a psychic beam that strikes the first unit or obstacle in a line. Body-block it to protect what lies behind.' }),
  w({ id: 'none', name: 'No Attack', kind: 'none', enemy: true, icon: 'none', vfx: 'shot', desc: 'This unit does not attack.' }),
];

for (const d of list) WEAPONS[d.id] = d;

/** Weapons that can appear in shops and time pods. */
export const ARMORY: string[] = list.filter((d) => !d.enemy && d.price > 0).map((d) => d.id);
