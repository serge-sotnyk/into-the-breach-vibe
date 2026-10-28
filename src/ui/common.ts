import type { Pilot, Reward, Tile } from '../game/types';
import { UNITS } from '../game/data/units';
import { WEAPONS, type WeaponDef } from '../game/data/weapons';
import { SKILLS } from '../game/data/pilots';
import type { SquadPalette } from '../game/data/squads';
import { drawMech, drawPortrait, drawVek } from '../render/sprites';
import { icon } from './icons';

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function rewardChips(r: Reward): string {
  const out: string[] = [];
  if (r.rep) out.push(`<span class="chip rep" title="Reputation — spend it in the shop after securing an island">${icon('star')}${r.rep}</span>`);
  if (r.power) out.push(`<span class="chip power" title="Grid Power">${icon('bolt')}+${r.power}</span>`);
  if (r.core) out.push(`<span class="chip core" title="Reactor Core — powers weapons and upgrades">${icon('core')}${r.core}</span>`);
  if (r.pilot) out.push(`<span class="chip pilot" title="Chance of rescuing a time-travelling pilot">${icon('pilot')}?</span>`);
  return out.join('');
}

export function gridBar(cur: number, max: number, threat = 0): string {
  let s = '<span class="gridbar">';
  for (let i = 0; i < max; i++) {
    const on = i < cur;
    const th = on && i >= cur - threat;
    s += `<i class="${on ? 'on' : ''} ${th ? 'threat' : ''}"></i>`;
  }
  return `${s}</span>`;
}

export function pips(hp: number, max: number, enemy = false): string {
  let s = `<span class="pips ${enemy ? 'enemy' : ''}">`;
  for (let i = 0; i < max; i++) s += `<i class="${i < hp ? 'on' : ''}"></i>`;
  return `${s}</span>`;
}

export function weaponStats(w: WeaponDef): string {
  const bits: string[] = [];
  if (w.kind === 'chain' || w.kind === 'melee' || w.kind === 'projectile' || w.kind === 'artillery' || w.kind === 'laser' || w.kind === 'charge' || w.kind === 'throw' || w.kind === 'leap') {
    if (w.cluster) bits.push(`${w.dmg} dmg around target`);
    else if (w.dmg > 0) bits.push(`${w.dmg}${w.decay ? '→1' : ''} dmg`);
  } else if (w.dmg > 0) bits.push(`${w.dmg} dmg`);
  if (w.push) bits.push('push');
  if (w.pushAdj) bits.push('push adjacent');
  if (w.kind === 'grav' || w.kind === 'pull') bits.push('pull');
  if (w.fire) bits.push('fire');
  if (w.acid) bits.push('acid');
  if (w.freeze) bits.push('freeze');
  if (w.smoke || w.smokeBehind) bits.push('smoke');
  if (w.flip) bits.push('reverse attack');
  if (w.kind === 'swap') bits.push(`teleport ${w.range}`);
  if (w.kind === 'shieldArt') bits.push('shields');
  if (w.kind === 'wind') bits.push('push all');
  if (w.selfDmg) bits.push(`${w.selfDmg} self dmg`);
  if (w.safeB) bits.push('safe for buildings');
  if (w.uses > 0) bits.push(`${w.uses} use${w.uses > 1 ? 's' : ''}`);
  return bits.join(' · ');
}

export function weaponTooltip(id: string): string {
  const w = WEAPONS[id];
  if (!w) return '';
  return `${esc(w.name)}\n${w.desc}`;
}

export function spriteCanvas(def: string, pal: SquadPalette, px: number, scale = 1, t = 0.5): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = px * dpr;
  c.height = px * dpr;
  const ctx = c.getContext('2d')!;
  const d = UNITS[def];
  const k = (px / 80) * scale * dpr;
  ctx.setTransform(k, 0, 0, k, (px * dpr) / 2, px * dpr * 0.86);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!d) return c;
  const s = d.size ?? 1;
  ctx.scale(1 / Math.max(1, s * 0.9), 1 / Math.max(1, s * 0.9));
  if (d.kind === 'enemy') drawVek(ctx, d.sprite, { alpha: !!d.alpha, boss: !!d.boss, psion: d.psion }, t);
  else drawMech(ctx, d.sprite, pal, t);
  return c;
}

export function portraitCanvas(p: Pilot, px: number, accent: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = px * dpr;
  c.height = px * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawPortrait(ctx, px, px, p.look, p.ai, accent);
  return c;
}

export function skillLine(p: Pilot): string {
  if (p.ai) return '<span class="dim">Autopilot — no skill, cannot gain experience</span>';
  const s = SKILLS[p.skill];
  return s ? `<b class="amber">${esc(s.name)}</b> <span class="dim">— ${esc(s.desc)}</span>` : '';
}

export const TERRAIN_INFO: Record<string, [string, string]> = {
  ground: ['Ground', 'Open terrain.'],
  rubble: ['Rubble', 'Ruins of a building or mountain. Walkable.'],
  building: ['Civilian Building', 'Every point of damage drains 1 Grid Power. Bumping units into it damages it too!'],
  mountain: ['Mountain', 'Blocks movement and shots. Destroyed after 2 damage.'],
  water: ['Water', 'Non-flying Vek drown. Mechs survive but cannot fire weapons while submerged. Extinguishes fire.'],
  chasm: ['Chasm', 'Any non-flying unit that enters falls to its doom — mechs included.'],
  forest: ['Forest', 'Bursts into flames when damaged.'],
  sand: ['Sand', 'Turns into a cloud of smoke when damaged.'],
  ice: ['Ice', 'Cracks when damaged, then shatters into water.'],
  lava: ['Lava', 'Non-flying Vek are destroyed. Mechs survive but catch fire and cannot fire weapons.'],
};

export function tileExtras(t: Tile): string[] {
  const out: string[] = [];
  if (t.fire) out.push('<span class="tt-warn">On fire</span> — units here catch fire and take 1 damage each turn.');
  if (t.smoke) out.push('<b>Smoke</b> — units inside cannot attack or repair.');
  if (t.acid) out.push('<span class="green">A.C.I.D. pool</span> — the next unit to stop here takes double weapon damage.');
  if (t.shield === 'shield') out.push('<span class="cyan">Shielded</span> — blocks the next instance of damage.');
  if (t.shield === 'ice') out.push('<span class="cyan">Frozen</span> — the ice absorbs the next hit.');
  if (t.pod) out.push('<span class="cyan">Time Pod</span> — move a mech here to recover it. Vek will destroy it.');
  if (t.spawn) out.push('<span class="tt-warn">Vek emerging!</span> Stand here to block it (the blocker takes 1 damage).');
  return out;
}

export function fmtTime(ms: number): string {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

export function fmtDate(t: number): string {
  const d = new Date(t);
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}
