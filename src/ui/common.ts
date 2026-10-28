import type { Pilot, Reward, Tile } from '../game/types';
import { UNITS } from '../game/data/units';
import { WEAPONS, type WeaponDef } from '../game/data/weapons';
import { SKILLS } from '../game/data/pilots';
import { t, tn } from '../i18n';
import { skillDesc, skillName, weaponDesc, weaponName } from '../i18n/names';
import type { SquadPalette } from '../game/data/squads';
import { drawMech, drawPortrait, drawVek } from '../render/sprites';
import { icon } from './icons';

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function rewardChips(r: Reward): string {
  const out: string[] = [];
  if (r.rep) out.push(`<span class="chip rep" title="${esc(t('reward.rep'))}">${icon('star')}${r.rep}</span>`);
  if (r.power) out.push(`<span class="chip power" title="${esc(t('reward.power'))}">${icon('bolt')}+${r.power}</span>`);
  if (r.core) out.push(`<span class="chip core" title="${esc(t('reward.core'))}">${icon('core')}${r.core}</span>`);
  if (r.pilot) out.push(`<span class="chip pilot" title="${esc(t('reward.pilot'))}">${icon('pilot')}?</span>`);
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
    if (w.cluster) bits.push(t('ws.dmgAround', { n: w.dmg }));
    else if (w.dmg > 0) bits.push(t(w.decay ? 'ws.dmgDecay' : 'ws.dmg', { n: w.dmg }));
  } else if (w.dmg > 0) bits.push(t('ws.dmg', { n: w.dmg }));
  if (w.push) bits.push(t('ws.push'));
  if (w.pushAdj) bits.push(t('ws.pushAdj'));
  if (w.kind === 'grav' || w.kind === 'pull') bits.push(t('ws.pull'));
  if (w.fire) bits.push(t('ws.fire'));
  if (w.acid) bits.push(t('ws.acid'));
  if (w.freeze) bits.push(t('ws.freeze'));
  if (w.smoke || w.smokeBehind) bits.push(t('ws.smoke'));
  if (w.flip) bits.push(t('ws.reverse'));
  if (w.kind === 'swap') bits.push(t('ws.teleport', { n: w.range }));
  if (w.kind === 'shieldArt') bits.push(t('ws.shields'));
  if (w.kind === 'wind') bits.push(t('ws.pushAll'));
  if (w.selfDmg) bits.push(t('ws.selfDmg', { n: w.selfDmg }));
  if (w.safeB) bits.push(t('ws.safeB'));
  if (w.uses > 0) bits.push(tn('ws.uses', w.uses));
  return bits.join(' · ');
}

export function weaponTooltip(id: string): string {
  if (!WEAPONS[id]) return '';
  return `${esc(weaponName(id))}\n${esc(weaponDesc(id))}`;
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
  if (p.ai) return `<span class="dim">${t('pilot.autopilotLine')}</span>`;
  return SKILLS[p.skill] ? `<b class="amber">${esc(skillName(p.skill))}</b> <span class="dim">— ${esc(skillDesc(p.skill))}</span>` : '';
}

export function tileExtras(tl: Tile): string[] {
  const out: string[] = [];
  if (tl.fire) out.push(t('tile.fire'));
  if (tl.smoke) out.push(t('tile.smoke'));
  if (tl.acid) out.push(t('tile.acid'));
  if (tl.shield === 'shield') out.push(t('tile.shield'));
  if (tl.shield === 'ice') out.push(t('tile.ice'));
  if (tl.pod) out.push(t('tile.pod'));
  if (tl.spawn) out.push(t('tile.spawn'));
  return out;
}
