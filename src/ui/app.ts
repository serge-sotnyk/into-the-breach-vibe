import type { BattleState, Campaign, Difficulty } from '../game/types';
import { Renderer } from '../render/renderer';
import { Sound } from '../audio/audio';
import { applyBattle, currentMission, enterFinal, enterIsland, leaveShop, newCampaign, startMission, type MissionReport } from '../game/campaign/campaign';
import { clearResume, loadSettings, readResume, saveSettings, writeResume, type Settings } from '../game/campaign/save';
import { bind, el, type Handlers } from './dom';
import { TitleScreen } from './screens/title';
import { SquadScreen } from './screens/squad';
import { WorldScreen } from './screens/world';
import { IslandScreen } from './screens/island';
import { BattleScreen } from './screens/battle';
import { ShopScreen } from './screens/shop';
import { EndScreen } from './screens/end';
import { showResults } from './modals/results';

export interface Screen {
  mount(root: HTMLElement): void;
  unmount?(): void;
  frame?(dt: number, t: number): void;
  key?(e: KeyboardEvent): void;
  resize?(): void;
  /** campaign time accumulates while this screen is active */
  inGame?: boolean;
}

export interface ModalHandle {
  el: HTMLElement;
  close(): void;
}

export class App {
  readonly canvas = document.getElementById('board') as HTMLCanvasElement;
  readonly ui = document.getElementById('ui') as HTMLElement;
  readonly modalRoot = document.getElementById('modal-root') as HTMLElement;
  readonly toastRoot = document.getElementById('toast-root') as HTMLElement;
  readonly tooltip = document.getElementById('tooltip') as HTMLElement;
  readonly bannerEl = document.getElementById('banner') as HTMLElement;
  readonly renderer = new Renderer(this.canvas);
  readonly sound = new Sound();
  readonly debug = new URLSearchParams(location.search).has('debug');
  settings: Settings = loadSettings();
  campaign: Campaign | null = null;
  screen: Screen | null = null;
  private modals: { el: HTMLElement; onClose?: () => void; dismissable: boolean }[] = [];
  private last = performance.now();
  private resumeTimer = 0;

  start(): void {
    this.sound.setVolumes(this.settings.sfx, this.settings.music);
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.screen?.resize?.();
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('pointerdown', () => this.sound.unlock(), { capture: true });
    window.addEventListener('keydown', () => this.sound.unlock(), { capture: true });
    window.addEventListener('beforeunload', () => this.flushResume());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flushResume();
    });
    this.renderer.resize();
    requestAnimationFrame((t) => this.loop(t, true));
    // Watchdog: keep the simulation ticking when rAF is throttled (background tabs, hidden panes).
    window.setInterval(() => {
      const now = performance.now();
      if (now - this.last > 220) this.loop(now, false);
    }, 250);
    const params = new URLSearchParams(location.search);
    if (params.get('screen') === 'new') this.showSquadSelect();
    else this.showTitle();
  }

  private loop(now: number, fromRaf: boolean): void {
    const dt = Math.min(fromRaf ? 0.05 : 0.3, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    try {
      this.screen?.frame?.(dt, now / 1000);
    } catch (err) {
      console.error(err);
    }
    if (this.campaign && this.screen?.inGame && document.visibilityState === 'visible') this.campaign.playMs += dt * 1000;
    if (fromRaf) requestAnimationFrame((t) => this.loop(t, true));
  }

  private onKey(e: KeyboardEvent): void {
    if (this.modals.length) {
      if (e.key === 'Escape') {
        const top = this.modals[this.modals.length - 1];
        if (top.dismissable) this.closeTopModal();
        e.preventDefault();
      }
      return;
    }
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    this.screen?.key?.(e);
  }

  setScreen(s: Screen): void {
    this.screen?.unmount?.();
    this.closeAllModals();
    this.hideTooltip();
    this.ui.innerHTML = '';
    this.ui.className = '';
    this.screen = s;
    this.renderer.setInsets(0, 0, 0, 0);
    s.mount(this.ui);
    this.renderer.resize();
  }

  // ------------------------------------------------------------------ overlays

  modal(content: HTMLElement | string, opts: { cls?: string; dismissable?: boolean; onClose?: () => void; handlers?: Handlers } = {}): ModalHandle {
    const back = el('<div class="modal-back"></div>');
    const box = typeof content === 'string' ? el(`<div class="panel modal ${opts.cls ?? ''}">${content}</div>`) : content;
    if (typeof content !== 'string') box.classList.add('panel', 'modal');
    back.appendChild(box);
    this.modalRoot.appendChild(back);
    const entry = { el: back, onClose: opts.onClose, dismissable: opts.dismissable ?? true };
    this.modals.push(entry);
    if (opts.handlers) bind(box, opts.handlers, () => this.sound.play('click'));
    back.addEventListener('mousedown', (ev) => {
      if (ev.target === back && entry.dismissable) this.closeModal(entry.el);
    });
    return { el: box, close: () => this.closeModal(back) };
  }

  private closeModal(back: HTMLElement): void {
    const i = this.modals.findIndex((m) => m.el === back);
    if (i < 0) return;
    const [m] = this.modals.splice(i, 1);
    m.el.remove();
    m.onClose?.();
  }

  closeTopModal(): void {
    const top = this.modals[this.modals.length - 1];
    if (top) this.closeModal(top.el);
  }

  closeAllModals(): void {
    while (this.modals.length) {
      const m = this.modals.pop()!;
      m.el.remove();
    }
  }

  get modalOpen(): boolean {
    return this.modals.length > 0;
  }

  confirm(title: string, body: string, ok = 'Confirm', danger = false): Promise<boolean> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v: boolean): void => {
        if (done) return;
        done = true;
        h.close();
        resolve(v);
      };
      const h = this.modal(
        `<div class="h2">${title}</div><p style="max-width:460px;line-height:1.45;color:#c9d3df">${body}</p>
         <div class="actions"><button class="btn ghost" data-act="no">Cancel</button><button class="btn ${danger ? 'danger' : ''}" data-act="yes">${ok}</button></div>`,
        { handlers: { yes: () => finish(true), no: () => finish(false) }, onClose: () => finish(false) },
      );
    });
  }

  toast(msg: string, err = false): void {
    const t = el(`<div class="panel toast ${err ? 'err red' : ''}">${msg}</div>`);
    this.toastRoot.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  showTooltip(html: string, x: number, y: number): void {
    const tt = this.tooltip;
    tt.innerHTML = html;
    tt.classList.remove('hidden');
    const r = tt.getBoundingClientRect();
    let left = x + 18;
    let top = y + 16;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 18;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 12;
    tt.style.left = `${Math.max(8, left)}px`;
    tt.style.top = `${Math.max(8, top)}px`;
  }

  hideTooltip(): void {
    this.tooltip.classList.add('hidden');
  }

  banner(text: string, sub: string, tone: 'player' | 'enemy' | 'neutral'): void {
    const b = this.bannerEl;
    b.className = `banner ${tone}`;
    b.innerHTML = `<div class="bar"><div class="t">${text}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
    void b.offsetWidth;
    b.classList.add('show');
  }

  applySettings(s: Settings): void {
    this.settings = s;
    saveSettings(s);
    this.sound.setVolumes(s.sfx, s.music);
  }

  // ------------------------------------------------------------------ persistence

  /** Debounced auto-resume save (separate from manual slots). */
  saveResume(battle: BattleState | null = null, regionId = ''): void {
    if (!this.campaign) return;
    const c = this.campaign;
    if (c.phase === 'defeat' || c.phase === 'victory') {
      clearResume();
      return;
    }
    window.clearTimeout(this.resumeTimer);
    const data = { campaign: structuredClone(c), battle: battle ? structuredClone(battle) : null, regionId, savedAt: Date.now() };
    this.pendingResume = data;
    this.resumeTimer = window.setTimeout(() => this.flushResume(), 250);
  }

  private pendingResume: Parameters<typeof writeResume>[0] | null = null;

  flushResume(): void {
    if (!this.pendingResume) return;
    writeResume(this.pendingResume);
    this.pendingResume = null;
  }

  // ------------------------------------------------------------------ flow

  showTitle(): void {
    this.campaign = null;
    this.sound.music('menu');
    this.setScreen(new TitleScreen(this));
  }

  showSquadSelect(): void {
    this.setScreen(new SquadScreen(this));
  }

  startCampaign(squad: string, diff: Difficulty): void {
    this.campaign = newCampaign(squad, diff);
    this.saveResume();
    this.showWorld();
  }

  /** Routes to the screen matching the campaign phase. */
  route(): void {
    const c = this.campaign;
    if (!c) return this.showTitle();
    this.sound.music('menu');
    switch (c.phase) {
      case 'world':
        return this.showWorld();
      case 'island':
        return this.showIsland();
      case 'shop':
        return this.setScreen(new ShopScreen(this));
      case 'final':
        return this.showIsland();
      case 'victory':
        return this.setScreen(new EndScreen(this, true));
      case 'defeat':
        return this.setScreen(new EndScreen(this, false));
    }
  }

  loadCampaign(c: Campaign): void {
    this.campaign = c;
    this.saveResume();
    this.route();
  }

  resume(): void {
    const r = readResume();
    if (!r) return;
    this.campaign = r.campaign;
    if (r.battle && r.battle.phase !== 'won' && r.battle.phase !== 'lost') {
      this.sound.music('battle');
      this.setScreen(new BattleScreen(this, r.battle, r.regionId));
      return;
    }
    this.route();
  }

  showWorld(): void {
    if (!this.campaign) return;
    this.sound.music('menu');
    this.setScreen(new WorldScreen(this));
  }

  openIsland(i: number): void {
    if (!this.campaign) return;
    enterIsland(this.campaign, i);
    this.saveResume();
    this.showIsland();
  }

  openFinal(): void {
    if (!this.campaign) return;
    enterFinal(this.campaign);
    this.saveResume();
    this.showIsland();
  }

  showIsland(): void {
    this.sound.music('menu');
    this.setScreen(new IslandScreen(this));
  }

  launchMission(regionId: string): void {
    const c = this.campaign;
    if (!c) return;
    const spec = currentMission(c, regionId);
    if (!spec) return;
    const s = startMission(c, spec);
    this.sound.music('battle');
    this.setScreen(new BattleScreen(this, s, regionId));
    this.saveResume(s, regionId);
  }

  finishBattle(s: BattleState, regionId: string): void {
    const c = this.campaign;
    if (!c) return;
    const report: MissionReport = applyBattle(c, regionId, s);
    if (c.phase === 'defeat' || c.phase === 'victory') clearResume();
    else this.saveResume();
    this.flushResume();
    showResults(this, report, () => this.afterResults(report));
  }

  private afterResults(report: MissionReport): void {
    const c = this.campaign;
    if (!c) return;
    if (report.finalNext) {
      this.showIsland();
      return;
    }
    this.route();
  }

  leaveShop(): void {
    if (!this.campaign) return;
    leaveShop(this.campaign);
    this.saveResume();
    this.showWorld();
  }

  abandonToTitle(): void {
    this.flushResume();
    this.showTitle();
  }
}
