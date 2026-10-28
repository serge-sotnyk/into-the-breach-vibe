// Procedural sprites. Every function draws with (0,0) at the unit's feet on the
// tile center; negative y is up. Facing is applied by the caller via scale(±1, 1).

import type { SquadPalette } from '../game/data/squads';
import { HH, HW } from './iso';
import { hash01, shade, type ThemePal } from './themes';

type C = CanvasRenderingContext2D;
const INK = '#0b0d12';

export function poly(ctx: C, pts: number[], fill: string | CanvasGradient, stroke: string | null = INK, lw = 2): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function rrect(ctx: C, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke: string | null = INK, lw = 2): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function ell(ctx: C, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, stroke: string | null = INK, lw = 2, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function line(ctx: C, pts: number[], color: string, w: number): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

/** Outlined limb: dark stroke underneath, colored stroke on top. */
function limb(ctx: C, pts: number[], color: string, w: number): void {
  line(ctx, pts, INK, w + 3);
  line(ctx, pts, color, w);
}

function glowDot(ctx: C, x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ell(ctx, x, y, r, r, color, null);
}

// ------------------------------------------------------------------ mechs

export function drawMech(ctx: C, sprite: string, p: SquadPalette, t: number, wreck = false): void {
  const pal = wreck ? { main: '#4b4b4b', dark: '#2b2b2b', light: '#6a6a6a', trim: '#252525', glow: '#3a3a3a' } : p;
  const bob = wreck ? 0 : Math.sin(t * 2.2) * 1.2;
  ctx.save();
  if (wreck) ctx.rotate(-0.18);
  switch (sprite) {
    case 'brawler':
      mechLegs(ctx, pal, 0);
      ctx.translate(0, bob);
      rrect(ctx, -26, -46, 12, 14, 3, pal.dark);
      limb(ctx, [-20, -34, -24, -24], pal.trim, 6);
      poly(ctx, [-16, -46, 14, -46, 19, -35, 14, -20, -14, -20, -19, -35], pal.main);
      poly(ctx, [-16, -46, 14, -46, 17, -40, -17, -40], pal.light, null);
      rrect(ctx, -7, -39, 15, 5, 2, pal.glow, INK, 1.5);
      rrect(ctx, -12, -22, 24, 5, 2, pal.trim, INK, 1.5);
      rrect(ctx, 8, -38, 9, 7, 2, pal.trim);
      rrect(ctx, 14, -36, 17, 17, 4, pal.main);
      rrect(ctx, 14, -36, 17, 6, 3, pal.light, null);
      line(ctx, [20, -27, 20, -21], INK, 1.5);
      line(ctx, [25, -27, 25, -21], INK, 1.5);
      rrect(ctx, -8, -52, 10, 7, 2, pal.dark);
      break;
    case 'cannon':
      rrect(ctx, -23, -13, 46, 13, 6, pal.trim);
      for (const wx of [-15, -5, 5, 15]) ell(ctx, wx, -6.5, 3.4, 3.4, pal.dark, INK, 1.2);
      ctx.translate(0, bob * 0.5);
      poly(ctx, [-19, -13, 19, -13, 14, -26, -16, -26], pal.main);
      poly(ctx, [-16, -26, 14, -26, 16, -22, -18, -22], pal.light, null);
      rrect(ctx, 4, -34, 28, 6, 2, pal.trim);
      rrect(ctx, 29, -36, 6, 10, 2, pal.dark);
      rrect(ctx, -11, -38, 20, 13, 4, pal.main);
      rrect(ctx, -11, -38, 20, 5, 3, pal.light, null);
      rrect(ctx, -7, -33, 9, 3.5, 1.5, pal.glow, INK, 1.2);
      break;
    case 'mortar':
      limb(ctx, [-6, -22, -13, -12, -9, 0], pal.trim, 4);
      limb(ctx, [6, -22, 12, -12, 8, 0], pal.trim, 4);
      ctx.translate(0, bob);
      ctx.save();
      ctx.translate(-4, -34);
      ctx.rotate(-0.85);
      rrect(ctx, -5, -24, 11, 26, 3, pal.dark);
      rrect(ctx, -7, -27, 15, 6, 2, pal.trim);
      ctx.restore();
      rrect(ctx, -13, -34, 26, 15, 5, pal.main);
      rrect(ctx, -13, -34, 26, 6, 4, pal.light, null);
      rrect(ctx, 0, -30, 10, 4, 2, pal.glow, INK, 1.2);
      rrect(ctx, -17, -28, 6, 9, 2, pal.trim);
      break;
    case 'judo':
      mechLegs(ctx, pal, 2);
      ctx.translate(0, bob);
      limb(ctx, [-12, -32, -22, -24, -20, -16], pal.trim, 6);
      ell(ctx, 0, -30, 19, 15, pal.main);
      ell(ctx, 0, -35, 15, 8, pal.light, null);
      ell(ctx, 2, -24, 10, 6, pal.dark, null);
      rrect(ctx, -5, -48, 12, 9, 4, pal.dark);
      rrect(ctx, -2, -45, 8, 3, 1.5, pal.glow, INK, 1);
      limb(ctx, [12, -32, 22, -30, 26, -22], pal.trim, 6);
      poly(ctx, [24, -26, 34, -30, 30, -22], pal.light);
      poly(ctx, [24, -20, 34, -16, 28, -14], pal.light);
      break;
    case 'gravity': {
      const h = wreck ? 0 : 8 + bob * 2;
      ctx.translate(0, -h);
      ell(ctx, 0, -8, 17, 6, 'rgba(0,0,0,0)', pal.glow, 2.5);
      poly(ctx, [-15, -38, 15, -38, 20, -24, 13, -11, -13, -11, -20, -24], pal.main);
      poly(ctx, [-15, -38, 15, -38, 18, -32, -18, -32], pal.light, null);
      poly(ctx, [-20, -24, -30, -30, -28, -16], pal.dark);
      poly(ctx, [20, -24, 30, -30, 28, -16], pal.dark);
      if (!wreck) {
        const r = 6 + Math.sin(t * 4) * 1.2;
        glowDot(ctx, 0, -24, r, pal.glow);
        ell(ctx, 0, -24, 11 + Math.sin(t * 3) * 2, 4, 'rgba(0,0,0,0)', pal.glow, 1.4);
      } else ell(ctx, 0, -24, 6, 6, pal.dark);
      break;
    }
    case 'phase': {
      const h = wreck ? 0 : 10 + bob * 2;
      ctx.translate(0, -h);
      poly(ctx, [0, -50, 14, -32, 0, -12, -14, -32], pal.main);
      poly(ctx, [0, -50, 14, -32, 0, -30], pal.light, null);
      poly(ctx, [-14, -32, -26, -40, -20, -24], pal.dark);
      poly(ctx, [14, -32, 26, -40, 20, -24], pal.dark);
      rrect(ctx, -4, -36, 9, 4, 2, pal.glow, INK, 1);
      if (!wreck) {
        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -t * 30;
        ell(ctx, 0, -31, 22, 7, 'rgba(0,0,0,0)', pal.glow, 2);
        ctx.restore();
      }
      break;
    }
    case 'flame':
      mechLegs(ctx, pal, 0);
      ctx.translate(0, bob);
      rrect(ctx, -24, -44, 9, 22, 4, pal.dark);
      rrect(ctx, -24, -38, 9, 3, 1, pal.light, null);
      rrect(ctx, -14, -40, 27, 21, 5, pal.main);
      rrect(ctx, -14, -40, 27, 7, 4, pal.light, null);
      rrect(ctx, -6, -35, 12, 4, 2, pal.glow, INK, 1.2);
      rrect(ctx, 10, -31, 15, 7, 2, pal.trim);
      poly(ctx, [24, -33, 31, -35, 31, -22, 24, -24], pal.dark);
      if (!wreck) {
        const f = 3 + Math.sin(t * 18) * 1.5;
        ell(ctx, 34, -28.5, f, 2.4, '#ffb347', null);
      }
      break;
    case 'meteor':
      limb(ctx, [-7, -20, -13, -10, -10, 0], pal.trim, 5);
      limb(ctx, [7, -20, 13, -10, 10, 0], pal.trim, 5);
      ctx.translate(0, bob);
      rrect(ctx, -14, -34, 28, 16, 5, pal.main);
      rrect(ctx, -14, -34, 28, 6, 4, pal.light, null);
      rrect(ctx, 2, -30, 9, 4, 2, pal.glow, INK, 1.2);
      rrect(ctx, -18, -52, 24, 16, 3, pal.dark);
      for (const [mx, my] of [[-12, -47], [-5, -47], [-12, -41], [-5, -41]]) ell(ctx, mx, my, 2.6, 2.6, wreck ? '#333' : pal.glow, INK, 1);
      break;
    case 'arc':
      mechLegs(ctx, pal, 0);
      ctx.translate(0, bob);
      poly(ctx, [-15, -44, 13, -44, 17, -34, 13, -20, -13, -20, -17, -34], pal.main);
      poly(ctx, [-15, -44, 13, -44, 15, -39, -16, -39], pal.light, null);
      rrect(ctx, -6, -37, 13, 4, 2, pal.glow, INK, 1.2);
      for (const sx of [-12, 10]) {
        line(ctx, [sx, -44, sx, -54], INK, 4);
        line(ctx, [sx, -44, sx, -54], pal.trim, 2);
        if (!wreck) glowDot(ctx, sx, -56, 3.4, pal.glow);
        else ell(ctx, sx, -56, 3.4, 3.4, '#444');
      }
      if (!wreck && Math.sin(t * 7) > 0.2) {
        ctx.beginPath();
        ctx.moveTo(-12, -56);
        for (let i = 1; i < 6; i++) ctx.lineTo(-12 + i * 4.4, -56 + (i % 2 ? -3 : 3));
        ctx.strokeStyle = '#fff6a0';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      limb(ctx, [14, -32, 22, -26, 24, -18], pal.trim, 5);
      break;
    case 'tank':
      rrect(ctx, -18, -11, 36, 11, 5, '#3d4434');
      for (const wx of [-11, -2, 7]) ell(ctx, wx, -5.5, 2.8, 2.8, '#22261d', INK, 1);
      poly(ctx, [-15, -11, 15, -11, 11, -21, -13, -21], '#7d8a4e');
      rrect(ctx, -8, -29, 16, 10, 3, '#93a35c');
      rrect(ctx, 6, -27, 18, 4, 2, '#3d4434');
      rrect(ctx, -4, -25, 6, 3, 1, '#ffe08a', INK, 1);
      break;
    case 'bomb': {
      limb(ctx, [-14, -2, -8, -18], '#3a3f47', 4);
      limb(ctx, [14, -2, 8, -18], '#3a3f47', 4);
      limb(ctx, [0, 2, 0, -18], '#3a3f47', 4);
      ell(ctx, 0, -32, 18, 18, '#5a6270');
      ell(ctx, -5, -38, 8, 7, '#7c8594', null);
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -32, 18, 0, Math.PI * 2);
      ctx.clip();
      for (let i = -3; i < 4; i++) poly(ctx, [-24 + i * 10, -18, -16 + i * 10, -18, -6 + i * 10, -14, -14 + i * 10, -14], '#f2c94c', null);
      ctx.restore();
      const blink = Math.sin(t * 6) > 0;
      glowDot(ctx, 0, -50, 3, blink ? '#ff4d4d' : '#6a1a1a');
      break;
    }
  }
  ctx.restore();
}

function mechLegs(ctx: C, pal: { trim: string; dark: string }, wide: number): void {
  rrect(ctx, -12 - wide, -18, 9, 16, 3, pal.trim);
  rrect(ctx, 3 + wide, -18, 9, 16, 3, pal.trim);
  rrect(ctx, -15 - wide, -4, 14, 5, 2, pal.dark);
  rrect(ctx, 1 + wide, -4, 14, 5, 2, pal.dark);
}

// ------------------------------------------------------------------ the Vek

const VEK: Record<string, [string, string, string]> = {
  wasp: ['#c98a2b', '#6e4214', '#f2c46a'],
  spitter: ['#c65a2e', '#6e2a14', '#f39a5b'],
  beetle: ['#7d8a3a', '#3e471a', '#b6c26a'],
  leaper: ['#8a5bb0', '#45285f', '#c39be0'],
  rammer: ['#8a5a3a', '#472c1b', '#c08a5e'],
  stinger: ['#b83a4a', '#5a1822', '#ea7a86'],
  crawler: ['#5fae3a', '#2b5a18', '#a6e07a'],
  brood: ['#7a3a8a', '#3b1945', '#b67ac6'],
  burster: ['#3aa39a', '#18504b', '#7fe0d5'],
  hatchling: ['#9a6a4a', '#4b3222', '#d0a07a'],
  egg: ['#d8cfa8', '#8a8164', '#fff6d0'],
  blob: ['#8fd14f', '#3c6a1a', '#cfff9a'],
  psion: ['#d76fa6', '#6a284f', '#ffb3d9'],
  tyrant: ['#a03aa8', '#46124c', '#f08af5'],
};

const PSION_AURA: Record<string, string> = { shell: '#9fd4ff', regen: '#ff5a6e', blast: '#ffb347', tyrant: '#d06cff' };

function vekLegs(ctx: C, n: number, y: number, spread: number, len: number, color: string, t: number, phase = 0): void {
  for (let i = 0; i < n; i++) {
    const bx = -spread + (i * spread * 2) / Math.max(1, n - 1);
    const wig = Math.sin(t * 6 + i * 1.7 + phase) * 1.2;
    const kx = bx + (bx >= 0 ? 4 : -4);
    limb(ctx, [bx, y, kx, y - len * 0.45 + wig, kx + (bx >= 0 ? 3 : -3), 0], color, 2.2);
  }
}

function eyes(ctx: C, x: number, y: number, alpha: boolean, n = 2): void {
  const c = alpha ? '#ffe14d' : '#ff4040';
  for (let i = 0; i < n; i++) ell(ctx, x + i * 3.6, y - (i % 2) * 1.2, 1.7, 1.7, c, null);
}

function crown(ctx: C, y: number, color: string): void {
  poly(ctx, [-10, y, -12, y - 9, -5, y - 4, 0, y - 12, 5, y - 4, 12, y - 9, 10, y], color, INK, 1.5);
}

export interface VekLook {
  alpha: boolean;
  boss: boolean;
  psion?: string;
}

export function drawVek(ctx: C, sprite: string, look: VekLook, t: number): void {
  const base = VEK[sprite] ?? VEK.spitter;
  const [main, dark, light] = look.alpha || look.boss ? [shade(base[0], -0.28), shade(base[1], -0.3), shade(base[2], -0.15)] : base;
  const A = look.alpha || look.boss;
  ctx.save();
  switch (sprite) {
    case 'wasp': {
      const hover = 16 + Math.sin(t * 5) * 2;
      ctx.translate(0, -hover);
      line(ctx, [-2, -18, -6, -8], dark, 1.6);
      line(ctx, [4, -18, 6, -8], dark, 1.6);
      ell(ctx, -11, -24, 11, 7.5, main);
      for (const sx of [-15, -10, -5]) line(ctx, [sx, -30, sx - 1, -18], dark, 2);
      poly(ctx, [-21, -24, -30, -22, -21, -21], dark, INK, 1.4);
      ell(ctx, 2, -26, 7, 6, light);
      ell(ctx, 11, -28, 5.5, 5, main);
      eyes(ctx, 11, -29, A);
      const flap = Math.abs(Math.sin(t * 34));
      ctx.globalAlpha = 0.65;
      ell(ctx, -4, -36, 11, 4 + flap * 4, '#e9f6ff', '#9fb6c8', 1.2, -0.4);
      ell(ctx, 4, -37, 9, 3.5 + flap * 3, '#e9f6ff', '#9fb6c8', 1.2, 0.3);
      ctx.globalAlpha = 1;
      if (A) poly(ctx, [-8, -31, -6, -37, -3, -31], dark, INK, 1);
      break;
    }
    case 'spitter': {
      vekLegs(ctx, 4, -10, 12, 12, dark, t);
      const pulse = 1 + Math.sin(t * 3) * 0.04;
      ell(ctx, -3, -22, 15 * pulse, 13 * pulse, main);
      ell(ctx, -6, -27, 8, 5, light, null);
      for (const [sx, sy] of [[-10, -18], [-2, -14], [2, -26]]) ell(ctx, sx, sy, 2.2, 2.2, '#ffcf6a', null);
      limb(ctx, [9, -24, 17, -30], dark, 6);
      glowDot(ctx, 19, -31, 2.5, '#ff9a3a');
      eyes(ctx, 6, -30, A);
      if (A) for (const sx of [-14, -6, 2]) poly(ctx, [sx, -33, sx + 3, -40, sx + 6, -33], dark, INK, 1);
      break;
    }
    case 'beetle': {
      vekLegs(ctx, 4, -8, 13, 10, dark, t);
      ell(ctx, 14, -14, 6, 5, dark);
      eyes(ctx, 15, -16, A);
      ctx.beginPath();
      ctx.ellipse(0, -12, 17, 15, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = main;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      line(ctx, [0, -27, 0, -12], dark, 1.6);
      ell(ctx, -6, -20, 6, 4, light, null);
      rrect(ctx, -6, -36, 12, 11, 3, dark);
      ell(ctx, 0, -36, 4.5, 2, '#ffb14a', INK, 1);
      if (A) for (const sx of [-14, 10]) poly(ctx, [sx, -18, sx + 2, -26, sx + 5, -18], light, INK, 1);
      break;
    }
    case 'leaper': {
      const crouch = Math.sin(t * 4) * 1.5;
      limb(ctx, [-6, -22, -16, -38 + crouch, -20, 0], dark, 2.6);
      limb(ctx, [6, -22, 16, -38 + crouch, 20, 0], dark, 2.6);
      limb(ctx, [-2, -18, -5, -8, -3, 0], dark, 2);
      limb(ctx, [4, -18, 8, -8, 7, 0], dark, 2);
      ell(ctx, 0, -22, 10, 7, main);
      ell(ctx, -3, -25, 5, 3, light, null);
      ell(ctx, 10, -24, 5, 4.5, main);
      eyes(ctx, 10, -26, A, 3);
      poly(ctx, [14, -22, 19, -20, 14, -18], light, INK, 1);
      break;
    }
    case 'rammer': {
      vekLegs(ctx, 4, -8, 13, 9, dark, t);
      ell(ctx, -3, -17, 18, 12, main);
      line(ctx, [-12, -26, -12, -8], dark, 2);
      line(ctx, [-2, -29, -2, -6], dark, 2);
      ell(ctx, -8, -22, 6, 3.5, light, null);
      ell(ctx, 13, -16, 7, 6, dark);
      poly(ctx, [15, -21, 31, -29, 19, -13], light);
      eyes(ctx, 12, -18, A);
      if (A) for (const sx of [-14, -6]) poly(ctx, [sx, -27, sx + 3, -35, sx + 6, -27], light, INK, 1);
      break;
    }
    case 'stinger': {
      vekLegs(ctx, 4, -8, 12, 9, dark, t);
      const sway = Math.sin(t * 3) * 2;
      for (const [sx, sy, r] of [[-12, -18, 6], [-17, -28, 5.5], [-14, -38, 5], [-6 + sway, -44, 4.5]] as const) ell(ctx, sx, sy, r, r, main);
      poly(ctx, [-2 + sway, -46, 8 + sway, -44, -1 + sway, -40], light);
      ell(ctx, 0, -13, 14, 8, main);
      ell(ctx, -3, -16, 7, 3, light, null);
      limb(ctx, [10, -14, 18, -16], dark, 3);
      poly(ctx, [17, -20, 25, -18, 19, -15, 25, -12, 17, -12], light, INK, 1.4);
      eyes(ctx, 9, -16, A);
      break;
    }
    case 'crawler': {
      const segs = A ? 5 : 4;
      for (let i = 0; i < segs; i++) {
        const sx = -18 + i * 8;
        const sy = -11 + Math.sin(t * 5 + i) * 1.5;
        line(ctx, [sx, sy + 5, sx - 3, 0], dark, 1.6);
        line(ctx, [sx, sy + 5, sx + 3, 0], dark, 1.6);
        ell(ctx, sx, sy, 6.5, 6, i % 2 ? main : light);
      }
      const hx = -18 + segs * 8;
      ell(ctx, hx, -13, 7, 6.5, main);
      eyes(ctx, hx, -15, A);
      poly(ctx, [hx + 5, -10, hx + 11, -8, hx + 6, -6], dark, INK, 1);
      glowDot(ctx, hx + 9, -6, 1.8, '#b8ff5a');
      break;
    }
    case 'brood':
    case 'hatchling': {
      const s = sprite === 'hatchling' ? 0.62 : 1;
      ctx.scale(s, s);
      for (let i = 0; i < 4; i++) {
        const k = i - 1.5;
        const wig = Math.sin(t * 5 + i) * 2;
        limb(ctx, [2, -18, 12 + k * 4, -30 + wig, 18 + k * 5, 0], dark, 2);
        limb(ctx, [-2, -18, -12 - k * 4, -30 - wig, -18 - k * 5, 0], dark, 2);
      }
      ell(ctx, -6, -22, 13, 11, main);
      if (sprite === 'brood') for (const [ex, ey] of [[-10, -24], [-4, -18], [-2, -27]]) ell(ctx, ex, ey, 2.6, 2.2, '#f3e6b0', INK, 1);
      ell(ctx, 8, -19, 7, 6, light);
      eyes(ctx, 8, -21, A, 3);
      break;
    }
    case 'burster': {
      vekLegs(ctx, 4, -8, 11, 8, dark, t);
      const p = 1 + Math.sin(t * 4) * 0.06;
      ell(ctx, 0, -20, 15 * p, 13 * p, main);
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI + (i / 5) * Math.PI;
        const x1 = Math.cos(a) * 14 * p;
        const y1 = -20 + Math.sin(a) * 12 * p;
        poly(ctx, [x1 - 2, y1, x1 + Math.cos(a) * 6, y1 + Math.sin(a) * 6, x1 + 2, y1], dark, INK, 1);
      }
      ell(ctx, -4, -24, 6, 4, light, null);
      glowDot(ctx, 4, -18, 3, '#d9ff7a');
      eyes(ctx, 7, -24, A);
      break;
    }
    case 'egg': {
      const p = 1 + Math.sin(t * 5) * 0.05;
      ell(ctx, 0, -12 * p, 9 * p, 12 * p, main);
      line(ctx, [-4, -20, -2, -12, -5, -4], dark, 1.2);
      line(ctx, [3, -21, 4, -13, 2, -5], dark, 1.2);
      ell(ctx, -3, -16, 3, 4, light, null);
      break;
    }
    case 'blob': {
      const p = 1 + Math.sin(t * 7) * 0.08;
      const col = look.alpha ? '#ff9b3a' : main;
      ell(ctx, 0, -9, 13 * p, 9 / p, col);
      ell(ctx, -4, -12, 4, 2.5, look.alpha ? '#ffd29a' : light, null);
      ell(ctx, 6, -6, 2, 2, look.alpha ? '#ffd29a' : light, null);
      glowDot(ctx, 1, -9, 2.5 + Math.sin(t * 9), look.alpha ? '#ffef5a' : '#eaff8a');
      break;
    }
    case 'psion':
    case 'tyrant': {
      const big = sprite === 'tyrant';
      const hover = (big ? 10 : 18) + Math.sin(t * 2.5) * 2.5;
      ctx.translate(0, -hover);
      const aura = PSION_AURA[look.psion ?? 'tyrant'] ?? '#d06cff';
      const g = ctx.createRadialGradient(0, -24, 2, 0, -24, big ? 40 : 28);
      g.addColorStop(0, aura);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.45 + Math.sin(t * 3) * 0.15;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -24, big ? 40 : 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      for (let i = 0; i < (big ? 6 : 4); i++) {
        const x = -9 + i * (big ? 3.6 : 6);
        const w = Math.sin(t * 4 + i) * 3;
        line(ctx, [x, -14, x + w, -4, x - w, 6], dark, 2.4);
      }
      const r = big ? 16 : 11;
      ell(ctx, 0, -24, r, r * 0.85, main);
      line(ctx, [-r * 0.6, -28, -2, -24, -r * 0.4, -18], dark, 1.5);
      line(ctx, [r * 0.6, -30, 2, -25, r * 0.5, -18], dark, 1.5);
      ell(ctx, -3, -29, r * 0.45, r * 0.25, light, null);
      eyes(ctx, -2, -20, true, big ? 3 : 2);
      if (big) crown(ctx, -36, '#ffcf4a');
      break;
    }
    default:
      ell(ctx, 0, -14, 12, 10, main);
  }
  if (look.boss && sprite !== 'tyrant') {
    const hy = sprite === 'wasp' ? -56 : -40;
    crown(ctx, hy, '#ffcf4a');
  }
  ctx.restore();
}

// ------------------------------------------------------------------ structures

function boxPt(cx: number, cy: number, fx: number, fy: number, z: number): [number, number] {
  return [cx + (fx - fy) * HW, cy + (fx + fy) * HH - z];
}

/** Isometric box centered on (cx,cy) with footprint half-extents a (x) and b (y) in tile units. */
export function isoBox(ctx: C, cx: number, cy: number, a: number, b: number, z0: number, h: number, top: string, left: string, right: string, stroke = true): void {
  const N = (z: number) => boxPt(cx, cy, -a, -b, z);
  const E = (z: number) => boxPt(cx, cy, a, -b, z);
  const S = (z: number) => boxPt(cx, cy, a, b, z);
  const W = (z: number) => boxPt(cx, cy, -a, b, z);
  const z1 = z0 + h;
  const st = stroke ? INK : null;
  poly(ctx, [...W(z0), ...S(z0), ...S(z1), ...W(z1)], left, st, 1.5);
  poly(ctx, [...S(z0), ...E(z0), ...E(z1), ...S(z1)], right, st, 1.5);
  poly(ctx, [...N(z1), ...E(z1), ...S(z1), ...W(z1)], top, st, 1.5);
}

function windows(ctx: C, cx: number, cy: number, a: number, b: number, z0: number, h: number, seed: number, color: string, lit: number): void {
  const rows = Math.max(1, Math.floor((h - 8) / 11));
  for (const face of [0, 1]) {
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < 2; k++) {
        const f = -0.55 + k * 0.7;
        const z = z0 + 6 + r * 11;
        const on = hash01(seed + face * 97 + r * 13 + k * 7) < lit;
        const fill = on ? color : 'rgba(10,14,20,0.75)';
        let p0: [number, number];
        let p1: [number, number];
        if (face === 0) {
          p0 = boxPt(cx, cy, -a + (f + 0.55) * a, b, z);
          p1 = boxPt(cx, cy, -a + (f + 0.95) * a, b, z);
        } else {
          p0 = boxPt(cx, cy, a, -b + (f + 0.55) * b, z);
          p1 = boxPt(cx, cy, a, -b + (f + 0.95) * b, z);
        }
        poly(ctx, [p0[0], p0[1], p1[0], p1[1], p1[0], p1[1] - 6, p0[0], p0[1] - 6], fill, null);
      }
    }
  }
}

export function drawBuilding(ctx: C, pal: ThemePal, v: number, hp: number, maxHp: number, obj: string, t: number): void {
  const variant = v % 4;
  const tall = maxHp >= 2;
  const damaged = hp < maxHp;
  const lit = damaged ? 0.35 : 0.75;
  const [wl, wr] = pal.wall;
  const top = pal.roof[0];
  if (obj) {
    drawObjectiveBuilding(ctx, pal, obj, damaged, t);
    return;
  }
  if (variant === 1 && !tall) {
    for (const [ox, oy] of [[-0.18, 0.08], [0.16, -0.12]] as const) {
      const [cx, cy] = boxPt(0, 0, ox, oy, 0);
      isoBox(ctx, cx, cy, 0.15, 0.17, 0, damaged ? 9 : 16, shade(wl, 0.1), wl, wr);
      if (!damaged) {
        const pN = boxPt(cx, cy, -0.15, 0, 16);
        const pS = boxPt(cx, cy, 0.15, 0, 16);
        const ridgeN = [pN[0], pN[1] - 9];
        const ridgeS = [pS[0], pS[1] - 9];
        poly(ctx, [...boxPt(cx, cy, -0.15, 0.17, 16), ...boxPt(cx, cy, 0.15, 0.17, 16), ridgeS[0], ridgeS[1], ridgeN[0], ridgeN[1]], pal.roof[1], INK, 1.5);
        poly(ctx, [...boxPt(cx, cy, 0.15, -0.17, 16), ...boxPt(cx, cy, 0.15, 0.17, 16), ridgeS[0], ridgeS[1]], pal.roof[0], INK, 1.5);
      }
      windows(ctx, cx, cy, 0.15, 0.17, 0, 14, v + ox * 100, pal.window, lit);
    }
    return;
  }
  let a = 0.31;
  let b = 0.31;
  let h = tall ? 54 : 32;
  if (variant === 2) {
    a = 0.36;
    b = 0.28;
    h = tall ? 40 : 24;
  }
  if (variant === 3) {
    a = 0.22;
    b = 0.24;
    h = tall ? 66 : 42;
  }
  if (damaged) h = Math.round(h * 0.55);
  isoBox(ctx, 0, 0, a, b, 0, h, top, wl, wr);
  windows(ctx, 0, 0, a, b, 0, h, v, pal.window, lit);
  if (damaged) {
    const [px, py] = boxPt(0, 0, 0.05, -0.05, h);
    poly(ctx, [px - 14, py + 2, px - 6, py - 7, px + 2, py - 2, px + 9, py - 9, px + 15, py + 3], shade(wl, -0.2), INK, 1.2);
  } else if (variant === 2) {
    const [px, py] = boxPt(0, 0, -0.18, -0.12, h);
    rrect(ctx, px - 4, py - 20, 8, 22, 2, shade(wl, -0.25));
    ell(ctx, px, py - 20, 4, 1.6, '#22252b', INK, 1);
  } else {
    const [px, py] = boxPt(0, 0, 0.08, -0.1, h);
    isoBox(ctx, px, py, 0.08, 0.07, 0, 6, shade(wl, -0.05), shade(wl, -0.3), shade(wl, -0.4));
    if (variant === 3) {
      line(ctx, [0, -h, 0, -h - 14], '#2a2e35', 2);
      glowDot(ctx, 0, -h - 15, 1.8, Math.sin(t * 3 + v) > 0 ? '#ff5a4d' : '#5a1a14');
    }
  }
}

function drawObjectiveBuilding(ctx: C, pal: ThemePal, obj: string, damaged: boolean, t: number): void {
  const [wl, wr] = pal.wall;
  if (obj === 'relay') {
    const h = damaged ? 14 : 22;
    isoBox(ctx, 0, 0, 0.3, 0.3, 0, h, '#3a3f47', shade(wl, -0.1), shade(wr, -0.15));
    if (!damaged) {
      rrect(ctx, -5, -h - 22, 10, 22, 3, '#4b525c');
      for (let i = 0; i < 3; i++) ell(ctx, 0, -h - 6 - i * 6, 9, 3, 'rgba(0,0,0,0)', '#f2c94c', 2);
      glowDot(ctx, 0, -h - 26, 4 + Math.sin(t * 5), '#ffe066');
    }
    return;
  }
  if (obj === 'lab') {
    const h = damaged ? 18 : 30;
    isoBox(ctx, 0, 0, 0.32, 0.3, 0, h, '#e8eef2', '#c4ced6', '#a3afb9');
    windows(ctx, 0, 0, 0.32, 0.3, 0, h, 77, '#9ff3ff', damaged ? 0.3 : 0.8);
    if (!damaged) {
      ctx.beginPath();
      ctx.ellipse(-4, -h - 2, 13, 11, 0, Math.PI, 0);
      ctx.fillStyle = '#dfe9ef';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      line(ctx, [10, -h - 4, 14, -h - 16], '#3a3f47', 2);
      ell(ctx, 15, -h - 18, 7, 3.5, '#f3f6f8', INK, 1.5, -0.5);
    }
    return;
  }
  // uplink tower
  const h = damaged ? 26 : 56;
  isoBox(ctx, 0, 0, 0.24, 0.24, 0, h, '#4d5560', '#3a414b', '#2c323a');
  windows(ctx, 0, 0, 0.24, 0.24, 0, h, 31, '#ff9a5a', damaged ? 0.3 : 0.9);
  if (!damaged) {
    line(ctx, [0, -h, 0, -h - 20], '#9aa3ad', 2);
    line(ctx, [-8, -h - 10, 8, -h - 10], '#9aa3ad', 1.5);
    glowDot(ctx, 0, -h - 21, 3, Math.sin(t * 4) > 0 ? '#ff7b54' : '#5a1a14');
  }
}

export function drawMountain(ctx: C, pal: ThemePal, v: number, hp: number, snow: boolean): void {
  const [c1, c2, c3] = pal.mountain;
  const small = hp < 2;
  const k = small ? 0.62 : 1;
  const jit = (hash01(v) - 0.5) * 8;
  const L = boxPt(0, 0, -0.42, 0.42, 0);
  const B = boxPt(0, 0, 0.42, 0.42, 0);
  const R = boxPt(0, 0, 0.42, -0.42, 0);
  const peak: [number, number] = [jit, -58 * k];
  // faceted front faces: each split along a ridge for a chiselled rock look
  const ridgeL: [number, number] = [(L[0] + B[0]) / 2 + 6, (L[1] + B[1]) / 2 + 1];
  const ridgeR: [number, number] = [(B[0] + R[0]) / 2 - 4, (B[1] + R[1]) / 2 + 1];
  poly(ctx, [...L, ...ridgeL, ...peak], shade(c1, 0.06), INK, 1.6);
  poly(ctx, [...ridgeL, ...B, ...peak], c1, INK, 1.6);
  poly(ctx, [...B, ...ridgeR, ...peak], c2, INK, 1.6);
  poly(ctx, [...ridgeR, ...R, ...peak], shade(c2, -0.12), INK, 1.6);
  // a smaller shoulder peak in front
  const p2: [number, number] = [-17 + jit * 0.4, -30 * k];
  const L2 = boxPt(0, 0, -0.46, 0.08, 0);
  const B2 = boxPt(0, 0, -0.06, 0.44, 0);
  poly(ctx, [...L2, ...B2, ...p2], shade(c1, 0.14), INK, 1.4);
  poly(ctx, [...B2, ...boxPt(0, 0, 0.12, 0.44, 0), ...p2], c3, INK, 1.2);
  // strata
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  for (const f of [0.35, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(peak[0] + (B[0] - peak[0]) * f + 4, peak[1] + (B[1] - peak[1]) * f);
    ctx.lineTo(peak[0] + (R[0] - peak[0]) * f - 2, peak[1] + (R[1] - peak[1]) * f);
    ctx.stroke();
  }
  if (snow && !small) poly(ctx, [peak[0] - 9, peak[1] + 14, peak[0], peak[1], peak[0] + 10, peak[1] + 15, peak[0] + 3, peak[1] + 10, peak[0] - 2, peak[1] + 13], '#f4fbff', INK, 1.2);
  if (small) {
    line(ctx, [peak[0] - 3, peak[1] + 6, peak[0] + 3, peak[1] + 14, peak[0] - 2, peak[1] + 22], INK, 1.4);
    for (const [rx, ry] of [[-18, -4], [16, -2], [4, 6]]) poly(ctx, [rx - 4, ry, rx, ry - 5, rx + 5, ry - 1, rx + 2, ry + 3], c3, INK, 1);
  }
}

export function drawTrees(ctx: C, pal: ThemePal, v: number, burning: boolean, t: number): void {
  const spots: [number, number, number][] = [
    [-0.2, -0.16, 1],
    [0.18, -0.02, 0.85],
    [-0.04, 0.2, 0.95],
  ];
  const [g1, g2] = burning ? ['#3a2a22', '#241913'] : pal.forest;
  for (const [fx, fy, s0] of spots) {
    const s = s0 * (0.85 + hash01(v + fx * 50) * 0.3);
    const [x, y] = boxPt(0, 0, fx, fy, 0);
    rrect(ctx, x - 2, y - 8 * s, 4, 9 * s, 1, pal.trunk, INK, 1.2);
    for (let k = 0; k < 3; k++) {
      const by = y - 6 * s - k * 8 * s;
      const w = (12 - k * 3) * s;
      poly(ctx, [x - w, by, x, by - 13 * s, x + w, by], g1, INK, 1.4);
      poly(ctx, [x, by, x, by - 13 * s, x + w, by], g2, null);
    }
    if (burning) {
      const fl = Math.sin(t * 12 + fx * 9) * 2;
      flame(ctx, x, y - 14 * s, 6 * s + fl * 0.4, t + fx);
    }
  }
}

export function flame(ctx: C, x: number, y: number, s: number, t: number): void {
  const f = Math.sin(t * 14) * 0.18 + 1;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.quadraticCurveTo(x - s * 0.9, y - s * 1.6 * f, x, y - s * 2.6 * f);
  ctx.quadraticCurveTo(x + s * 0.9, y - s * 1.6 * f, x + s, y);
  ctx.closePath();
  ctx.fillStyle = '#ff7a1a';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y);
  ctx.quadraticCurveTo(x - s * 0.4, y - s * 1.1 * f, x, y - s * 1.6 * f);
  ctx.quadraticCurveTo(x + s * 0.4, y - s * 1.1 * f, x + s * 0.5, y);
  ctx.closePath();
  ctx.fillStyle = '#ffd24a';
  ctx.fill();
}

export function drawPod(ctx: C, t: number): void {
  ell(ctx, 0, -2, 12, 5, 'rgba(120,220,255,0.25)', null);
  rrect(ctx, -9, -26, 18, 26, 8, '#e9eef2');
  rrect(ctx, -9, -16, 18, 5, 2, '#6fd3ff', INK, 1);
  ell(ctx, 0, -26, 6, 3, '#b8c3cc', INK, 1);
  glowDot(ctx, 0, -13.5, 2 + Math.sin(t * 5) * 0.8, '#bff3ff');
}

/** Small portrait used for pilots in the HUD and menus. */
export function drawPortrait(ctx: C, w: number, h: number, look: number, ai: boolean, accent: string): void {
  ctx.fillStyle = '#121821';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  if (ai) {
    rrect(ctx, cx - w * 0.28, h * 0.22, w * 0.56, h * 0.5, 6, '#3a4350');
    rrect(ctx, cx - w * 0.2, h * 0.38, w * 0.4, h * 0.1, 3, '#ff5a4d', null);
    ell(ctx, cx, h * 0.95, w * 0.4, h * 0.25, '#2a3039', null);
    return;
  }
  const skins = ['#f1c7a3', '#d9a27b', '#b97b52', '#8d5a3b', '#5e3b26', '#f5d5bd'];
  const hairs = ['#2a1c14', '#5a3a22', '#c7a15a', '#1a1a1a', '#8a2f1f', '#d8d8d8', '#3b2a4a'];
  const skin = skins[look % skins.length];
  const hair = hairs[Math.floor(look / 7) % hairs.length];
  ell(ctx, cx, h * 1.02, w * 0.42, h * 0.3, accent, null);
  rrect(ctx, cx - w * 0.08, h * 0.62, w * 0.16, h * 0.14, 2, shade(skin, -0.1), null);
  ell(ctx, cx, h * 0.48, w * 0.22, h * 0.25, skin, null);
  const style = Math.floor(look / 3) % 3;
  ctx.fillStyle = hair;
  ctx.beginPath();
  if (style === 0) ctx.ellipse(cx, h * 0.33, w * 0.25, h * 0.14, 0, Math.PI, 0);
  else if (style === 1) ctx.ellipse(cx - w * 0.02, h * 0.36, w * 0.27, h * 0.2, -0.2, Math.PI * 0.9, Math.PI * 2.1);
  else ctx.rect(cx - w * 0.24, h * 0.22, w * 0.48, h * 0.12);
  ctx.fill();
  ell(ctx, cx - w * 0.08, h * 0.5, w * 0.025, h * 0.03, '#1a1a1a', null);
  ell(ctx, cx + w * 0.08, h * 0.5, w * 0.025, h * 0.03, '#1a1a1a', null);
  line(ctx, [cx - w * 0.06, h * 0.6, cx + w * 0.06, h * 0.6], shade(skin, -0.35), 1.5);
  if (look % 4 === 0) {
    rrect(ctx, cx - w * 0.26, h * 0.42, w * 0.52, h * 0.1, 3, 'rgba(120,230,255,0.55)', null);
  }
}
