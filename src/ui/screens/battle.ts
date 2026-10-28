import type { App, Screen } from '../app';
import type { AnimEv, BattleState, Unit } from '../../game/types';
import { UNITS } from '../../game/data/units';
import { SQUADS } from '../../game/data/squads';
import { cloneBattle, idx, ix, iy } from '../../game/util';
import { inSmoke, isMech, liveAt, reachable, submerged, unitAt, unitById } from '../../game/battle/board';
import { resolveWeapon, targetsFor } from '../../game/battle/attacks';
import { computeThreats, previewAttack, type Outcome, type Threat } from '../../game/battle/preview';
import {
  canAct,
  canMove,
  doAttack,
  doMove,
  doRepair,
  endPlayerTurn,
  idleUnits,
  placeMech,
  repairBlock,
  startBattle,
  undeployed,
  weaponBlock,
} from '../../game/battle/turn';
import { objectiveState } from '../../game/battle/objectives';
import { autoAct } from '../../game/battle/autoplay';
import { isArmored } from '../../game/battle/effects';
import { Animator } from '../../render/anim';
import { emptyView, type View } from '../../render/renderer';
import { bind } from '../dom';
import { esc, gridBar, pips, portraitCanvas, rewardChips, spriteCanvas, tileExtras, weaponStats } from '../common';
import { icon } from '../icons';
import { openHelp, openSettings } from '../modals/misc';
import { msg, t, tn } from '../../i18n';
import {
  className,
  hazardDesc,
  hazardName,
  missionTitle,
  objectiveHint,
  objectiveLabel,
  pilotName,
  skillName,
  terrainDesc,
  terrainName,
  unitDesc,
  unitName,
  weaponDesc,
  weaponName,
} from '../../i18n/names';

type BannerEv = Extract<AnimEv, { e: 'banner' }>;

const INSETS = { left: 205, right: 290, top: 60, bottom: 112 };

export class BattleScreen implements Screen {
  inGame = true;
  s: BattleState;
  private anim: Animator;
  private view: View;
  private root!: HTMLElement;
  private sel = 0;
  private slot = -1;
  private hoverTile = -1;
  private hoverUnit = 0;
  private mouse = { x: 0, y: 0, inside: false };
  private turnStart: BattleState | null = null;
  private undo: { snap: BattleState; id: number }[] = [];
  private threatKey: unknown = null;
  private threats: Threat[] = [];
  private previewKey = '';
  private preview: Outcome | null = null;
  private reachKey = '';
  private reach: Map<number, number[]> = new Map();
  private hudDirty = true;
  private ended = false;
  private showOrder = true;
  private autoplay = false;
  private canvasCache = new Map<string, HTMLCanvasElement>();
  private lastTooltip = '';
  private listeners: [string, EventListener][] = [];
  private panelHover = 0;

  constructor(private app: App, s: BattleState, private regionId: string) {
    this.s = s;
    this.view = emptyView(SQUADS[app.campaign!.squad].palette);
    this.anim = new Animator(app.renderer, {
      sound: (n) => app.sound.play(n),
      banner: (ev) => app.banner(...this.bannerText(ev), ev.tone),
    });
    this.anim.onIdle = () => this.onAnimIdle();
    this.showOrder = app.settings.orderAlways;
    if (s.phase === 'player') this.turnStart = cloneBattle(s);
    if (s.phase === 'deploy') this.sel = undeployed(s)[0]?.id ?? 0;
  }

  // ------------------------------------------------------------------ lifecycle

  mount(root: HTMLElement): void {
    this.root = root;
    root.innerHTML = `<div class="hud">
      <div class="panel hud-grid" id="h-grid"></div>
      <div class="panel hud-turn" id="h-turn"></div>
      <div class="hud-menu"><button class="btn ghost small" data-act="menu" title="${esc(t('hud.menu'))}">${icon('gear')}</button></div>
      <div class="panel hud-obj" id="h-obj"></div>
      <div class="hud-roster" id="h-roster"></div>
      <div class="panel hud-unit hidden" id="h-unit"></div>
      <div class="panel cyan hud-hint hidden" id="h-hint"></div>
      <div class="panel deploy-panel hidden" id="h-deploy"></div>
      <div class="hud-actions" id="h-actions"></div>
    </div>`;
    const hud = root.firstElementChild as HTMLElement;
    hud.style.pointerEvents = 'none';
    // Battle actions are ignored while a sequence animates: the live state has already moved on.
    const idle = (fn: (b: HTMLElement) => void) => (b: HTMLElement) => {
      if (!this.anim.busy) fn(b);
    };
    bind(hud, {
      menu: () => this.openMenu(),
      select: idle((b) => {
        const u = unitById(this.s, Number(b.dataset.id));
        if (u) this.select(u);
      }),
      weapon: idle((b) => this.arm(Number(b.dataset.slot))),
      repair: idle(() => this.repair()),
      undo: idle(() => this.undoMove()),
      reset: idle(() => void this.resetTurn()),
      end: idle(() => void this.endTurn()),
      deploy: idle(() => this.confirmDeploy()),
      order: () => {
        this.showOrder = !this.showOrder;
        this.hudDirty = true;
      },
      auto: () => {
        this.autoplay = !this.autoplay;
        this.hudDirty = true;
      },
    }, () => this.app.sound.play('click'));
    hud.addEventListener('mouseover', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-hover-unit]');
      const id = card ? Number(card.dataset.hoverUnit) : 0;
      if (id !== this.panelHover) this.panelHover = id;
    });
    const c = this.app.canvas;
    const on = (type: string, fn: EventListener): void => {
      c.addEventListener(type, fn);
      this.listeners.push([type, fn]);
    };
    on('mousemove', ((e: MouseEvent) => this.onMouseMove(e)) as EventListener);
    on('mouseleave', (() => {
      this.mouse.inside = false;
      this.hoverTile = -1;
      this.hoverUnit = 0;
      this.app.hideTooltip();
    }) as EventListener);
    on('mousedown', ((e: MouseEvent) => this.onMouseDown(e)) as EventListener);
    on('contextmenu', ((e: Event) => e.preventDefault()) as EventListener);
    this.app.renderer.setInsets(INSETS.left, INSETS.right, INSETS.top, INSETS.bottom);
    this.app.renderer.fx.clear();
    this.hudDirty = true;
  }

  unmount(): void {
    window.clearTimeout(this.finishTimer);
    for (const [t, fn] of this.listeners) this.app.canvas.removeEventListener(t, fn);
    this.listeners = [];
    this.app.canvas.style.cursor = 'default';
    this.app.hideTooltip();
  }

  resize(): void {
    this.app.renderer.setInsets(INSETS.left, INSETS.right, INSETS.top, INSETS.bottom);
  }

  /** Repaints the HUD in the new language without touching selection, undo or animations. */
  relocalize(): void {
    this.hudCache.clear();
    this.hudDirty = true;
    this.lastTooltip = '';
    this.root.querySelector('[data-act="menu"]')?.setAttribute('title', t('hud.menu'));
  }

  // ------------------------------------------------------------------ frame

  frame(dt: number, t: number): void {
    const r = this.app.renderer;
    this.anim.speed = this.app.settings.fast ? 2.2 : 1;
    r.fx.update(dt);
    this.anim.update(dt);
    if (this.autoplay && !this.anim.busy && this.s.phase === 'player' && !this.app.modalOpen) this.autoStep();
    const d = this.anim.display();
    const state = d ? d.state : this.s;
    const key = d ? state : `live:${this.s.version}`;
    if (key !== this.threatKey) {
      this.threatKey = key;
      this.threats = state.phase === 'player' || state.phase === 'enemy' || state.phase === 'deploy' ? computeThreats(state) : [];
      this.hudDirty = true;
    }
    this.buildView(d ? d.overlay : null);
    r.draw(state, this.view, t);
    if (this.hudDirty) {
      this.hudDirty = false;
      this.renderHud();
    }
  }

  private selected(): Unit | undefined {
    return this.sel ? unitById(this.s, this.sel) : undefined;
  }

  private controllable(u: Unit | undefined): u is Unit {
    return !!u && u.team === 'player' && u.controllable && !u.dead;
  }

  private getReach(u: Unit): Map<number, number[]> {
    const key = `${this.s.version}:${u.id}`;
    if (key !== this.reachKey) {
      this.reachKey = key;
      this.reach = reachable(this.s, u);
    }
    return this.reach;
  }

  private buildView(overlay: View['overlay']): void {
    const v = this.view;
    const busy = this.anim.busy;
    v.overlay = overlay;
    v.threats = this.threats;
    v.hover = busy ? -1 : this.hoverTile;
    v.selected = this.sel;
    v.showOrder = this.showOrder;
    v.moveTiles = null;
    v.path = null;
    v.targetTiles = null;
    v.preview = null;
    v.deployTiles = null;
    v.idleGlow = new Set();
    const hov = this.hoverUnit ? unitById(this.s, this.hoverUnit) : this.panelHover ? unitById(this.s, this.panelHover) : undefined;
    v.focusEnemy = !busy && hov && hov.team === 'enemy' ? hov.id : 0;
    if (busy) return;
    const s = this.s;
    const u = this.selected();
    if (s.phase === 'deploy') {
      v.deployTiles = new Set(s.deployZone.filter((i) => !unitAt(s, ix(i), iy(i)) || (u && u.x === ix(i) && u.y === iy(i))));
      return;
    }
    if (s.phase !== 'player') return;
    for (const x of s.units) if (this.controllable(x) && x.x >= 0 && (canMove(s, x) || canAct(s, x))) v.idleGlow.add(x.id);
    if (!this.controllable(u) || u.x < 0) return;
    if (this.slot >= 0 && !u.weapons[this.slot]) this.slot = -1;
    if (this.slot >= 0) {
      const w = resolveWeapon(u.weapons[this.slot], u);
      const targets = targetsFor(s, u, w);
      v.targetTiles = new Set(targets);
      if (this.hoverTile >= 0 && v.targetTiles.has(this.hoverTile)) {
        const key = `${s.version}:${u.id}:${this.slot}:${this.hoverTile}`;
        if (key !== this.previewKey) {
          this.previewKey = key;
          this.preview = previewAttack(s, u, this.slot, this.hoverTile);
        }
        v.preview = this.preview;
        v.previewSrc = u.id;
      }
      return;
    }
    if (canMove(s, u)) {
      const reach = this.getReach(u);
      const here = idx(u.x, u.y);
      v.moveTiles = new Set([...reach.keys()].filter((i) => i !== here));
      if (this.hoverTile >= 0 && v.moveTiles.has(this.hoverTile)) v.path = reach.get(this.hoverTile) ?? null;
    }
  }

  // ------------------------------------------------------------------ input

  /**
   * The tile a pointer position refers to. A unit's sprite stands in for its tile, so
   * clicking a mech's body selects that mech rather than the ground drawn behind it;
   * hover previews and clicks both use this, so they always agree.
   */
  private pointerTile(clientX: number, clientY: number): number {
    const p = this.app.renderer.pick(clientX, clientY);
    const u = p.unit ? unitById(this.s, p.unit) : undefined;
    return u && u.x >= 0 ? idx(u.x, u.y) : p.tile;
  }

  private onMouseMove(e: MouseEvent): void {
    this.mouse = { x: e.clientX, y: e.clientY, inside: true };
    const p = { tile: this.pointerTile(e.clientX, e.clientY) };
    const tileUnit = p.tile >= 0 ? liveAt(this.s, ix(p.tile), iy(p.tile)) ?? unitAt(this.s, ix(p.tile), iy(p.tile)) : undefined;
    const unit = tileUnit?.id ?? 0;
    if (p.tile !== this.hoverTile || unit !== this.hoverUnit) {
      if (p.tile !== this.hoverTile && p.tile >= 0 && this.view.targetTiles?.has(p.tile)) this.app.sound.play('hover');
      this.hoverTile = p.tile;
      this.hoverUnit = unit;
      this.hudDirty = true;
      const actionable =
        p.tile >= 0 &&
        (!!this.view.targetTiles?.has(p.tile) || !!this.view.moveTiles?.has(p.tile) || !!this.view.deployTiles?.has(p.tile) || !!unit);
      this.app.canvas.style.cursor = actionable ? 'pointer' : 'default';
    }
    this.updateTooltip();
  }

  private onMouseDown(e: MouseEvent): void {
    if (this.app.modalOpen) return;
    if (e.button === 2) {
      this.cancel();
      return;
    }
    if (e.button !== 0) return;
    if (this.anim.busy) {
      return;
    }
    this.click(this.pointerTile(e.clientX, e.clientY));
  }

  private click(tile: number): void {
    const s = this.s;
    const tileUnit = tile >= 0 ? (liveAt(s, ix(tile), iy(tile)) ?? unitAt(s, ix(tile), iy(tile))) : undefined;
    const u = this.selected();
    if (s.phase === 'deploy') {
      if (tile >= 0 && s.deployZone.includes(tile) && u && isMech(u)) {
        if (tileUnit && tileUnit !== u && tileUnit.x >= 0 && isMech(tileUnit) && u.x < 0) {
          this.select(tileUnit);
          return;
        }
        if (placeMech(s, u, tile)) {
          this.app.sound.play('move');
          this.app.renderer.fx.dust(...this.tileFx(tile), '#9a8a70', 8);
          const next = undeployed(s)[0];
          this.sel = next ? next.id : u.id;
          this.hudDirty = true;
        }
        return;
      }
      if (tileUnit && isMech(tileUnit)) this.select(tileUnit);
      return;
    }
    if (s.phase !== 'player') return;
    if (this.controllable(u) && this.slot >= 0 && u.weapons[this.slot]) {
      const w = resolveWeapon(u.weapons[this.slot], u);
      if (tile >= 0 && targetsFor(s, u, w).includes(tile)) {
        this.fire(u, this.slot, tile);
        return;
      }
      if (tileUnit && this.controllable(tileUnit) && tileUnit !== u) {
        this.select(tileUnit);
        return;
      }
      this.slot = -1;
      this.hudDirty = true;
      return;
    }
    if (this.controllable(u) && canMove(s, u) && tile >= 0) {
      const reach = this.getReach(u);
      if (reach.has(tile) && tile !== idx(u.x, u.y)) {
        this.move(u, tile);
        return;
      }
    }
    if (tileUnit && tileUnit.x >= 0) {
      this.select(tileUnit);
      return;
    }
    this.sel = 0;
    this.slot = -1;
    this.hudDirty = true;
  }

  private tileFx(tile: number): [number, number] {
    const x = ix(tile);
    const y = iy(tile);
    return [(x - y) * 56, (x + y) * 28 + 28];
  }

  key(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === 'f') {
      this.anim.skip();
      return;
    }
    if (this.app.debug && (k === 'f8' || k === 'p')) {
      this.autoplay = !this.autoplay;
      this.hudDirty = true;
      return;
    }
    if (this.app.debug && k === 'f9') {
      this.s.phase = 'won';
      this.onAnimIdle();
      return;
    }
    if (this.anim.busy) return;
    if (k === 'escape') {
      if (this.slot >= 0 || this.sel) this.cancel();
      else this.openMenu();
      return;
    }
    if (k === 'a') {
      this.showOrder = !this.showOrder;
      return;
    }
    if (this.s.phase === 'deploy') {
      if (k === 'enter' || k === ' ') this.confirmDeploy();
      return;
    }
    if (this.s.phase !== 'player') return;
    if (k === '1' || k === '2') this.arm(Number(k) - 1);
    else if (k === 'r') this.repair();
    else if (k === 'z' || (k === 'z' && (e.metaKey || e.ctrlKey))) this.undoMove();
    else if (k === ' ' || k === 'enter') {
      e.preventDefault();
      void this.endTurn();
    } else if (k === 'tab') {
      e.preventDefault();
      this.cycle();
    }
  }

  private cancel(): void {
    if (this.slot >= 0) this.slot = -1;
    else this.sel = this.s.phase === 'deploy' ? this.sel : 0;
    this.hudDirty = true;
  }

  private select(u: Unit): void {
    if (this.sel !== u.id) this.app.sound.play('select');
    this.sel = u.id;
    this.slot = -1;
    if (this.controllable(u) && this.s.phase === 'player' && !canMove(this.s, u) && canAct(this.s, u)) this.autoArm(u);
    this.hudDirty = true;
  }

  private cycle(): void {
    const mine = this.s.units.filter((u) => this.controllable(u) && u.x >= 0);
    if (!mine.length) return;
    const ready = mine.filter((u) => canMove(this.s, u) || canAct(this.s, u));
    const list = ready.length ? ready : mine;
    const i = list.findIndex((u) => u.id === this.sel);
    this.select(list[(i + 1) % list.length]);
  }

  private autoArm(u: Unit): void {
    for (let i = 0; i < u.weapons.length; i++) {
      if (!weaponBlock(this.s, u, i)) {
        this.slot = i;
        return;
      }
    }
  }

  private arm(slot: number): void {
    const u = this.selected();
    if (this.anim.busy || !this.controllable(u) || this.s.phase !== 'player') return;
    const why = weaponBlock(this.s, u, slot);
    if (why) {
      this.app.toast(msg(why), true);
      this.app.sound.play('denied');
      return;
    }
    this.slot = this.slot === slot ? -1 : slot;
    this.app.sound.play('select');
    this.hudDirty = true;
  }

  // ------------------------------------------------------------------ actions

  private move(u: Unit, tile: number): void {
    const before = cloneBattle(this.s);
    const steps = doMove(this.s, u, tile);
    if (!steps.length) return;
    this.undo.push({ snap: before, id: u.id });
    this.anim.play(before, steps);
    this.resolved();
    this.slot = -1;
    this.hudDirty = true;
    this.afterIdle = () => {
      const mu = unitById(this.s, u.id);
      if (mu && !mu.dead && this.sel === mu.id && canAct(this.s, mu)) this.autoArm(mu);
    };
  }

  private fire(u: Unit, slot: number, tile: number): void {
    const before = cloneBattle(this.s);
    const steps = doAttack(this.s, u, slot, tile);
    if (!steps.length) return;
    this.undo = [];
    this.slot = -1;
    this.anim.play(before, steps);
    this.resolved();
    this.hudDirty = true;
    this.afterIdle = () => this.selectNextReady(u.id);
  }

  private repair(): void {
    const u = this.selected();
    if (this.anim.busy || !this.controllable(u) || this.s.phase !== 'player') return;
    const why = repairBlock(this.s, u);
    if (why) {
      this.app.toast(msg(why), true);
      this.app.sound.play('denied');
      return;
    }
    const before = cloneBattle(this.s);
    const steps = doRepair(this.s, u);
    this.undo = [];
    this.slot = -1;
    this.anim.play(before, steps);
    this.resolved();
    this.hudDirty = true;
    this.afterIdle = () => this.selectNextReady(u.id);
  }

  private selectNextReady(fromId: number): void {
    const cur = unitById(this.s, fromId);
    if (cur && !cur.dead && (canMove(this.s, cur) || canAct(this.s, cur))) return;
    const next = this.s.units.find((x) => this.controllable(x) && x.x >= 0 && (canMove(this.s, x) || canAct(this.s, x)));
    this.sel = next ? next.id : 0;
    this.slot = -1;
  }

  private undoMove(): void {
    if (this.anim.busy || this.s.phase !== 'player') return;
    const top = this.undo.pop();
    if (!top) {
      this.app.sound.play('denied');
      return;
    }
    const v = this.s.version;
    this.s = top.snap;
    this.s.version = v + 1;
    this.sel = top.id;
    this.slot = -1;
    this.app.sound.play('swap');
    this.hudDirty = true;
  }

  private async resetTurn(): Promise<void> {
    if (this.anim.busy || this.s.phase !== 'player' || !this.turnStart || this.s.resetUsed) return;
    const ok = await this.app.confirm(t('battle.resetQ'), t('battle.resetBody'), t('hud.reset'));
    if (!ok) return;
    const v = this.s.version;
    this.s = cloneBattle(this.turnStart);
    this.s.resetUsed = true;
    this.s.version = v + 1;
    this.turnStart.resetUsed = true;
    this.undo = [];
    this.sel = 0;
    this.slot = -1;
    this.app.sound.play('swap');
    this.hudDirty = true;
  }

  private async endTurn(): Promise<void> {
    if (this.anim.busy || this.s.phase !== 'player') return;
    const idle = idleUnits(this.s).filter((u) => canAct(this.s, u) && !u.acted);
    if (idle.length && !this.autoplay) {
      const ok = await this.app.confirm(t('battle.endQ'), tn('battle.endBody', idle.length), t('hud.endTurn'));
      if (!ok) return;
    }
    const before = cloneBattle(this.s);
    const steps = endPlayerTurn(this.s);
    this.undo = [];
    this.sel = 0;
    this.slot = -1;
    this.anim.play(before, steps);
    this.resolved();
    this.hudDirty = true;
    this.afterIdle = () => {
      if (this.s.phase === 'player') {
        this.turnStart = cloneBattle(this.s);
        this.app.saveResume(this.s, this.regionId);
        const first = this.s.units.find((x) => this.controllable(x) && x.x >= 0);
        if (first) this.sel = first.id;
        this.slot = -1;
      }
    };
  }

  private confirmDeploy(): void {
    if (this.s.phase !== 'deploy' || this.anim.busy) return;
    if (undeployed(this.s).length) {
      this.app.toast(t('battle.placeAll'), true);
      this.app.sound.play('denied');
      return;
    }
    const before = cloneBattle(this.s);
    const steps = startBattle(this.s);
    this.sel = 0;
    this.anim.play(before, steps);
    this.resolved();
    this.hudDirty = true;
    this.afterIdle = () => {
      this.turnStart = cloneBattle(this.s);
      this.app.saveResume(this.s, this.regionId);
      const first = this.s.units.find((x) => this.controllable(x) && x.x >= 0);
      if (first) this.sel = first.id;
      this.slot = -1;
    };
  }

  private autoStep(): void {
    const before = cloneBattle(this.s);
    const steps = autoAct(this.s);
    this.undo = [];
    this.sel = 0;
    this.slot = -1;
    if (steps.length) this.anim.play(before, steps);
    this.resolved();
    if (this.s.phase !== 'player') {
      this.afterIdle = () => {
        if (this.s.phase === 'player') this.turnStart = cloneBattle(this.s);
      };
    }
    this.hudDirty = true;
  }

  private afterIdle: (() => void) | null = null;
  private finishTimer = 0;

  /** Logic resolves before the animation plays: record a defeat immediately so it can't be replayed. */
  private resolved(): void {
    if (this.s.phase === 'lost') this.app.dropResume();
  }

  private onAnimIdle(): void {
    const fn = this.afterIdle;
    this.afterIdle = null;
    fn?.();
    this.hudDirty = true;
    this.previewKey = '';
    if ((this.s.phase === 'won' || this.s.phase === 'lost') && !this.ended) {
      this.ended = true;
      this.autoplay = false;
      // the results come up after a beat; a screen that was left in the meantime never reports
      this.finishTimer = window.setTimeout(() => {
        if (this.app.screen === this) this.app.finishBattle(this.s, this.regionId);
      }, 900);
    }
  }

  /** The mission name, in the current language. */
  private title(): string {
    return missionTitle(this.s.kind, this.regionId);
  }

  private bannerText(ev: BannerEv): [string, string] {
    switch (ev.id) {
      case 'leader':
        return [t('banner.leader'), `${unitName(ev.boss)} · ${this.title()}`];
      case 'emerge':
        return [t('banner.emerge'), this.title()];
      case 'yourTurn':
        return [t('banner.yourTurn'), ev.turn === ev.max ? t('banner.finalTurn') : t('battle.turnOf', { turn: ev.turn, max: ev.max })];
      case 'enemyTurn':
        return [t('banner.enemyTurn'), ev.turn === ev.max ? t('banner.lastAttack') : ''];
      case 'victory':
        return [t('banner.victory'), t('banner.victorySub')];
      case 'lost':
        return [t('banner.lost'), t(ev.reason === 'grid' ? 'banner.lostGrid' : ev.reason === 'bomb' ? 'banner.lostBomb' : 'banner.lostMechs')];
    }
  }

  private openMenu(): void {
    const h = this.app.modal(
      `<div class="h2">${t('menu.paused')}</div>
       <p class="dim" style="max-width:420px">${esc(this.title())} · ${t('battle.turnOf', { turn: Math.max(1, this.s.turn), max: this.s.maxTurns })}</p>
       <div style="display:flex;flex-direction:column;gap:10px;min-width:320px;margin-top:10px">
         <button class="btn" data-act="resume">${t('menu.resume')}</button>
         <button class="btn ghost" data-act="help">${icon('info')}${t('common.howToPlay')}</button>
         <button class="btn ghost" data-act="settings">${icon('gear')}${t('common.settings')}</button>
         <button class="btn danger" data-act="quit">${t('menu.retreat')}</button>
       </div>`,
      {
        handlers: {
          resume: () => h.close(),
          help: () => openHelp(this.app),
          settings: () => openSettings(this.app),
          quit: async () => {
            const ok = await this.app.confirm(t('menu.retreatQ'), t('menu.retreatBody'), t('menu.retreatOk'), true);
            if (ok) this.app.abandonToTitle();
          },
        },
      },
    );
  }

  // ------------------------------------------------------------------ tooltip

  private updateTooltip(): void {
    if (!this.mouse.inside || this.anim.busy || this.app.modalOpen || this.hoverTile < 0 || this.slot >= 0) {
      if (this.lastTooltip) this.app.hideTooltip();
      this.lastTooltip = '';
      return;
    }
    const html = this.tooltipHtml(this.hoverTile);
    this.lastTooltip = html;
    if (!html) {
      this.app.hideTooltip();
      return;
    }
    this.app.showTooltip(html, this.mouse.x, this.mouse.y);
  }

  private tooltipHtml(tile: number): string {
    const s = this.s;
    const x = ix(tile);
    const y = iy(tile);
    const tl = s.tiles[tile];
    const parts: string[] = [];
    const u = liveAt(s, x, y) ?? unitAt(s, x, y);
    if (u) {
      const d = UNITS[u.def];
      parts.push(`<div class="tt-title">${esc(unitName(u.def))}${u.dead ? ` <span class="dim">${t('tip.wreck')}</span>` : ''}</div>`);
      if (!u.dead) {
        parts.push(`<div>${pips(u.hp, u.maxHp, u.team === 'enemy')} <span class="dim">${t('tip.hpMove', { hp: u.hp, max: u.maxHp, move: u.move })}</span></div>`);
        const traits: string[] = [];
        if (u.flying) traits.push(t('common.flying'));
        if (isArmored(s, u)) traits.push(t('common.armored'));
        if (u.massive && u.team === 'enemy') traits.push(t('tip.massive'));
        if (u.stable) traits.push(t('tip.stable'));
        if (traits.length) parts.push(`<div class="tt-row">${traits.join(' · ')}</div>`);
        if (u.fire) parts.push(`<div class="tt-row tt-warn">${t('tip.burning')}</div>`);
        if (u.acid) parts.push(`<div class="tt-row green">${t('tip.acid')}</div>`);
        if (u.frozen) parts.push(`<div class="tt-row cyan">${t('tip.frozen')}</div>`);
        if (u.shield) parts.push(`<div class="tt-row cyan">${t('tip.shielded')}</div>`);
        if (u.webbedBy) parts.push(`<div class="tt-row">${t('tip.webbed')}</div>`);
        if (submerged(s, u)) parts.push(`<div class="tt-row cyan">${t('tip.submerged')}</div>`);
        if (inSmoke(s, u)) parts.push(`<div class="tt-row">${t('tip.smoke')}</div>`);
        if (u.team === 'enemy' && u.plan) {
          const th = this.threats.find((h) => h.id === u.id);
          parts.push(`<div class="tt-row"><b>${t('tip.attackN', { n: u.plan.order })}</b>: ${esc(weaponName(u.plan.w))}${th?.cancel ? ` <span class="cyan">${t('tip.cancelled')}</span>` : ''}</div>`);
        } else if (u.team === 'enemy' && (d.psion || d.egg)) parts.push(`<div class="tt-row">${esc(unitDesc(u.def))}</div>`);
      }
    }
    const tname = esc(terrainName(tl.t));
    const tdesc = esc(terrainDesc(tl.t));
    if (tl.t === 'building') parts.push(`<div class="tt-title" style="margin-top:${u ? 8 : 0}px">${tl.obj === 'relay' || tl.obj === 'lab' || tl.obj === 'uplink' ? t(`building.${tl.obj}`) : tname} <span class="dim">${tl.hp}/${tl.maxHp}</span></div><div class="tt-row">${tdesc}</div>`);
    else if (!u || tl.t !== 'ground') parts.push(`<div class="${u ? 'tt-row' : 'tt-title'}">${tname}${tl.t === 'mountain' ? ` <span class="dim">${tl.hp}/2</span>` : tl.t === 'ice' ? ` <span class="dim">${tl.hp > 1 ? t('tip.iceIntact') : t('tip.iceCracked')}</span>` : ''}</div>${tl.t !== 'ground' ? `<div class="tt-row dim">${tdesc}</div>` : ''}`);
    for (const ex of tileExtras(tl)) parts.push(`<div class="tt-row">${ex}</div>`);
    if (tl.hazard && s.hazard) parts.push(`<div class="tt-row tt-warn"><b>${esc(hazardName(s.hazard))}:</b> ${esc(hazardDesc(s.hazard))}</div>`);
    for (const th of this.threats) {
      if (th.cancel || !th.outcome.tiles.has(tile)) continue;
      const e = unitById(s, th.id);
      if (!e) continue;
      const lost = th.outcome.buildingLoss.get(tile);
      const dmg = th.outcome.effects.find((ef) => ef.k === 'dmg' && ef.x === x && ef.y === y && ef.amt > 0);
      parts.push(`<div class="tt-row tt-warn">${t('tip.targeted', { name: `<b>${esc(unitName(e.def))}</b>`, n: th.order })}${dmg && dmg.k === 'dmg' ? ` — ${tn('tip.damage', dmg.amt)}` : ''}${lost ? ` · <b>${tn('tip.gridLoss', lost)}</b>` : ''}</div>`);
    }
    return parts.join('');
  }

  // ------------------------------------------------------------------ HUD

  private unitCanvas(u: Unit, px: number): HTMLCanvasElement {
    const key = `${u.def}:${px}:${u.dead}`;
    let c = this.canvasCache.get(key);
    if (!c) {
      c = spriteCanvas(u.def, this.view.pal, px, 1.05);
      this.canvasCache.set(key, c);
    }
    return c.cloneNode(false) as HTMLCanvasElement;
  }

  private copyCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
    return c;
  }

  private hudCache = new Map<string, string>();

  /** Replaces a panel's markup only when it changed, so buttons under the cursor are not recreated mid-click. */
  private setHtml(el: HTMLElement, html: string): boolean {
    if (this.hudCache.get(el.id) === html) return false;
    this.hudCache.set(el.id, html);
    el.innerHTML = html;
    return true;
  }

  private renderHud(): void {
    const s = this.s;
    const q = (id: string): HTMLElement => this.root.querySelector(`#${id}`) as HTMLElement;
    const busy = this.anim.busy;
    // several Vek may target the same building: never count more than it has left
    const perBuilding = new Map<number, number>();
    for (const t of this.threats) {
      if (t.cancel) continue;
      for (const [i, lost] of t.outcome.buildingLoss) perBuilding.set(i, Math.min(s.tiles[i].hp, (perBuilding.get(i) ?? 0) + lost));
    }
    const threatLoss = Math.min(s.grid, [...perBuilding.values()].reduce((a, b) => a + b, 0));

    this.setHtml(q('h-grid'), `<div class="label">${t('hud.grid')}</div>
      <div class="row">${gridBar(s.grid, s.gridMax, s.phase === 'player' ? Math.min(threatLoss, s.grid) : 0)}<span style="font-size:22px;font-weight:700">${s.grid}</span></div>
      <div class="row dim" style="font-size:12px">${t('hud.gridDefense', { n: s.gridDef })}${threatLoss && s.phase === 'player' ? ` · <span class="red">${tn('hud.underThreat', threatLoss)}</span>` : ''}</div>`);

    const enemies = s.units.filter((u) => u.team === 'enemy' && u.plan).length;
    const spawns = s.tiles.filter((t) => t.spawn).length;
    let phase = '';
    if (s.phase === 'deploy') phase = `<span class="amber">${t('hud.deployment')}</span>`;
    else if (s.phase === 'player') phase = `<span class="amber">${t('hud.yourTurn')}</span> · ${tn('hud.attacksQueued', enemies)}${spawns ? ` · ${tn('hud.emerging', spawns)}` : ''}`;
    else if (s.phase === 'enemy') phase = `<span class="red">${t('hud.vekTurn')}</span>`;
    else if (s.phase === 'won') phase = `<span class="green">${t('hud.victory')}</span>`;
    else phase = `<span class="red">${t('hud.defeat')}</span>`;
    this.setHtml(q('h-turn'), `<div class="big">${s.phase === 'deploy' ? esc(this.title().toUpperCase()) : t('hud.turn', { turn: Math.max(1, s.turn), max: s.maxTurns })}</div><div class="phase">${phase}</div>`);

    const objs = s.objectives
      .map((o) => {
        const st = objectiveState(s, o);
        const ico = st.state === 'done' ? `<span class="green">${icon('check')}</span>` : st.state === 'fail' ? `<span class="red">${icon('cross')}</span>` : st.state === 'ok' ? `<span class="green">${icon('shield')}</span>` : `<span class="amber">${icon('star')}</span>`;
        const cls = st.state === 'done' || st.state === 'ok' ? 'ok' : st.state === 'fail' ? 'fail' : '';
        const progress = st.note ? msg(st.note, 0, { turn: s.podTurn }) : st.progress;
        return `<div class="obj-line ${cls} ${o.kind === 'bomb' ? 'main' : ''}" title="${esc(objectiveHint(o.kind, s.podTurn))}">${ico}<span class="grow">${esc(objectiveLabel(o, s.units.find((u) => u.boss)?.def ?? ''))}${progress ? ` <span class="dim">(${esc(progress)})</span>` : ''}</span>${rewardChips(o.reward)}</div>`;
      })
      .join('');
    const hz = s.hazard ? `<div class="obj-line" style="border-left-color:var(--violet)" title="${esc(hazardDesc(s.hazard))}"><span style="color:var(--violet)">${icon('info')}</span><span class="grow">${esc(hazardName(s.hazard))}</span></div>` : '';
    const turnsLeft = Math.max(0, s.maxTurns - Math.max(0, s.turn - (s.phase === 'player' || s.phase === 'deploy' ? 1 : 0)));
    this.setHtml(q('h-obj'), `<div class="label">${t('hud.objectives')}</div>
      <div class="obj-line main"><span class="cyan">${icon('hourglass')}</span><span class="grow">${tn('hud.survive', s.maxTurns)}</span><span class="dim">${tn('hud.left', turnsLeft)}</span></div>
      ${objs}${hz}`);

    // roster (portraits are inserted only when the markup changes)
    const roster = q('h-roster');
    const rosterUnits = s.units.filter((x) => x.team === 'player' && x.controllable);
    const cards = rosterUnits
      .map((u) => {
        const d = UNITS[u.def];
        const pilot = u.slot >= 0 ? this.app.campaign!.mechs[u.slot]?.pilot : null;
        let st = '';
        if (u.dead) st = `<span class="red">${t('roster.destroyed')}</span>`;
        else if (s.phase === 'deploy') st = u.x >= 0 ? `<span class="green">${t('roster.deployed')}</span>` : `<span class="amber">${t('roster.awaiting')}</span>`;
        else if (u.frozen) st = `<span class="cyan">${t('roster.frozen')}</span>`;
        else if (u.acted && !canMove(s, u)) st = `<span class="dim">${t('roster.done')}</span>`;
        else if (u.moved) st = `<span class="amber">${t('roster.moved')}</span>`;
        else if (u.webbedBy) st = `<span class="dim">${t('roster.webbed')}</span>`;
        else st = `<span class="green">${t('roster.ready')}</span>`;
        const title = pilot ? (pilot.ai ? pilotName(pilot) : `${pilot.name} — ${skillName(pilot.skill)}`) : '';
        return `<div class="panel roster-card ${u.id === this.sel ? 'sel' : ''} ${u.dead ? 'dead' : ''}" data-act="select" data-id="${u.id}" data-hover-unit="${u.id}" title="${esc(title)}">
          <div class="pc" data-u="${u.id}"></div><div class="nm">${esc(unitName(d.id))}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">${pips(Math.max(0, u.hp), u.maxHp)}<span class="st">${st}</span></div></div>`;
      })
      .join('');
    const orderRow = `<div style="display:flex;gap:6px"><button class="btn small ghost" data-act="order" title="${esc(t('hud.orderTitle'))}">${icon('target')}${t(this.showOrder ? 'hud.orderOn' : 'hud.orderOff')}</button>${this.app.debug ? `<button class="btn small ghost" data-act="auto">Auto ${this.autoplay ? 'on' : 'off'}</button>` : ''}</div>`;
    if (this.setHtml(roster, cards + orderRow)) {
      roster.querySelectorAll<HTMLElement>('.pc').forEach((slot) => {
        const u = unitById(s, Number(slot.dataset.u));
        if (!u) return;
        const pilot = u.slot >= 0 ? this.app.campaign!.mechs[u.slot]?.pilot : null;
        slot.replaceWith(pilot ? this.cachedPortrait(pilot.id, pilot) : this.copyCanvas(spriteCanvas(u.def, this.view.pal, 40)));
      });
    }

    // deploy panel
    const dp = q('h-deploy');
    const unitPanel = q('h-unit');
    const actions = q('h-actions');
    const hint = q('h-hint');
    if (s.phase === 'deploy') {
      const left = undeployed(s).length;
      dp.classList.remove('hidden');
      unitPanel.classList.add('hidden');
      hint.classList.add('hidden');
      const cur = this.selected();
      this.setHtml(
        dp,
        `<div class="h3">${t('deploy.title')}</div>
        <div class="dim" style="font-size:13px;margin:6px 0 10px">${cur ? `${t('deploy.placing', { mech: `<b class="amber">${esc(unitName(cur.def))}</b>` })}<br>` : ''}${t('deploy.help')}${s.hazard ? ` <br><span style="color:var(--violet)">${esc(hazardName(s.hazard))}</span>: ${esc(hazardDesc(s.hazard))}` : ''}</div>
        <button class="btn big" data-act="deploy" ${left ? 'disabled' : ''}>${left ? tn('deploy.left', left) : `${icon('bolt')}${t('deploy.confirm')}`}</button>`,
      );
      this.setHtml(actions, '');
      return;
    }
    dp.classList.add('hidden');

    const shown = this.selected() ?? (this.hoverUnit ? unitById(s, this.hoverUnit) : undefined);
    if (shown && shown.x >= 0) {
      unitPanel.classList.remove('hidden');
      hint.classList.add('hidden');
      if (this.setHtml(unitPanel, this.unitPanelHtml(shown))) {
        const holder = unitPanel.querySelector('.ucv') as HTMLElement;
        holder.replaceWith(this.copyCanvas(spriteCanvas(shown.def, this.view.pal, 64, 1.05)));
      }
    } else {
      unitPanel.classList.add('hidden');
      const ready = s.phase === 'player' && idleUnits(s).length > 0;
      hint.classList.toggle('hidden', s.phase !== 'player' || busy);
      this.setHtml(
        hint,
        ready
          ? t('hint.select')
          : t('hint.allDone', { end: `<b class="amber">${t('hud.endTurn')}</b>` }),
      );
    }

    const canUndo = this.undo.length > 0 && s.phase === 'player' && !busy;
    const canReset = !s.resetUsed && s.phase === 'player' && !busy && !!this.turnStart;
    const allDone = s.phase === 'player' && idleUnits(s).filter((u) => canAct(s, u) && !u.acted).length === 0;
    this.setHtml(
      actions,
      `<button class="btn ghost" data-act="undo" ${canUndo ? '' : 'disabled'}>${icon('undo')}${t('hud.undo')} <span class="key">Z</span></button>
      <button class="btn ghost" data-act="reset" ${canReset ? '' : 'disabled'} title="${esc(t('hud.resetTitle'))}">${icon('reset')}${t('hud.reset')} ${s.resetUsed ? '' : '<span class="key">1×</span>'}</button>
      <button class="btn big ${allDone ? '' : 'ghost'}" data-act="end" ${s.phase === 'player' && !busy ? '' : 'disabled'} style="${allDone ? 'box-shadow:0 0 18px rgba(255,207,74,.45)' : ''}">${icon('end')}${t('hud.endTurn')}</button>`,
    );
  }

  private portraits = new Map<string, HTMLCanvasElement>();

  private cachedPortrait(id: string, p: Parameters<typeof portraitCanvas>[0]): HTMLCanvasElement {
    let c = this.portraits.get(id);
    if (!c) {
      c = portraitCanvas(p, 40, this.view.pal.main);
      this.portraits.set(id, c);
    }
    return this.copyCanvas(c);
  }

  private unitPanelHtml(u: Unit): string {
    const s = this.s;
    const d = UNITS[u.def];
    const statuses: string[] = [];
    if (u.fire) statuses.push(`<span class="chip" style="color:#ff8a2a">${icon('flame')}${t('status.burning')}</span>`);
    if (u.acid) statuses.push(`<span class="chip green">${icon('drop')}${t('status.acid')}</span>`);
    if (u.frozen) statuses.push(`<span class="chip cyan">${icon('snow')}${t('common.frozen')}</span>`);
    if (u.shield) statuses.push(`<span class="chip cyan">${icon('shield')}${t('status.shield')}</span>`);
    if (u.webbedBy) statuses.push(`<span class="chip">${icon('web')}${t('status.webbed')}</span>`);
    if (isArmored(s, u)) statuses.push(`<span class="chip">${icon('armor')}${t('common.armored')}</span>`);
    if (u.flying) statuses.push(`<span class="chip">${t('common.flying')}</span>`);
    if (inSmoke(s, u)) statuses.push(`<span class="chip">${icon('smoke')}${t('common.inSmoke')}</span>`);
    if (submerged(s, u)) statuses.push(`<span class="chip cyan">${t('common.submerged')}</span>`);
    const head = `<div class="ucv"></div><div class="uname">${esc(unitName(u.def))} ${d.cls ? `<span class="chip">${esc(className(d.cls))}</span>` : ''}${u.alpha ? `<span class="chip red">${t('common.alpha')}</span>` : ''}${u.boss ? `<span class="chip red">${t('common.leader')}</span>` : ''}</div>
      <div class="meta">${pips(Math.max(0, u.hp), u.maxHp, u.team === 'enemy')}<span>${t('panel.hp', { hp: u.hp, max: u.maxHp })}</span><span>${icon('move')} ${u.move}</span>${statuses.join('')}</div>`;
    if (u.team === 'enemy') {
      const w = d.weapon ? resolveWeapon(d.weapon, u) : null;
      const th = this.threats.find((t) => t.id === u.id);
      let attack = '';
      if (w && w.kind !== 'none') {
        attack = `<b class="red">${esc(weaponName(w.id))}</b>${w.dmg ? ` <span class="dim">(${t('panel.dmg', { n: w.dmg })})</span>` : ''} — ${esc(weaponDesc(w.id))}`;
        if (u.plan) attack += ` <span class="chip red">${t('tip.attackN', { n: u.plan.order })}</span>${th?.cancel ? ` <span class="chip cyan">${t('panel.cancelled')}</span>` : ''}`;
      }
      return `${head}<div class="enemy-desc">${esc(unitDesc(u.def))}${attack ? `<br>${attack}` : ''}${u.plan ? `<br><span class="dim">${t('panel.pushHint')}</span>` : ''}</div>`;
    }
    if (u.team !== 'player') return `${head}<div class="enemy-desc">${esc(unitDesc(u.def))}</div>`;
    const pilot = u.slot >= 0 ? this.app.campaign!.mechs[u.slot]?.pilot : null;
    const pilotLine = pilot ? `<span class="dim">${t('common.pilot')}</span> <b>${esc(pilotName(pilot))}</b>${pilot.ai ? '' : ` · <span class="amber">${esc(skillName(pilot.skill))}</span>`}` : '';
    const buttons = u.weapons
      .map((inst, i) => {
        const w = resolveWeapon(inst, u);
        const why = msg(s.phase === 'player' ? weaponBlock(s, u, i) : 'block.notYourTurn');
        const uses = inst.uses >= 0 ? ` · ${tn('panel.usesLeft', inst.uses)}` : '';
        return `<button class="wbtn ${this.slot === i ? 'active' : ''}" data-act="weapon" data-slot="${i}" ${why ? 'disabled' : ''} title="${esc(weaponDesc(w.id))}${why ? `\n\n${esc(t('panel.unavailable', { why }))}` : ''}">${icon(w.icon)}<span class="wn">${i + 1}. ${esc(weaponName(w.id))}</span><span class="ws">${weaponStats(w) || t('panel.utility')}${uses}${why ? ` · <span class="red">${esc(why)}</span>` : ''}</span></button>`;
      })
      .join('');
    const rwhy = msg(s.phase === 'player' ? repairBlock(s, u) : 'block.notYourTurn');
    const repairBtn = `<button class="wbtn" data-act="repair" ${rwhy ? 'disabled' : ''} title="${esc(t(u.skill === 'medic' ? 'panel.repairTitleMedic' : 'panel.repairTitle'))}">${icon('repair')}<span class="wn">R. ${t('panel.repair')}</span><span class="ws">${rwhy ? `<span class="red">${esc(rwhy)}</span>` : t('panel.repairStats', { n: u.skill === 'medic' ? 2 : 1 })}</span></button>`;
    return `${head}<div class="meta" style="font-size:12px">${pilotLine}</div><div class="weapons">${buttons}${repairBtn}</div>`;
  }
}
