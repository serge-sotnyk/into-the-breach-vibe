// Replays recorded battle steps. Logic resolves instantly; this only animates the
// sequence of snapshots with tweens, particles and sound cues.

import type { AnimEv, BattleState, Step, Unit } from '../game/types';
import { t, tn } from '../i18n';
import { unitById, isMech } from '../game/battle/board';
import { tileCenter } from './iso';
import type { Overlay, Renderer } from './renderer';

export interface AnimHooks {
  sound(name: string): void;
  banner(ev: Extract<AnimEv, { e: 'banner' }>): void;
}

function emptyOverlay(): Overlay {
  return { pos: new Map(), hide: new Set(), ghosts: [], shots: [], flash: new Map(), focus: 0, podDrop: null };
}

const BASE_STATE_EVENTS = new Set(['move', 'slide', 'bump', 'nopush', 'vfx', 'plan']);

export class Animator {
  private queue: Step[] = [];
  private cur: Step | null = null;
  private base: BattleState | null = null;
  private t = 0;
  private dur = 0;
  speed = 1;
  /** Called when the queue drains. */
  onIdle: (() => void) | null = null;

  constructor(private r: Renderer, private hooks: AnimHooks) {}

  get busy(): boolean {
    return this.cur !== null || this.queue.length > 0;
  }

  play(before: BattleState, steps: Step[]): void {
    if (!this.busy) this.base = before;
    this.queue.push(...steps);
  }

  skip(): void {
    if (!this.busy) return;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.cur;
    this.queue = [];
    this.cur = null;
    this.base = last ? last.snap : this.base;
    this.r.fx.clear();
    this.onIdle?.();
  }

  update(dt: number): void {
    if (!this.busy) return;
    let budget = dt * 1000 * this.speed;
    let guard = 0;
    while (budget > 0 && guard++ < 50 && this.busy) {
      if (!this.cur) {
        const next = this.queue.shift()!;
        this.cur = next;
        this.t = 0;
        this.dur = this.duration(next.ev);
        this.onStart(next.ev);
      }
      const left = this.dur - this.t;
      if (budget < left) {
        this.t += budget;
        budget = 0;
      } else {
        budget -= left;
        this.t = this.dur;
        this.onEnd(this.cur.ev);
        this.base = this.cur.snap;
        this.cur = null;
      }
    }
    // fire exactly once, on the transition from busy to idle
    if (!this.busy) this.onIdle?.();
  }

  /** State to draw right now plus tweening overlay. */
  display(): { state: BattleState; overlay: Overlay } | null {
    if (!this.busy || !this.base) return null;
    const ov = emptyOverlay();
    if (!this.cur) return { state: this.base, overlay: ov };
    const ev = this.cur.ev;
    const k = this.dur > 0 ? Math.min(1, this.t / this.dur) : 1;
    const before = this.base;
    const after = this.cur.snap;
    const state = BASE_STATE_EVENTS.has(ev.e) ? before : after;
    switch (ev.e) {
      case 'move': {
        const n = ev.path.length - 1;
        const f = k * n;
        const seg = Math.min(n - 1, Math.floor(f));
        const a = ev.path[seg];
        const b = ev.path[seg + 1] ?? a;
        const kk = f - seg;
        const u = unitById(before, ev.id);
        const hop = u && !u.flying ? Math.abs(Math.sin(kk * Math.PI)) * 3 : 0;
        ov.pos.set(ev.id, { x: (a % 8) + ((b % 8) - (a % 8)) * kk, y: Math.floor(a / 8) + (Math.floor(b / 8) - Math.floor(a / 8)) * kk, z: hop });
        break;
      }
      case 'slide': {
        const e = ev;
        let kk = k;
        let z = 0;
        let alpha = 1;
        if (e.style === 'push' || e.style === 'pull' || e.style === 'charge') kk = 1 - (1 - k) * (1 - k);
        if (e.style === 'leap' || e.style === 'throw' || e.style === 'fly') z = Math.sin(k * Math.PI) * (e.style === 'fly' ? 46 : 60);
        if (e.style === 'teleport') {
          alpha = k < 0.5 ? 1 - k * 2 : (k - 0.5) * 2;
          kk = k < 0.5 ? 0 : 1;
        }
        ov.pos.set(e.id, { x: e.fx + (e.tx - e.fx) * kk, y: e.fy + (e.ty - e.fy) * kk, z, alpha });
        break;
      }
      case 'bump':
      case 'nopush': {
        const u = unitById(before, ev.id);
        if (u) {
          const amp = ev.e === 'bump' ? 0.28 : 0.1;
          const o = Math.sin(k * Math.PI) * amp;
          const dx = [0, 1, 0, -1][ev.dir];
          const dy = [-1, 0, 1, 0][ev.dir];
          ov.pos.set(u.id, { x: u.x + dx * o, y: u.y + dy * o, z: 0 });
        }
        break;
      }
      case 'hit':
        ov.flash.set(ev.id, 1 - k);
        break;
      case 'die': {
        const u = unitById(before, ev.id);
        if (u && ev.x >= 0) {
          const sinking = ev.how === 'drown' || ev.how === 'fall' || ev.how === 'burn';
          if (!isMech(u) || sinking) {
            ov.ghosts.push({ u: { ...u, dead: isMech(u) } as Unit, x: ev.x, y: ev.y, z: sinking ? -k * (ev.how === 'fall' ? 60 : 24) : k * 6, alpha: 1 - k, scale: sinking ? 1 - k * 0.3 : 1 + k * 0.25 });
          }
        }
        break;
      }
      case 'spawn': {
        const u = unitById(after, ev.id);
        if (u) ov.pos.set(u.id, { x: u.x, y: u.y, z: -26 * (1 - k), alpha: Math.min(1, k * 1.6) });
        break;
      }
      case 'vfx': {
        ov.shots.push({ v: ev.v, fx: ev.fx, fy: ev.fy, tx: ev.tx, ty: ev.ty, t: k });
        if (ev.v === 'punch') {
          const u = before.units.find((x) => x.x === ev.fx && x.y === ev.fy && !x.dead);
          if (u) {
            const o = Math.sin(k * Math.PI) * 0.3;
            ov.pos.set(u.id, { x: u.x + (ev.tx - ev.fx) * o, y: u.y + (ev.ty - ev.fy) * o, z: 0 });
          }
        }
        break;
      }
      case 'plan':
        ov.focus = ev.id;
        break;
      case 'pod':
        if (ev.what === 'land') ov.podDrop = { x: ev.x, y: ev.y, t: k * k };
        break;
    }
    return { state, overlay: ov };
  }

  private duration(ev: AnimEv): number {
    switch (ev.e) {
      case 'move':
        return Math.min(800, 95 * Math.max(1, ev.path.length - 1));
      case 'slide':
        return { push: 170, pull: 230, charge: 230, leap: 420, throw: 420, teleport: 300, fly: 480 }[ev.style] ?? 200;
      case 'bump':
        return 190;
      case 'nopush':
        return 110;
      case 'hit':
        return 170;
      case 'block':
        return 300;
      case 'die':
        return 380;
      case 'building':
        return 380;
      case 'terrain':
        return 260;
      case 'status':
        return 150;
      case 'vfx':
        return { punch: 150, shot: 200, spit: 240, arc: 460, beam: 300, hook: 240, pulse: 260, bolt: 220, flame: 300, frost: 440, explode: 260, wind: 520, swap: 200, shield: 420 }[ev.v] ?? 220;
      case 'spawn':
        return 420;
      case 'spawnBlocked':
        return 360;
      case 'hazard':
        return 380;
      case 'banner':
        return 900;
      case 'heal':
        return 280;
      case 'plan':
        return 210;
      case 'pod':
        return ev.what === 'land' ? 700 : 320;
      case 'tick':
        return ev.what === 'spawnMark' ? 100 : ev.what === 'hazardMark' ? 140 : 280;
      case 'flip':
        return 280;
      case 'pause':
        return ev.ms;
    }
    return 200;
  }

  private at(x: number, y: number, lift = 0): [number, number] {
    const [cx, cy] = tileCenter(x, y);
    return [cx, cy - lift];
  }

  private onStart(ev: AnimEv): void {
    const fx = this.r.fx;
    const S = this.hooks.sound;
    switch (ev.e) {
      case 'move': {
        const u = this.base ? unitById(this.base, ev.id) : undefined;
        S(u && u.team === 'enemy' ? 'skitter' : 'move');
        break;
      }
      case 'slide':
        S(ev.style === 'teleport' ? 'swap' : ev.style === 'leap' || ev.style === 'throw' || ev.style === 'fly' ? 'whoosh' : 'push');
        break;
      case 'bump':
        break;
      case 'hit': {
        const [x, y] = this.at(ev.x, ev.y, 22);
        fx.sparks(x, y + 10, '#ffd36b', 8);
        fx.text(x, y - 10, `-${ev.amt}`, '#ff5a4a', 20);
        fx.shake = Math.max(fx.shake, 3 + ev.amt);
        S('hit');
        break;
      }
      case 'block': {
        const [x, y] = this.at(ev.x, ev.y, 26);
        const label = t(`fx.block.${ev.kind}`);
        fx.text(x, y - 6, label, ev.kind === 'grid' ? '#ffe066' : '#9fe6ff', 15);
        if (ev.kind === 'ice') fx.frost(x, y + 10);
        else fx.ring(x, y + 18, '#6fd3ff', 30);
        S(ev.kind === 'grid' ? 'resist' : 'shield');
        break;
      }
      case 'die': {
        if (ev.x < 0) break;
        const [x, y] = this.at(ev.x, ev.y, 12);
        const u = this.base ? unitById(this.base, ev.id) : undefined;
        const mech = !!u && isMech(u);
        if (ev.how === 'drown') {
          fx.splash(x, y + 10);
          fx.text(x, y - 20, t('fx.drowned'), '#8fdcff', 15);
          S('splash');
        } else if (ev.how === 'fall') {
          fx.dust(x, y + 10, '#3a2f2a');
          fx.text(x, y - 20, t('fx.fell'), '#d8c7b8', 15);
          S('fall');
        } else if (ev.how === 'burn' && !mech) {
          fx.embers(x, y, 14);
          fx.text(x, y - 20, t('fx.incinerated'), '#ffb347', 15);
          S('fire');
        } else {
          fx.explosion(x, y, mech ? 1.4 : 0.9);
          if (!mech) fx.debris(x, y, u ? '#7a4a2a' : '#555', 8);
        }
        if (mech) {
          fx.text(x, y - 34, t('fx.mechDestroyed'), '#ff5a4a', 16, 1.6);
          S('mechdown');
        } else if (ev.how !== 'drown' && ev.how !== 'fall') S('die');
        break;
      }
      case 'building': {
        const [x, y] = this.at(ev.x, ev.y, 20);
        fx.explosion(x, y, 0.8);
        fx.debris(x, y - 10, '#9a8f80', 14);
        for (let i = 0; i < 4; i++) fx.smoke(x + (Math.random() - 0.5) * 30, y, 10, '#4a4a4a');
        fx.text(x, y - 40, tn('fx.gridPower', ev.lost), '#ff5a4a', 17, 1.6);
        fx.shake = Math.max(fx.shake, 8);
        S('building');
        break;
      }
      case 'terrain': {
        const [x, y] = this.at(ev.x, ev.y, 6);
        switch (ev.what) {
          case 'rockfall':
          case 'crack':
            fx.debris(x, y - 20, '#8a8070', ev.what === 'rockfall' ? 16 : 6);
            fx.dust(x, y, '#9a917f', ev.what === 'rockfall' ? 10 : 4);
            S('crumble');
            break;
          case 'dust':
            fx.dust(x, y, '#d8c27f', 12);
            S('sand');
            break;
          case 'shatter':
          case 'freeze':
            fx.frost(x, y);
            if (ev.what === 'shatter') fx.splash(x, y);
            S('freeze');
            break;
          case 'flood':
          case 'splash':
            fx.splash(x, y);
            S('splash');
            break;
          case 'collapse':
            fx.debris(x, y, '#3a2f2a', 14);
            fx.dust(x, y, '#5a4a3a', 10);
            fx.shake = Math.max(fx.shake, 6);
            S('crumble');
            break;
        }
        break;
      }
      case 'status': {
        const [x, y] = this.at(ev.x, ev.y, 20);
        switch (ev.what) {
          case 'fire':
          case 'burn':
            fx.embers(x, y + 14, 8);
            if (ev.what === 'fire') fx.text(x, y - 16, t('fx.onFire'), '#ffb347', 14);
            S('fire');
            break;
          case 'acid':
          case 'acidpool':
            fx.text(x, y - 16, ev.what === 'acid' ? t('status.acid') : '', '#9dff5a', 14);
            S('acid');
            break;
          case 'freeze':
          case 'iceblock':
            fx.frost(x, y + 10);
            fx.text(x, y - 16, t('fx.frozen'), '#bff0ff', 14);
            S('freeze');
            break;
          case 'smoke':
            for (let i = 0; i < 4; i++) fx.smoke(x + (Math.random() - 0.5) * 30, y + 14, 12, '#9aa0a8');
            S('smoke');
            break;
          case 'shield':
            fx.ring(x, y + 18, '#6fd3ff', 34);
            S('shield');
            break;
          case 'web':
            fx.text(x, y - 16, t('fx.webbed'), '#f0f0f0', 14);
            S('web');
            break;
        }
        break;
      }
      case 'vfx':
        S({ punch: 'punch', shot: 'shot', spit: 'spit', arc: 'artillery', beam: 'laser', hook: 'hook', pulse: 'pulse', bolt: 'zap', flame: 'flame', frost: 'freeze', explode: 'boom', wind: 'wind', swap: 'swap', shield: 'shield' }[ev.v] ?? 'shot');
        if (ev.v === 'explode') {
          const [x, y] = this.at(ev.tx, ev.ty, 10);
          fx.explosion(x, y, 1);
        }
        break;
      case 'spawn': {
        const [x, y] = this.at(ev.x, ev.y, 0);
        fx.dust(x, y, '#6a5040', 12);
        fx.debris(x, y, '#5a4535', 8);
        fx.shake = Math.max(fx.shake, 3);
        S('emerge');
        break;
      }
      case 'spawnBlocked': {
        const [x, y] = this.at(ev.x, ev.y, 10);
        fx.dust(x, y + 10, '#6a5040', 10);
        fx.text(x, y - 30, t('fx.spawnBlocked'), '#7dffa8', 15);
        fx.shake = Math.max(fx.shake, 4);
        S('bump');
        break;
      }
      case 'hazard': {
        const [x, y] = this.at(ev.x, ev.y, 10);
        switch (ev.kind) {
          case 'airstrike':
          case 'volcanic':
            fx.explosion(x, y, 1.1);
            if (ev.kind === 'volcanic') fx.embers(x, y, 12);
            S('boom');
            break;
          case 'lightning':
            fx.sparks(x, y, '#e8f6ff', 18);
            fx.ring(x, y + 10, '#e8f6ff', 40);
            fx.shake = Math.max(fx.shake, 6);
            S('thunder');
            break;
          case 'tidal':
            fx.splash(x, y);
            S('splash');
            break;
          case 'seismic':
            fx.debris(x, y, '#3a2f2a', 10);
            fx.shake = Math.max(fx.shake, 5);
            S('crumble');
            break;
          case 'sandstorm':
            fx.dust(x, y, '#d8c27f', 14);
            S('sand');
            break;
          case 'icestorm':
            fx.frost(x, y);
            S('freeze');
            break;
          case 'acidrain':
            for (let i = 0; i < 8; i++) fx.text(x + (Math.random() - 0.5) * 40, y - Math.random() * 30, '·', '#9dff5a', 22, 0.5);
            S('acid');
            break;
        }
        break;
      }
      case 'banner':
        this.hooks.banner(ev);
        S(ev.id === 'lost' ? 'lose' : ev.id === 'victory' ? 'win' : ev.tone === 'enemy' ? 'enemyturn' : 'yourturn');
        break;
      case 'heal': {
        const [x, y] = this.at(ev.x, ev.y, 20);
        fx.heal(x, y + 14);
        fx.text(x, y - 14, `+${ev.amt}`, '#7dffa8', 18);
        S('heal');
        break;
      }
      case 'plan':
        S('target');
        break;
      case 'pod': {
        const [x, y] = this.at(ev.x, ev.y, 10);
        if (ev.what === 'collect') {
          fx.text(x, y - 30, t('fx.podRecovered'), '#9ff3ff', 16, 1.5);
          fx.ring(x, y + 10, '#9ff3ff', 40);
          S('pod');
        } else if (ev.what === 'destroy') {
          fx.debris(x, y, '#e9eef2', 10);
          fx.text(x, y - 30, t('fx.podDestroyed'), '#ff5a4a', 16, 1.5);
          S('die');
        } else S('whoosh');
        break;
      }
      case 'tick': {
        const [x, y] = this.at(ev.x, ev.y, 30);
        if (ev.what === 'burn') {
          fx.embers(x, y + 20, 10);
          S('fire');
        } else if (ev.what === 'psychic') {
          fx.ring(x, y + 20, '#d06cff', 36);
          S('zap');
        } else if (ev.what.startsWith('cancel')) {
          const label = t(({ 'cancel-smoke': 'fx.smokedOut', 'cancel-frozen': 'fx.frozen', 'cancel-water': 'fx.submerged', 'cancel-edge': 'fx.noTarget' } as const)[ev.what as 'cancel-smoke'] ?? 'fx.cancelled');
          fx.text(x, y - 6, label, '#cfe3f2', 15);
          S('denied');
        } else if (ev.what === 'spawnMark') {
          fx.dust(x, y + 30, '#6a5040', 4);
          S('rumble');
        }
        break;
      }
      case 'flip': {
        const u = this.base ? unitById(this.base, ev.id) : undefined;
        if (u) {
          const [x, y] = this.at(u.x, u.y, 40);
          fx.text(x, y, t('fx.reversed'), '#ffe066', 15);
        }
        S('shield');
        break;
      }
    }
  }

  private onEnd(ev: AnimEv): void {
    const fx = this.r.fx;
    if (ev.e === 'vfx') {
      const [x, y] = this.at(ev.tx, ev.ty, 18);
      if (ev.v === 'arc') {
        fx.explosion(x, y + 8, 0.7);
        this.hooks.sound('boom');
      } else if (ev.v === 'shot' || ev.v === 'spit') fx.sparks(x, y, ev.v === 'spit' ? '#ff8a3a' : '#ffe08a', 10);
      else if (ev.v === 'frost') fx.frost(x, y);
      else if (ev.v === 'punch') fx.shake = Math.max(fx.shake, 3);
    }
    if (ev.e === 'slide' && (ev.style === 'push' || ev.style === 'charge' || ev.style === 'throw' || ev.style === 'leap')) {
      const [x, y] = this.at(ev.tx, ev.ty, 0);
      fx.dust(x, y, '#9a8a70', 5);
      if (ev.style === 'leap' || ev.style === 'throw') fx.shake = Math.max(fx.shake, 4);
    }
    if (ev.e === 'bump') {
      const [x, y] = this.at(ev.x + [0, 1, 0, -1][ev.dir] * 0.5, ev.y + [-1, 0, 1, 0][ev.dir] * 0.5, 20);
      fx.sparks(x, y, '#ffffff', 8);
      fx.shake = Math.max(fx.shake, 5);
      this.hooks.sound('bump');
    }
  }
}

