import type { App, Screen } from '../app';
import type { BattleState, MissionSpec } from '../../game/types';
import { SQUADS } from '../../game/data/squads';
import { PILOT_POOL } from '../../game/data/pilots';
import { createBattle } from '../../game/battle/mapgen';
import { autoAct, autoDeploy } from '../../game/battle/autoplay';
import { startBattle, withoutRecording } from '../../game/battle/turn';
import { computeThreats, type Threat } from '../../game/battle/preview';
import { readResume } from '../../game/campaign/save';
import { Animator } from '../../render/anim';
import { emptyView, type View } from '../../render/renderer';
import { bind, el } from '../dom';
import { esc } from '../common';
import { icon } from '../icons';
import { openSaves } from '../modals/saves';
import { openHelp, openSettings } from '../modals/misc';
import { cloneBattle } from '../../game/util';
import { LANGS, getLang, isLang, t, tn } from '../../i18n';
import { missionTitle } from '../../i18n/names';

const THEMES = ['verdant', 'dune', 'glacier', 'cinder'];
const POOLS: Record<string, string[]> = {
  verdant: ['wasp', 'spitter', 'beetle', 'stinger'],
  dune: ['beetle', 'rammer', 'crawler', 'spitter'],
  glacier: ['rammer', 'stinger', 'spitter', 'leaper'],
  cinder: ['crawler', 'burster', 'wasp', 'beetle'],
};

/** Title screen with an AI-driven demo battle playing in the background. */
export class TitleScreen implements Screen {
  private s!: BattleState;
  private anim: Animator;
  private view: View;
  private wait = 1.2;
  private threats: Threat[] = [];
  private threatState: BattleState | null = null;
  private squad = 'ironclad';

  constructor(private app: App) {
    this.anim = new Animator(app.renderer, { sound: () => undefined, banner: () => undefined });
    this.view = emptyView(SQUADS.ironclad.palette);
    this.newDemo();
  }

  private newDemo(): void {
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    this.squad = Object.keys(SQUADS)[Math.floor(Math.random() * 3)];
    const spec: MissionSpec = {
      id: 'demo',
      kind: 'standard',
      seed: (Math.random() * 2 ** 31) >>> 0,
      theme,
      turns: 5,
      objectives: [],
      hazard: '',
      pool: POOLS[theme],
      initial: 3,
      spawnPlan: [2, 2, 2, 2, 2],
      maxEnemies: 6,
      alphaChance: 0.25,
      psionChance: 0,
      boss: '',
    };
    const sq = SQUADS[this.squad];
    this.s = createBattle(spec, {
      mechs: sq.mechs.map((m, slot) => ({ chassis: m.chassis, slot, weapons: m.weapons.map((id) => ({ id, up: [] })), pilot: { id: `d${slot}`, name: PILOT_POOL[slot].name, skill: '', xp: 0, level: 0, ai: false, look: slot } })),
      grid: 7,
      gridMax: 8,
      gridDef: 15,
    });
    this.s.grid = 99;
    autoDeploy(this.s);
    withoutRecording(() => startBattle(this.s));
    this.view = emptyView(sq.palette);
    this.app.renderer.fx.clear();
  }

  mount(root: HTMLElement): void {
    const resume = readResume();
    let contSub = '';
    if (resume) {
      const c = resume.campaign;
      const b = resume.battle;
      const name = b ? missionTitle(b.kind, resume.regionId) : '';
      contSub = b
        ? b.phase === 'deploy'
          ? t('title.contDeploy', { name })
          : t('title.contTurn', { name, turn: b.turn })
        : tn('common.islandsSecured', c.secured);
    }
    const node = el(`<div class="title-screen">
      <div class="title-menu">
        <div class="logo">IRON<span>GRID</span></div>
        <div class="tag">${t('title.tagline')}</div>
        ${resume ? `<button class="btn big" data-act="continue">${icon('end')}${t('common.continue')}<span class="cont-sub">${esc(contSub)}</span></button>` : ''}
        <button class="btn big ${resume ? 'ghost' : ''}" data-act="new">${icon('bolt')}${t('title.new')}</button>
        <button class="btn big ghost" data-act="load">${icon('load')}${t('title.load')}</button>
        <button class="btn big ghost" data-act="help">${icon('info')}${t('common.howToPlay')}</button>
        <button class="btn big ghost" data-act="settings">${icon('gear')}${t('common.settings')}</button>
        <div class="lang-switch" title="${esc(t('settings.language'))}">${LANGS.map((l) => `<button class="btn small ${l.id === getLang() ? '' : 'ghost'}" data-act="lang" data-lang="${l.id}">${l.short}</button>`).join('')}</div>
      </div>
      <div class="title-foot">${t('title.foot')}</div>
    </div>`);
    root.appendChild(node);
    bind(node, {
      continue: () => this.app.resume(),
      new: async () => {
        if (readResume()) {
          const ok = await this.app.confirm(t('title.newQ'), t('title.newBody'), t('title.newOk'), true);
          if (!ok) return;
        }
        this.app.showSquadSelect();
      },
      load: () => openSaves(this.app, 'load'),
      help: () => openHelp(this.app),
      settings: () => openSettings(this.app),
      lang: (b) => {
        if (isLang(b.dataset.lang)) this.app.setLang(b.dataset.lang);
      },
    }, () => this.app.sound.play('click'));
    this.resize();
  }

  /** The demo battle fills the space to the right of the menu. */
  resize(): void {
    const menu = this.app.ui.querySelector('.title-menu');
    const right = menu ? menu.getBoundingClientRect().right : 0;
    this.app.renderer.setInsets(right + 20, 20, 40, 40);
  }

  frame(dt: number, t: number): void {
    const r = this.app.renderer;
    r.fx.update(dt);
    this.anim.update(dt);
    if (!this.anim.busy) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.s.phase === 'won' || this.s.phase === 'lost') {
          this.newDemo();
          this.wait = 1;
        } else {
          const before = cloneBattle(this.s);
          const steps = autoAct(this.s);
          if (steps.length) this.anim.play(before, steps);
          this.wait = 0.5;
        }
      }
    }
    const d = this.anim.display();
    const state = d ? d.state : this.s;
    if (state !== this.threatState) {
      this.threatState = state;
      this.threats = state.phase === 'player' ? computeThreats(state) : [];
    }
    this.view.threats = this.threats;
    this.view.overlay = d ? d.overlay : null;
    r.draw(state, this.view, t);
  }
}
