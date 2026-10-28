import { DX, DY, type BattleState, type Dir, type Tile, type Unit, type Vfx } from '../game/types';
import { UNITS } from '../game/data/units';
import type { SquadPalette } from '../game/data/squads';
import type { Outcome, Threat } from '../game/battle/preview';
import { isMech, unitById } from '../game/battle/board';
import { isArmored } from '../game/battle/effects';
import { idx, ix, iy } from '../game/util';
import { BASE, HH, HW, SIDE, screenToTile, surfaceDrop, tileCenter } from './iso';
import { hash01, rgba, shade, theme, type ThemePal } from './themes';
import { drawBuilding, drawMech, drawMountain, drawPod, drawTrees, drawVek, ell, flame, poly, rrect } from './sprites';
import { FX } from './fx';

export interface UnitOverride {
  x: number;
  y: number;
  z: number;
  alpha?: number;
  scale?: number;
}

export interface Ghost {
  u: Unit;
  x: number;
  y: number;
  z: number;
  alpha: number;
  scale: number;
}

export interface Shot {
  v: Vfx;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  t: number;
}

export interface Overlay {
  pos: Map<number, UnitOverride>;
  hide: Set<number>;
  ghosts: Ghost[];
  shots: Shot[];
  flash: Map<number, number>;
  focus: number;
  podDrop: { x: number; y: number; t: number } | null;
}

export interface View {
  hover: number;
  selected: number;
  moveTiles: Set<number> | null;
  path: number[] | null;
  targetTiles: Set<number> | null;
  deployTiles: Set<number> | null;
  preview: Outcome | null;
  previewSrc: number;
  threats: Threat[];
  focusEnemy: number;
  showOrder: boolean;
  overlay: Overlay | null;
  pal: SquadPalette;
  idleGlow: Set<number>;
}

export function emptyView(pal: SquadPalette): View {
  return {
    hover: -1,
    selected: 0,
    moveTiles: null,
    path: null,
    targetTiles: null,
    deployTiles: null,
    preview: null,
    previewSrc: 0,
    threats: [],
    focusEnemy: 0,
    showOrder: true,
    overlay: null,
    pal,
    idleGlow: new Set(),
  };
}

const ENEMY = '#ff4a3d';
const PLAYER = '#ffcf4a';
const INK = '#0b0d12';

export function spriteHeight(u: Unit): number {
  const d = UNITS[u.def];
  const size = d.size ?? 1;
  if (d.kind === 'mech') return (u.flying ? 62 : 56) * size;
  if (d.kind === 'npc') return u.def === 'bomb' ? 54 : 32;
  switch (d.sprite) {
    case 'wasp':
      return 58 * size;
    case 'psion':
      return 52;
    case 'tyrant':
      return 60 * size;
    case 'stinger':
      return 50 * size;
    case 'egg':
    case 'blob':
      return 26;
    case 'hatchling':
      return 26;
    default:
      return 40 * size;
  }
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr = 1;
  cw = 0;
  ch = 0;
  scale = 1;
  ox = 0;
  oy = 0;
  insets = { left: 0, right: 0, top: 0, bottom: 0 };
  fx = new FX();
  /** skip the sky/sea backdrop (thumbnails) */
  transparent = false;
  boxes: { id: number; x0: number; y0: number; x1: number; y1: number; d: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cw = r.width;
    this.ch = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    this.layout();
  }

  setInsets(left: number, right: number, top: number, bottom: number): void {
    this.insets = { left, right, top, bottom };
    this.layout();
  }

  layout(): void {
    const { left, right, top, bottom } = this.insets;
    const aw = Math.max(Math.min(200, this.cw), this.cw - left - right);
    const ah = Math.max(Math.min(200, this.ch), this.ch - top - bottom);
    const bw = 16 * HW + 40;
    const bh = 16 * HH + BASE + 92;
    this.scale = Math.max(0.08, Math.min(1.75, Math.min(aw / bw, ah / bh)));
    this.ox = left + aw / 2;
    this.oy = top + (ah - (16 * HH + BASE) * this.scale) / 2 + 40 * this.scale;
  }

  toBoard(clientX: number, clientY: number): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [(clientX - r.left - this.ox) / this.scale, (clientY - r.top - this.oy) / this.scale];
  }

  /** Client coordinates of a tile center (for DOM tooltips). */
  tileClient(x: number, y: number, lift = 0): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    const [cx, cy] = tileCenter(x, y);
    return [r.left + this.ox + cx * this.scale, r.top + this.oy + (cy - lift) * this.scale];
  }

  pick(clientX: number, clientY: number): { tile: number; unit: number } {
    const [lx, ly] = this.toBoard(clientX, clientY);
    const t = screenToTile(lx, ly);
    let unit = 0;
    let bestD = -1;
    for (const b of this.boxes) {
      if (lx >= b.x0 && lx <= b.x1 && ly >= b.y0 && ly <= b.y1 && b.d > bestD) {
        bestD = b.d;
        unit = b.id;
      }
    }
    return { tile: t ? idx(t[0], t[1]) : -1, unit };
  }

  // ---------------------------------------------------------------- frame

  draw(s: BattleState, v: View, t: number): void {
    const ctx = this.ctx;
    const pal = theme(s.theme);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.transparent) ctx.clearRect(0, 0, this.cw, this.ch);
    else this.drawBackground(pal, t);
    const sh = this.fx.shake;
    const sx = sh ? (Math.random() - 0.5) * sh : 0;
    const sy = sh ? (Math.random() - 0.5) * sh : 0;
    const k = this.dpr * this.scale;
    ctx.setTransform(k, 0, 0, k, this.dpr * (this.ox + sx), this.dpr * (this.oy + sy));
    this.drawIslandShadow();
    for (let d = 0; d <= 14; d++) {
      for (let x = 0; x <= 7; x++) {
        const y = d - x;
        if (y < 0 || y > 7) continue;
        this.drawTile(s, x, y, pal, t);
      }
    }
    this.drawOverlays(s, v, t);
    this.drawObjects(s, v, pal, t);
    this.drawThreats(s, v, t);
    if (v.preview) this.drawPreview(s, v, v.preview, t);
    this.drawShots(v, t);
    this.drawUnitHud(s, v, t);
    this.fx.draw(ctx);
  }

  drawBackground(pal: ThemePal, t: number): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.ch);
    g.addColorStop(0, pal.sky[0]);
    g.addColorStop(0.55, pal.sky[1]);
    g.addColorStop(1, pal.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cw, this.ch);
    // drifting sea bands
    const horizon = this.oy + 4 * HH * this.scale;
    const sea = ctx.createLinearGradient(0, horizon, 0, this.ch);
    sea.addColorStop(0, rgba(pal.sea[0].length === 7 ? pal.sea[0] : '#123845', 0));
    sea.addColorStop(0.25, pal.sea[0]);
    sea.addColorStop(1, pal.sea[1]);
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, this.cw, this.ch - horizon);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = horizon + 40 + i * 46 + Math.sin(t * 0.6 + i) * 6;
      if (y > this.ch) break;
      ctx.beginPath();
      for (let x = 0; x <= this.cw; x += 40) {
        const yy = y + Math.sin(x * 0.012 + t * 0.9 + i * 2) * 4;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // vignette
    const vg = ctx.createRadialGradient(this.cw / 2, this.ch / 2, Math.min(this.cw, this.ch) * 0.35, this.cw / 2, this.ch / 2, Math.max(this.cw, this.ch) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.cw, this.ch);
  }

  drawIslandShadow(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.lineTo(8 * HW + 18, 8 * HH + 34);
    ctx.lineTo(0, 16 * HH + 48);
    ctx.lineTo(-8 * HW - 18, 8 * HH + 34);
    ctx.closePath();
    ctx.filter = 'blur(10px)';
    ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- tiles

  private corner(x: number, y: number, fx: number, fy: number, z: number): [number, number] {
    const [cx, cy] = tileCenter(x, y);
    return [cx + (fx - fy) * HW, cy + (fx + fy) * HH - z];
  }

  private diamond(x: number, y: number, z: number, inset = 0): number[] {
    const a = 0.5 - inset;
    return [
      ...this.corner(x, y, -a, -a, z),
      ...this.corner(x, y, a, -a, z),
      ...this.corner(x, y, a, a, z),
      ...this.corner(x, y, -a, a, z),
    ];
  }

  private topColor(tile: Tile, pal: ThemePal, x: number, y: number): string {
    const n = hash01(tile.v) * 0.08 - 0.04;
    switch (tile.t) {
      case 'sand':
        return shade(pal.sand[0], n);
      case 'ice':
        return shade(pal.ice[0], n);
      case 'rubble':
        return shade(pal.rubble, n);
      case 'water':
        return pal.water[0];
      case 'lava':
        return pal.lava[0];
      default:
        return shade(pal.ground[0], n + ((x + y) % 2 ? 0.03 : -0.01));
    }
  }

  private drawTile(s: BattleState, x: number, y: number, pal: ThemePal, t: number): void {
    const ctx = this.ctx;
    const tile = s.tiles[idx(x, y)];
    const drop = surfaceDrop(tile.t);
    const z = -drop;
    // side faces toward lower neighbours / board edge
    const faces: [number, number, number, number, number, number, string, string][] = [];
    const rightN = x < 7 ? s.tiles[idx(x + 1, y)] : null;
    const leftN = y < 7 ? s.tiles[idx(x, y + 1)] : null;
    const rDrop = rightN ? surfaceDrop(rightN.t) : BASE + 10;
    const lDrop = leftN ? surfaceDrop(leftN.t) : BASE + 10;
    const sideCols = tile.t === 'water' ? [pal.water[1], shade(pal.water[1], -0.2)] : tile.t === 'lava' ? [pal.lava[1], shade(pal.lava[1], -0.25)] : [pal.ground[1], pal.ground[2]];
    if (rDrop > drop) faces.push([0.5, -0.5, 0.5, 0.5, z, -rDrop, sideCols[1], pal.cliff[1]]);
    if (lDrop > drop) faces.push([-0.5, 0.5, 0.5, 0.5, z, -lDrop, sideCols[0], pal.cliff[0]]);
    for (const [ax, ay, bx, by, z0, z1, col, cliff] of faces) {
      const a0 = this.corner(x, y, ax, ay, z0);
      const b0 = this.corner(x, y, bx, by, z0);
      const band = Math.min(z0 - z1, tile.t === 'chasm' ? 0 : SIDE);
      const a1 = this.corner(x, y, ax, ay, z0 - band);
      const b1 = this.corner(x, y, bx, by, z0 - band);
      if (band > 0) poly(ctx, [...a0, ...b0, ...b1, ...a1], col, null);
      if (z0 - band > z1) {
        const a2 = this.corner(x, y, ax, ay, z1);
        const b2 = this.corner(x, y, bx, by, z1);
        poly(ctx, [...a1, ...b1, ...b2, ...a2], cliff, null);
        // strata lines on the island cliff
        if (z1 <= -BASE) {
          ctx.strokeStyle = 'rgba(0,0,0,0.18)';
          ctx.lineWidth = 1;
          for (let k = 1; k < 3; k++) {
            const zz = z0 - band - ((z0 - band - z1) * k) / 3;
            const p = this.corner(x, y, ax, ay, zz);
            const q = this.corner(x, y, bx, by, zz);
            ctx.beginPath();
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(q[0], q[1]);
            ctx.stroke();
          }
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(...a0);
      ctx.lineTo(...b0);
      ctx.stroke();
    }
    if (tile.t === 'chasm') {
      const pts = this.diamond(x, y, -14);
      const [cx, cy] = tileCenter(x, y);
      const g = ctx.createRadialGradient(cx, cy + 14, 2, cx, cy + 14, HW);
      g.addColorStop(0, '#000');
      g.addColorStop(1, '#0d0a0c');
      poly(ctx, pts, g, null);
      return;
    }
    const top = this.diamond(x, y, z);
    poly(ctx, top, this.topColor(tile, pal, x, y), 'rgba(0,0,0,0.22)', 1);
    const [cx, cy0] = tileCenter(x, y);
    const cy = cy0 + drop;
    switch (tile.t) {
      case 'water': {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        for (let i = 2; i < 8; i += 2) ctx.lineTo(top[i], top[i + 1]);
        ctx.closePath();
        ctx.clip();
        const g = ctx.createLinearGradient(cx - HW, cy, cx + HW, cy);
        g.addColorStop(0, pal.water[0]);
        g.addColorStop(1, pal.water[1]);
        ctx.fillStyle = g;
        ctx.fillRect(cx - HW, cy - HH, HW * 2, HH * 2);
        ctx.strokeStyle = rgba(pal.waterHi.length === 7 ? pal.waterHi : '#8fd4ef', 0.55);
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const ph = t * 1.4 + hash01(tile.v + i) * 6;
          const yy = cy - 10 + i * 9 + Math.sin(ph) * 2;
          const xx = cx - 18 + hash01(tile.v * 3 + i) * 20;
          ctx.beginPath();
          ctx.moveTo(xx, yy);
          ctx.quadraticCurveTo(xx + 6, yy - 3, xx + 12, yy);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'lava': {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        for (let i = 2; i < 8; i += 2) ctx.lineTo(top[i], top[i + 1]);
        ctx.closePath();
        ctx.clip();
        const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, HW);
        g.addColorStop(0, '#ffd54a');
        g.addColorStop(0.5, pal.lava[0]);
        g.addColorStop(1, pal.lava[1]);
        ctx.fillStyle = g;
        ctx.fillRect(cx - HW, cy - HH, HW * 2, HH * 2);
        for (let i = 0; i < 4; i++) {
          const ph = t * 0.8 + hash01(tile.v + i * 5) * 7;
          ell(ctx, cx - 22 + hash01(tile.v + i) * 44, cy - 8 + hash01(tile.v + i * 9) * 16, 5 + Math.sin(ph) * 2, 2.5, 'rgba(60,10,0,0.45)', null);
        }
        ctx.restore();
        break;
      }
      case 'sand':
        ctx.strokeStyle = rgba('#000000', 0.12);
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) {
          const yy = cy - 9 + i * 8;
          ctx.beginPath();
          ctx.moveTo(cx - 20 + i * 4, yy);
          ctx.quadraticCurveTo(cx - 4, yy - 5, cx + 16 - i * 3, yy + 1);
          ctx.stroke();
        }
        break;
      case 'ice':
        ell(ctx, cx - 10, cy - 4, 12, 4, 'rgba(255,255,255,0.35)', null, 1, -0.4);
        if (tile.hp <= 1) {
          ctx.strokeStyle = 'rgba(30,60,80,0.8)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(cx - 22, cy - 2);
          ctx.lineTo(cx - 6, cy + 2);
          ctx.lineTo(cx + 4, cy - 8);
          ctx.lineTo(cx + 20, cy - 4);
          ctx.moveTo(cx - 6, cy + 2);
          ctx.lineTo(cx - 2, cy + 12);
          ctx.stroke();
        }
        break;
      case 'rubble':
        for (let i = 0; i < 5; i++) {
          const rx = cx - 20 + hash01(tile.v + i) * 40;
          const ry = cy - 8 + hash01(tile.v + i * 7) * 16;
          poly(ctx, [rx - 4, ry, rx - 1, ry - 4, rx + 4, ry - 2, rx + 3, ry + 2], shade(pal.rubble, -0.25), 'rgba(0,0,0,0.4)', 1);
        }
        break;
      case 'building':
        poly(ctx, this.diamond(x, y, 0, 0.08), 'rgba(40,44,52,0.35)', null);
        break;
      default:
        if (tile.t === 'ground' || tile.t === 'forest') {
          ctx.fillStyle = rgba(pal.speck.length === 7 ? pal.speck : '#888888', 0.55);
          for (let i = 0; i < 4; i++) {
            const rx = cx - 22 + hash01(tile.v + i * 3) * 44;
            const ry = cy - 9 + hash01(tile.v + i * 11) * 18;
            if (Math.abs(rx - cx) / HW + Math.abs(ry - cy) / HH > 0.85) continue;
            ctx.fillRect(rx, ry, 2, 2);
          }
        }
    }
    if (tile.burnt && !tile.fire) poly(ctx, this.diamond(x, y, z, 0.12), 'rgba(20,14,10,0.35)', null);
    if (tile.acid) {
      ell(ctx, cx, cy, 20, 9, 'rgba(120,230,60,0.75)', 'rgba(40,90,20,0.9)', 1.5);
      for (let i = 0; i < 3; i++) {
        const ph = (t * 1.5 + hash01(tile.v + i)) % 1;
        ell(ctx, cx - 10 + i * 9, cy - 2 + Math.sin(i * 3) * 3, 2 + ph * 2, 1.4 + ph, `rgba(210,255,150,${1 - ph})`, null);
      }
    }
    if (tile.fire) {
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, HW * 0.7);
      g.addColorStop(0, 'rgba(255,170,60,0.55)');
      g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g;
      poly(ctx, this.diamond(x, y, z, 0.04), g, null);
    }
    if (tile.spawn) {
      const pulse = 0.5 + Math.sin(t * 4 + x) * 0.25;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, HW * 0.55);
      g.addColorStop(0, `rgba(255,60,40,${0.55 * pulse + 0.2})`);
      g.addColorStop(1, 'rgba(255,60,40,0)');
      poly(ctx, this.diamond(x, y, z, 0.02), g, null);
      ctx.strokeStyle = 'rgba(30,6,6,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + hash01(tile.v) * 2;
        ctx.moveTo(cx, cy);
        const r1 = 10 + hash01(tile.v + i) * 6;
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.5);
        ctx.lineTo(cx + Math.cos(a + 0.3) * (r1 + 9), cy + Math.sin(a + 0.3) * (r1 + 9) * 0.5);
      }
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const ph = (t * 1.3 + i / 3) % 1;
        ell(ctx, cx - 8 + i * 8, cy - ph * 8, 2, 2, `rgba(255,120,80,${1 - ph})`, null);
      }
    }
    if (tile.hazard) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(top[0], top[1]);
      for (let i = 2; i < 8; i += 2) ctx.lineTo(top[i], top[i + 1]);
      ctx.closePath();
      ctx.clip();
      const hc = s.hazard === 'airstrike' ? '#ffe14d' : s.hazard === 'tidal' ? '#5fd0ff' : s.hazard === 'icestorm' ? '#bff0ff' : s.hazard === 'acidrain' ? '#9dff5a' : s.hazard === 'sandstorm' ? '#e8d6a0' : '#ff8a3a';
      ctx.fillStyle = rgba(hc, 0.18 + Math.sin(t * 5) * 0.06);
      ctx.fillRect(cx - HW, cy - HH, HW * 2, HH * 2);
      ctx.strokeStyle = rgba(hc, 0.55);
      ctx.lineWidth = 4;
      for (let i = -6; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 14 - 20, cy - HH);
        ctx.lineTo(cx + i * 14 + 20, cy + HH);
        ctx.stroke();
      }
      ctx.restore();
      poly(ctx, top, 'rgba(0,0,0,0)', rgba(hc, 0.9), 2);
    }
  }

  // ---------------------------------------------------------------- overlays

  private fillTile(x: number, y: number, fill: string, stroke: string | null, inset = 0.04, lw = 2): void {
    poly(this.ctx, this.diamond(x, y, 0, inset), fill, stroke, lw);
  }

  private drawOverlays(s: BattleState, v: View, t: number): void {
    const ctx = this.ctx;
    if (v.deployTiles) {
      const pulse = 0.65 + Math.sin(t * 4) * 0.25;
      for (const i of v.deployTiles) this.fillTile(ix(i), iy(i), 'rgba(90,255,150,0.32)', `rgba(150,255,190,${pulse})`, 0.06, 2.5);
    }
    if (v.moveTiles) {
      for (const i of v.moveTiles) this.fillTile(ix(i), iy(i), 'rgba(80,190,255,0.22)', 'rgba(120,210,255,0.75)', 0.06, 1.5);
    }
    if (v.targetTiles) {
      const pulse = 0.55 + Math.sin(t * 6) * 0.2;
      for (const i of v.targetTiles) this.fillTile(ix(i), iy(i), 'rgba(255,200,60,0.12)', `rgba(255,207,74,${pulse})`, 0.08, 2);
    }
    if (v.preview) {
      for (const i of v.preview.tiles) this.fillTile(ix(i), iy(i), 'rgba(255,160,40,0.32)', 'rgba(255,190,70,0.95)', 0.04, 2);
    }
    // telegraphed tiles
    for (const th of v.threats) {
      if (th.cancel) continue;
      const dim = v.focusEnemy && v.focusEnemy !== th.id ? 0.35 : 1;
      for (const i of th.outcome.tiles) {
        const x = ix(i);
        const y = iy(i);
        ctx.save();
        ctx.globalAlpha = dim;
        const pts = this.diamond(x, y, 0, 0.05);
        poly(ctx, pts, 'rgba(255,60,40,0.2)', null);
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let k = 2; k < 8; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
        ctx.closePath();
        ctx.clip();
        const [cx, cy] = tileCenter(x, y);
        ctx.strokeStyle = 'rgba(255,70,50,0.35)';
        ctx.lineWidth = 3;
        const off = (t * 12) % 12;
        for (let k = -6; k < 6; k++) {
          ctx.beginPath();
          ctx.moveTo(cx + k * 12 - 18 + off, cy + HH);
          ctx.lineTo(cx + k * 12 + 18 + off, cy - HH);
          ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = dim;
        poly(ctx, this.diamond(x, y, 0, 0.05), 'rgba(0,0,0,0)', 'rgba(255,74,61,0.85)', 1.6);
        ctx.globalAlpha = 1;
      }
    }
    if (v.path && v.path.length > 1) {
      ctx.strokeStyle = 'rgba(200,240,255,0.95)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -t * 30;
      ctx.beginPath();
      v.path.forEach((i, k) => {
        const [cx, cy] = tileCenter(ix(i), iy(i));
        if (k === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      const last = v.path[v.path.length - 1];
      const [lx, ly] = tileCenter(ix(last), iy(last));
      ell(ctx, lx, ly, 7, 3.5, 'rgba(200,240,255,0.95)', null);
    }
    if (v.hover >= 0) {
      const x = ix(v.hover);
      const y = iy(v.hover);
      const drop = surfaceDrop(s.tiles[v.hover].t);
      poly(ctx, this.diamond(x, y, drop >= 40 ? -14 : -drop, 0.02), 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.9)', 2);
    }
  }

  // ---------------------------------------------------------------- objects & units

  private drawObjects(s: BattleState, v: View, pal: ThemePal, t: number): void {
    const ctx = this.ctx;
    type Item = { d: number; draw: () => void };
    const items: Item[] = [];
    const ov = v.overlay;
    for (let i = 0; i < 64; i++) {
      const tile = s.tiles[i];
      const x = ix(i);
      const y = iy(i);
      const [cx, cy] = tileCenter(x, y);
      const d = x + y;
      if (tile.t === 'building') {
        items.push({
          d,
          draw: () => {
            ctx.save();
            ctx.translate(cx, cy);
            drawBuilding(ctx, pal, tile.v, tile.hp, tile.maxHp, tile.obj, t);
            if (tile.shield) this.drawDome(tile.shield === 'ice' ? '#bff0ff' : '#6fd3ff', 30, 52, t, tile.shield === 'ice');
            ctx.restore();
          },
        });
      } else if (tile.t === 'mountain') {
        items.push({
          d,
          draw: () => {
            ctx.save();
            ctx.translate(cx, cy);
            drawMountain(ctx, pal, tile.v, tile.hp, s.theme === 'glacier');
            ctx.restore();
          },
        });
      } else if (tile.t === 'forest') {
        items.push({
          d: d - 0.02,
          draw: () => {
            ctx.save();
            ctx.translate(cx, cy);
            drawTrees(ctx, pal, tile.v, tile.fire, t);
            ctx.restore();
          },
        });
      }
      if (tile.fire && tile.t !== 'forest') {
        items.push({
          d: d - 0.01,
          draw: () => {
            for (let k = 0; k < 3; k++) {
              const fx = cx - 16 + k * 16 + Math.sin(k * 7) * 3;
              const fy = cy + (k === 1 ? -4 : 3);
              flame(ctx, fx, fy, 6 + hash01(tile.v + k) * 3, t + k * 0.7);
            }
          },
        });
      }
      if (tile.pod) {
        const drop = ov?.podDrop && ov.podDrop.x === x && ov.podDrop.y === y ? ov.podDrop.t : 1;
        items.push({
          d: d + 0.005,
          draw: () => {
            ctx.save();
            ctx.translate(cx, cy - (1 - drop) * 420);
            drawPod(ctx, t);
            ctx.restore();
          },
        });
      }
      if (tile.smoke > 0) {
        items.push({
          d: d + 0.6,
          draw: () => {
            for (let k = 0; k < 5; k++) {
              const ph = t * 0.5 + hash01(tile.v + k) * 6;
              const px = cx - 22 + k * 11 + Math.sin(ph) * 4;
              const py = cy - 10 - (k % 2) * 12 + Math.cos(ph) * 3;
              ell(ctx, px, py, 14, 10, 'rgba(150,158,168,0.55)', null);
            }
            ell(ctx, cx, cy - 22, 18, 11, 'rgba(185,192,200,0.5)', null);
          },
        });
      }
    }
    this.boxes = [];
    for (const u of s.units) {
      if (u.x < 0 || ov?.hide.has(u.id)) continue;
      const o = ov?.pos.get(u.id);
      const ux = o ? o.x : u.x;
      const uy = o ? o.y : u.y;
      items.push({ d: ux + uy + 0.01, draw: () => this.drawUnit(s, v, u, ux, uy, o?.z ?? 0, o?.alpha ?? 1, o?.scale ?? 1, t) });
    }
    if (ov) {
      for (const g of ov.ghosts) items.push({ d: g.x + g.y + 0.01, draw: () => this.drawUnit(s, v, g.u, g.x, g.y, g.z, g.alpha, g.scale, t, true) });
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.draw();
  }

  private drawDome(color: string, r: number, h: number, t: number, ice = false): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = ice ? 0.55 : 0.32 + Math.sin(t * 3) * 0.06;
    const g = ctx.createRadialGradient(0, -h * 0.5, 4, 0, -h * 0.5, r * 1.3);
    g.addColorStop(0, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.beginPath();
    if (ice) {
      ctx.moveTo(-r, -4);
      ctx.lineTo(-r, -h);
      ctx.lineTo(0, -h - 12);
      ctx.lineTo(r, -h);
      ctx.lineTo(r, -4);
      ctx.lineTo(0, 8);
      ctx.closePath();
    } else ctx.ellipse(0, -h * 0.45, r, h * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  private drawUnit(s: BattleState, v: View, u: Unit, fx: number, fy: number, z: number, alpha: number, scale: number, t: number, ghost = false): void {
    const ctx = this.ctx;
    const def = UNITS[u.def];
    const rx = Math.round(fx);
    const ry = Math.round(fy);
    const tile = rx >= 0 && ry >= 0 && rx < 8 && ry < 8 ? s.tiles[idx(rx, ry)] : null;
    const sinkable = tile && (tile.t === 'water' || tile.t === 'lava') && !u.flying;
    const drop = sinkable ? surfaceDrop(tile.t) : 0;
    const [cx, cy0] = tileCenter(fx, fy);
    const cy = cy0 + drop;
    const size = (def.size ?? 1) * scale;
    const flash = v.overlay?.flash.get(u.id) ?? 0;
    ctx.save();
    ctx.globalAlpha = alpha;
    // shadow
    if (!sinkable) ell(ctx, cx, cy, 17 * size, 7 * size, 'rgba(0,0,0,0.32)', null);
    // selection ring
    if (v.selected === u.id && !ghost) {
      ell(ctx, cx, cy, 24, 11, 'rgba(0,0,0,0)', PLAYER, 2.5);
      ell(ctx, cx, cy, 28 + Math.sin(t * 5) * 2, 13, 'rgba(0,0,0,0)', rgba(PLAYER, 0.4), 1.5);
    } else if (v.idleGlow.has(u.id) && !ghost) {
      ell(ctx, cx, cy, 22, 10, 'rgba(0,0,0,0)', rgba('#7ff3ff', 0.45 + Math.sin(t * 4) * 0.2), 2);
    }
    if (v.focusEnemy === u.id || v.overlay?.focus === u.id) ell(ctx, cx, cy, 24, 11, 'rgba(0,0,0,0)', ENEMY, 2.5);
    ctx.translate(cx, cy - z);
    if (sinkable) {
      ctx.beginPath();
      ctx.rect(-60, -120, 120, 120 - 2);
      ctx.clip();
      ctx.translate(0, 9);
    }
    ctx.scale(size * u.face, size);
    if (def.kind === 'mech') drawMech(ctx, def.sprite, v.pal, t + u.id, u.dead);
    else if (def.kind === 'npc') drawMech(ctx, def.sprite, v.pal, t + u.id);
    else drawVek(ctx, def.sprite, { alpha: u.alpha, boss: u.boss, psion: def.psion }, t + u.id * 0.37);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = alpha;
    const h = spriteHeight(u) * scale;
    ctx.translate(cx, cy - z);
    if (sinkable) {
      ctx.fillStyle = tile!.t === 'lava' ? 'rgba(255,120,40,0.5)' : 'rgba(110,190,230,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (u.frozen) {
      ctx.globalAlpha = alpha * 0.75;
      poly(ctx, [-20, -2, -22, -h - 4, 0, -h - 12, 22, -h - 4, 20, -2, 0, 8], 'rgba(190,240,255,0.55)', 'rgba(230,250,255,0.95)', 2);
      ctx.globalAlpha = alpha;
    }
    if (u.shield) this.drawDome('#6fd3ff', 24, h + 6, t);
    if (u.fire && !u.dead) {
      flame(ctx, -8, -h * 0.35, 5, t * 1.2 + u.id);
      flame(ctx, 7, -h * 0.55, 4, t * 1.3 + u.id * 2);
    }
    if (u.acid && !u.dead) {
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.9 + k / 3) % 1;
        ell(ctx, -10 + k * 10, -h * 0.6 + ph * h * 0.5, 2.2, 3, `rgba(140,255,80,${1 - ph})`, null);
      }
    }
    if (u.dead && !ghost) {
      if (Math.random() < 0.08) this.fx.smoke(cx + (Math.random() - 0.5) * 10, cy - 20, 6, '#3c3c3c');
    }
    if (u.webbedBy) {
      const w = unitById(s, u.webbedBy);
      if (w) {
        const [wx, wy] = tileCenter(w.x, w.y);
        ctx.strokeStyle = 'rgba(235,235,235,0.75)';
        ctx.lineWidth = 1.2;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(k * 6, -h * 0.5);
          ctx.quadraticCurveTo((wx - cx) * 0.5 + k * 5, (wy - cy) * 0.5 - h * 0.3, wx - cx, wy - cy - 14);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(235,235,235,0.6)';
        for (let r = 6; r < 22; r += 7) {
          ctx.beginPath();
          ctx.ellipse(0, -h * 0.45, r, r * 0.6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    if (flash > 0) {
      const g = ctx.createRadialGradient(0, -h * 0.45, 2, 0, -h * 0.45, 34);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * flash})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -h * 0.45, 34, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (!ghost) this.boxes.push({ id: u.id, x0: cx - 22, y0: cy - z - h - 6, x1: cx + 22, y1: cy + 8, d: fx + fy });
  }

  // ---------------------------------------------------------------- telegraphs & previews

  private arrowHead(x: number, y: number, ang: number, color: string, size = 9): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    poly(ctx, [0, 0, -size, -size * 0.6, -size, size * 0.6], color, INK, 1.5);
    ctx.restore();
  }

  private pushArrow(x: number, y: number, dir: Dir, color: string, blocked = false): void {
    const [cx, cy] = tileCenter(x, y);
    const vx = (DX[dir] - DY[dir]) * HW;
    const vy = (DX[dir] + DY[dir]) * HH;
    const len = Math.hypot(vx, vy);
    const ux = vx / len;
    const uy = vy / len;
    const ctx = this.ctx;
    const x0 = cx - ux * 14;
    const y0 = cy - uy * 14;
    const x1 = cx + ux * 22;
    const y1 = cy + uy * 22;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    this.arrowHead(x1 + ux * 6, y1 + uy * 6, Math.atan2(uy, ux), color, 11);
    if (blocked) {
      ctx.strokeStyle = '#ff3b30';
      ctx.lineWidth = 3;
      const bx = x1 + ux * 12;
      const by = y1 + uy * 12;
      ctx.beginPath();
      ctx.moveTo(bx - 5, by - 5);
      ctx.lineTo(bx + 5, by + 5);
      ctx.moveTo(bx + 5, by - 5);
      ctx.lineTo(bx - 5, by + 5);
      ctx.stroke();
    }
  }

  private badge(x: number, y: number, text: string, bg: string, fg = '#fff', size = 13): void {
    const ctx = this.ctx;
    ctx.font = `700 ${size}px "Chakra Petch", system-ui, sans-serif`;
    const w = Math.max(18, ctx.measureText(text).width + 10);
    rrect(ctx, x - w / 2, y - size / 2 - 4, w, size + 8, 4, bg, INK, 1.5);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.textBaseline = 'alphabetic';
  }

  /** Damage badges float above tall objects so they never hide units standing in front. */
  private badgeY(s: BattleState, i: number, cy: number): number {
    const t = s.tiles[i];
    if (t.t === 'building') return cy - (t.maxHp >= 2 ? 70 : 50);
    if (t.t === 'mountain') return cy - 44;
    return cy + 8;
  }

  private statusIcon(kind: string, x: number, y: number): void {
    const ctx = this.ctx;
    const bg: Record<string, string> = { armor: '#9aa3ad', fire: '#ff8a2a', acid: '#7ddc3a', frozen: '#9fe6ff', shield: '#4fb8ff', web: '#e8e8e8', smoke: '#9aa0a8' };
    ell(ctx, x, y, 6.5, 6.5, bg[kind] ?? '#888', INK, 1.2);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    switch (kind) {
      case 'armor':
      case 'shield':
        ctx.moveTo(0, -4);
        ctx.lineTo(3.5, -2.5);
        ctx.lineTo(3, 1.5);
        ctx.lineTo(0, 4);
        ctx.lineTo(-3, 1.5);
        ctx.lineTo(-3.5, -2.5);
        ctx.closePath();
        if (kind === 'armor') ctx.stroke();
        else ctx.fill();
        break;
      case 'fire':
        ctx.moveTo(0, -4.5);
        ctx.quadraticCurveTo(4, 0, 2.5, 3.5);
        ctx.lineTo(-2.5, 3.5);
        ctx.quadraticCurveTo(-4, 0, 0, -4.5);
        ctx.fill();
        break;
      case 'acid':
        ctx.moveTo(0, -4.5);
        ctx.quadraticCurveTo(4, 1, 0, 4);
        ctx.quadraticCurveTo(-4, 1, 0, -4.5);
        ctx.fill();
        break;
      case 'frozen':
        for (let a = 0; a < 3; a++) {
          const r = (a * Math.PI) / 3;
          ctx.moveTo(Math.cos(r) * 4, Math.sin(r) * 4);
          ctx.lineTo(-Math.cos(r) * 4, -Math.sin(r) * 4);
        }
        ctx.stroke();
        break;
      case 'web':
        ctx.moveTo(-4, 0);
        ctx.lineTo(4, 0);
        ctx.moveTo(0, -4);
        ctx.lineTo(0, 4);
        ctx.moveTo(-3, -3);
        ctx.lineTo(3, 3);
        ctx.moveTo(3, -3);
        ctx.lineTo(-3, 3);
        ctx.stroke();
        break;
      case 'smoke':
        ctx.arc(-1.5, 0.5, 2.3, 0, Math.PI * 2);
        ctx.arc(1.8, -0.5, 2.6, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  private skull(x: number, y: number): void {
    const ctx = this.ctx;
    ell(ctx, x, y, 8, 7.5, '#f4f1e8', INK, 1.5);
    rrect(ctx, x - 5, y + 3, 10, 6, 2, '#f4f1e8', INK, 1.5);
    ell(ctx, x - 3, y - 0.5, 2, 2.2, INK, null);
    ell(ctx, x + 3, y - 0.5, 2, 2.2, INK, null);
  }

  private attackPath(e: { k: string; v?: Vfx; fx?: number; fy?: number; tx?: number; ty?: number }, color: string, t: number, alpha: number): void {
    if (e.k !== 'vfx' || e.fx === undefined || e.tx === undefined || e.fy === undefined || e.ty === undefined) return;
    const ctx = this.ctx;
    const [ax, ay] = tileCenter(e.fx, e.fy);
    const [bx, by] = tileCenter(e.tx, e.ty);
    ctx.save();
    ctx.globalAlpha = alpha;
    const lift = 22;
    switch (e.v) {
      case 'arc':
      case 'frost':
      case 'shield': {
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2 - 70 - Math.hypot(bx - ax, by - ay) * 0.15;
        ctx.setLineDash([7, 6]);
        ctx.lineDashOffset = -t * 30;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(ax, ay - lift);
        ctx.quadraticCurveTo(mx, my, bx, by - 4);
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.setLineDash([]);
        const ang = Math.atan2(by - 4 - my, bx - mx);
        this.arrowHead(bx, by - 4, ang, color, 10);
        break;
      }
      case 'pulse':
      case 'explode':
      case 'wind':
        break;
      default: {
        if (e.fx === e.tx && e.fy === e.ty) break;
        ctx.setLineDash(e.v === 'punch' ? [] : [8, 5]);
        ctx.lineDashOffset = -t * 40;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(ax, ay - lift);
        ctx.lineTo(bx, by - lift * 0.5);
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.setLineDash([]);
        this.arrowHead(bx, by - lift * 0.5, Math.atan2(by - ay + lift * 0.5, bx - ax), color, 11);
      }
    }
    ctx.restore();
  }

  private drawThreats(s: BattleState, v: View, t: number): void {
    const ctx = this.ctx;
    const pend = v.overlay ? null : v;
    for (const th of v.threats) {
      const e = unitById(s, th.id);
      if (!e) continue;
      const focus = v.focusEnemy === th.id;
      const alpha = v.focusEnemy && !focus ? 0.3 : 1;
      if (th.cancel) {
        const [cx, cy] = tileCenter(e.x, e.y);
        ctx.globalAlpha = 0.9;
        this.badge(cx + 20, cy - spriteHeight(e) - 4, th.cancel === 'smoke' ? 'SMOKED' : th.cancel === 'frozen' ? 'FROZEN' : th.cancel === 'water' ? 'SUBMERGED' : th.cancel === 'dead' ? 'DIES FIRST' : 'NO TARGET', '#38404c', '#cfe3f2', 10);
        ctx.globalAlpha = 1;
        continue;
      }
      for (const ef of th.outcome.effects) this.attackPath(ef, ENEMY, t, alpha * 0.95);
      ctx.globalAlpha = alpha;
      for (const ef of th.outcome.effects) {
        if (ef.k !== 'dmg') continue;
        if (ef.push !== undefined) this.pushArrow(ef.x, ef.y, ef.push, '#ffffff');
      }
      // damage badges per tile
      const per = new Map<number, number>();
      for (const ef of th.outcome.effects) if (ef.k === 'dmg' && ef.amt > 0) per.set(idx(ef.x, ef.y), Math.max(per.get(idx(ef.x, ef.y)) ?? 0, ef.amt));
      if (pend) {
        for (const [i, amt] of per) {
          const [cx, cy] = tileCenter(ix(i), iy(i));
          this.badge(cx, this.badgeY(s, i, cy), String(amt), '#b3261e');
        }
      }
      for (const [i] of th.outcome.buildingLoss) {
        const [cx, cy] = tileCenter(ix(i), iy(i));
        const bob = Math.sin(t * 6) * 2;
        const top = s.tiles[i].maxHp >= 2 ? 112 : 92;
        poly(ctx, [cx, cy - top + bob, cx + 11, cy - top + 20 + bob, cx - 11, cy - top + 20 + bob], '#ffd23f', INK, 2);
        ctx.fillStyle = INK;
        ctx.font = '800 13px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('!', cx, cy - top + 17 + bob);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawPreview(s: BattleState, v: View, p: Outcome, t: number): void {
    const ctx = this.ctx;
    for (const ef of p.effects) this.attackPath(ef, PLAYER, t, 1);
    for (const ef of p.effects) {
      if (ef.k === 'dmg' && ef.push !== undefined) this.pushArrow(ef.x, ef.y, ef.push, PLAYER);
      if (ef.k === 'move') {
        const u = unitById(s, ef.id);
        if (!u) continue;
        const [ax, ay] = tileCenter(u.x, u.y);
        const [bx, by] = tileCenter(ef.x, ef.y);
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.setLineDash([]);
        ell(ctx, bx, by, 14, 7, 'rgba(255,255,255,0.25)', '#ffffff', 2);
      }
    }
    const per = new Map<number, number>();
    for (const ef of p.effects) if (ef.k === 'dmg' && ef.amt > 0) per.set(idx(ef.x, ef.y), Math.max(per.get(idx(ef.x, ef.y)) ?? 0, ef.amt));
    for (const [i, amt] of per) {
      const [cx, cy] = tileCenter(ix(i), iy(i));
      this.badge(cx, this.badgeY(s, i, cy), String(amt), '#c77d00');
    }
    for (const [i, lost] of p.buildingLoss) {
      const [cx, cy] = tileCenter(ix(i), iy(i));
      this.badge(cx, this.badgeY(s, i, cy) - 24, `-${lost} GRID`, '#b3261e', '#fff', 12);
    }
    for (const id of p.deaths) {
      const u = unitById(s, id);
      if (!u || u.x < 0) continue;
      const [cx, cy] = tileCenter(u.x, u.y);
      this.skull(cx, cy - spriteHeight(u) - 26);
    }
  }

  private drawShots(v: View, t: number): void {
    const ov = v.overlay;
    if (!ov) return;
    const ctx = this.ctx;
    for (const sh of ov.shots) {
      const [ax, ay] = tileCenter(sh.fx, sh.fy);
      const [bx, by] = tileCenter(sh.tx, sh.ty);
      const k = Math.min(1, sh.t);
      const color = sh.v === 'spit' ? '#ff8a3a' : sh.v === 'frost' ? '#bff0ff' : sh.v === 'shield' ? '#6fd3ff' : '#fff1a8';
      switch (sh.v) {
        case 'arc':
        case 'frost':
        case 'shield': {
          const h = 90 + Math.hypot(bx - ax, by - ay) * 0.2;
          const x = ax + (bx - ax) * k;
          const y = ay - 26 + (by - ay + 26) * k - Math.sin(k * Math.PI) * h;
          ell(ctx, x, y, 6, 6, color, INK, 1.5);
          ell(ctx, x, y, 10, 10, rgba(sh.v === 'frost' ? '#bff0ff' : '#ffd36b', 0.3), null);
          break;
        }
        case 'beam': {
          ctx.globalAlpha = 1 - k * 0.6;
          ctx.strokeStyle = '#ff6b6b';
          ctx.lineWidth = 10 * (1 - k) + 3;
          ctx.beginPath();
          ctx.moveTo(ax, ay - 24);
          ctx.lineTo(bx, by - 20);
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'bolt': {
          ctx.strokeStyle = '#fff6a0';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(ax, ay - 24);
          for (let i = 1; i <= 6; i++) {
            const f = i / 6;
            ctx.lineTo(ax + (bx - ax) * f + (i < 6 ? (Math.random() - 0.5) * 16 : 0), ay - 24 + (by - ay) * f + (i < 6 ? (Math.random() - 0.5) * 12 : 4));
          }
          ctx.stroke();
          break;
        }
        case 'flame': {
          for (let i = 0; i < 6; i++) {
            const f = Math.min(1, k * 1.3) * (i / 5);
            const x = ax + (bx - ax) * f;
            const y = ay - 20 + (by - ay + 12) * f;
            ell(ctx, x, y, 8 + i * 1.5, 6 + i, i % 2 ? 'rgba(255,140,40,0.85)' : 'rgba(255,220,90,0.85)', null);
          }
          break;
        }
        case 'hook': {
          const x = ax + (bx - ax) * k;
          const y = ay - 22 + (by - ay) * k;
          ctx.strokeStyle = '#d0d6dc';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ax, ay - 22);
          ctx.lineTo(x, y);
          ctx.stroke();
          ell(ctx, x, y, 4, 4, '#9aa3ad', INK, 1.5);
          break;
        }
        case 'pulse':
        case 'explode': {
          ell(ctx, bx, by, 10 + k * 46, 5 + k * 23, 'rgba(0,0,0,0)', sh.v === 'explode' ? `rgba(255,160,60,${1 - k})` : `rgba(140,220,255,${1 - k})`, 4);
          break;
        }
        case 'wind': {
          ctx.strokeStyle = `rgba(220,240,255,${0.8 * (1 - k)})`;
          ctx.lineWidth = 2;
          for (let i = 0; i < 10; i++) {
            const y = 40 + i * 40;
            const x = -400 + ((k * 900 + i * 97) % 800);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 60, y + 30);
            ctx.stroke();
          }
          break;
        }
        case 'swap': {
          ell(ctx, ax, ay - 20, 16 * (1 - k) + 2, 26 * (1 - k) + 2, 'rgba(0,0,0,0)', '#9ff3ff', 3);
          ell(ctx, bx, by - 20, 16 * k + 2, 26 * k + 2, 'rgba(0,0,0,0)', '#9ff3ff', 3);
          break;
        }
        case 'punch':
          break;
        default: {
          const x = ax + (bx - ax) * k;
          const y = ay - 24 + (by - ay + 8) * k;
          ctx.strokeStyle = rgba(color, 0.5);
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(ax + (bx - ax) * Math.max(0, k - 0.25), ay - 24 + (by - ay + 8) * Math.max(0, k - 0.25));
          ctx.lineTo(x, y);
          ctx.stroke();
          ell(ctx, x, y, 5, 5, color, INK, 1.5);
        }
      }
    }
  }

  private drawUnitHud(s: BattleState, v: View, t: number): void {
    const ctx = this.ctx;
    const ov = v.overlay;
    const predicted = new Map<number, number>();
    const doomed = new Set<number>();
    if (v.preview) {
      for (const [id, hp] of v.preview.hpAfter) predicted.set(id, hp);
      for (const id of v.preview.deaths) doomed.add(id);
    } else if (!ov) {
      for (const th of v.threats) {
        if (th.cancel) continue;
        for (const [id, hp] of th.outcome.hpAfter) {
          const u = unitById(s, id);
          if (u && u.team !== 'enemy') predicted.set(id, Math.min(predicted.get(id) ?? hp, hp));
        }
      }
    }
    const blink = Math.sin(t * 9) > 0;
    for (const u of s.units) {
      if (u.x < 0 || u.dead || ov?.hide.has(u.id)) continue;
      const o = ov?.pos.get(u.id);
      const fx = o ? o.x : u.x;
      const fy = o ? o.y : u.y;
      const [cx, cy0] = tileCenter(fx, fy);
      const tile = s.tiles[idx(Math.round(fx), Math.round(fy))];
      const sink = tile && !u.flying && (tile.t === 'water' || tile.t === 'lava') ? surfaceDrop(tile.t) : 0;
      const cy = cy0 + sink - (o?.z ?? 0);
      const h = spriteHeight(u);
      const enemy = u.team === 'enemy';
      const pipW = u.maxHp > 6 ? 6 : 8;
      const w = u.maxHp * pipW + 4;
      const x0 = cx - w / 2;
      const y0 = cy - h - 16;
      rrect(ctx, x0, y0, w, 9, 2, '#11151c', INK, 1.5);
      const after = predicted.get(u.id);
      for (let i = 0; i < u.maxHp; i++) {
        const filled = i < u.hp;
        let col = filled ? (enemy ? '#ff6b4a' : u.team === 'neutral' ? '#ffd23f' : '#5ef08a') : '#2c333d';
        if (filled && after !== undefined && i >= after) col = blink ? '#ffffff' : '#ff2d2d';
        ctx.fillStyle = col;
        ctx.fillRect(x0 + 2 + i * pipW, y0 + 2, pipW - 2, 5);
      }
      // status icons
      const icons: string[] = [];
      if (isArmored(s, u)) icons.push('armor');
      if (u.fire) icons.push('fire');
      if (u.acid) icons.push('acid');
      if (u.frozen) icons.push('frozen');
      if (u.shield) icons.push('shield');
      if (u.webbedBy) icons.push('web');
      if (s.tiles[idx(u.x, u.y)].smoke > 0 && !u.smokeImmune) icons.push('smoke');
      icons.forEach((kind, k) => this.statusIcon(kind, x0 + w + 9 + k * 14, y0 + 4.5));
      if (enemy && u.plan && v.showOrder) {
        const bx = x0 - 9;
        ell(ctx, bx, y0 + 4.5, 7.5, 7.5, v.focusEnemy === u.id ? ENEMY : '#2a0f10', ENEMY, 1.5);
        ctx.fillStyle = '#fff';
        ctx.font = '700 10px "Chakra Petch", system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(String(u.plan.order), bx, y0 + 8.5);
      }
      if (isMech(u) && doomed.has(u.id)) this.skull(cx, y0 - 14);
      if (!enemy && after !== undefined && after <= 0 && !v.preview) this.skull(cx, y0 - 14);
    }
  }
}

/** Renders a battle board into an offscreen canvas (island previews). */
export function renderThumb(s: BattleState, w: number, h: number, pal: SquadPalette, transparent = true): { canvas: HTMLCanvasElement; map: (fx: number, fy: number) => [number, number] } {
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const r = new Renderer(c);
  r.dpr = dpr;
  r.cw = w;
  r.ch = h;
  r.transparent = transparent;
  r.layout();
  r.draw(s, emptyView(pal), 0.3);
  return {
    canvas: c,
    map: (fx, fy) => {
      const [cx, cy] = tileCenter(fx, fy);
      return [r.ox + cx * r.scale, r.oy + cy * r.scale];
    },
  };
}
