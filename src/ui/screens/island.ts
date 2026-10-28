import type { App, Screen } from '../app';
import type { MissionSpec, RegionState } from '../../game/types';
import { SQUADS } from '../../game/data/squads';
import { UNITS } from '../../game/data/units';
import { REGIONS_BEFORE_BOSS, regionAvailable, regionsDone } from '../../game/campaign/campaign';
import { renderThumb } from '../../render/renderer';
import { bind, el } from '../dom';
import { esc, rewardChips } from '../common';
import { icon } from '../icons';
import { islandBoard } from '../thumbs';
import { campaignStats } from './world';
import { openHangar } from '../modals/hangar';
import { openHelp, openSettings } from '../modals/misc';
import { t, tn } from '../../i18n';
import { hazardDesc, hazardName, islandCorp, islandName, missionBriefing, missionTitle, objectiveHint, objectiveLabel, unitDesc, unitName } from '../../i18n/names';

interface Node {
  id: string;
  name: string;
  px: number;
  py: number;
  boss: boolean;
  done: boolean;
  available: boolean;
  mission: MissionSpec | null;
  region: RegionState | null;
}

export class IslandScreen implements Screen {
  inGame = true;
  private sel = '';
  private root!: HTMLElement;

  constructor(private app: App) {}

  private nodes(): Node[] {
    const c = this.app.campaign!;
    if (c.phase === 'final') {
      return c.finalMissions.map((m, i) => ({
        id: `final-${i}`,
        name: missionTitle(m.kind, ''),
        px: i === 0 ? 0.3 : 0.62,
        py: i === 0 ? 0.62 : 0.4,
        boss: i === 1,
        done: c.finalStage > i,
        available: c.finalStage === i,
        mission: m,
        region: null,
      }));
    }
    const isl = c.islands[c.current];
    return isl.regions.map((r) => ({ id: r.id, name: missionTitle(r.mission?.kind ?? 'standard', r.id), px: r.px, py: r.py, boss: r.boss, done: r.done, available: regionAvailable(isl, r), mission: r.mission, region: r }));
  }

  mount(root: HTMLElement): void {
    this.root = root;
    const first = this.nodes().find((n) => n.available);
    this.sel = first?.id ?? '';
    this.render();
  }

  private render(): void {
    const c = this.app.campaign!;
    const final = c.phase === 'final';
    const sq = SQUADS[c.squad];
    const islandId = final ? 'caldera' : c.islands[c.current].id;
    const title = islandName(islandId);
    const sub = final ? t('island.finalAssault') : islandCorp(islandId);
    const stages = c.finalMissions.length;
    const progress = final
      ? t('island.stage', { n: Math.min(stages, c.finalStage + 1), max: stages })
      : t('island.defended', { n: regionsDone(c.islands[c.current]), max: REGIONS_BEFORE_BOSS });
    this.root.innerHTML = '';
    const node = el(`<div class="screen">
      <div class="topbar">
        <div><div class="h2" style="color:${final ? 'var(--red)' : 'var(--amber)'}">${esc(title)}</div><div class="label">${esc(sub)} · ${progress}</div></div>
        <div class="grow"></div>
        ${campaignStats(c)}
        <button class="btn small" data-act="hangar">${icon('wrench')}${t('common.hangar')}</button>
        <button class="btn small ghost" data-act="help">${icon('info')}</button>
        <button class="btn small ghost" data-act="settings">${icon('gear')}</button>
        <button class="btn small ghost" data-act="title">${t('common.title')}</button>
      </div>
      <div class="island-layout">
        <div class="island-map" id="imap"></div>
        <div class="briefing" id="brief"></div>
      </div></div>`);
    this.root.appendChild(node);
    bind(
      node,
      {
        region: (b) => {
          this.sel = b.dataset.id!;
          this.app.sound.play('select');
          this.render();
        },
        deploy: () => {
          const n = this.nodes().find((x) => x.id === this.sel);
          if (!n || !n.available) return;
          this.app.launchMission(n.region ? n.region.id : '');
        },
        hangar: () => openHangar(this.app, () => this.render()),
        help: () => openHelp(this.app),
        settings: () => openSettings(this.app),
        title: async () => {
          const ok = await this.app.confirm(t('common.returnQ'), t('island.returnBody'), t('common.returnOk'));
          if (ok) this.app.abandonToTitle();
        },
      },
      () => this.app.sound.play('click'),
    );
    requestAnimationFrame(() => this.drawMap(sq.palette));
    this.renderBrief();
  }

  private drawMap(pal: (typeof SQUADS)[string]['palette']): void {
    const c = this.app.campaign!;
    const box = this.root.querySelector('#imap') as HTMLElement | null;
    if (!box) return;
    box.innerHTML = '';
    const w = box.clientWidth;
    const h = box.clientHeight;
    const theme = c.phase === 'final' ? 'caldera' : c.islands[c.current].id;
    const seed = (c.seed + (c.phase === 'final' ? 99 : c.current) * 7919) >>> 0;
    const { canvas, map } = renderThumb(islandBoard(theme, seed), w, h, pal, false);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    box.appendChild(canvas);
    for (const n of this.nodes()) {
      const [x, y] = map(0.4 + n.px * 7.2, 0.4 + n.py * 7.2);
      const cls = ['region', n.done ? 'done' : '', n.available ? 'avail' : '', !n.done && !n.available ? 'locked' : '', n.boss ? 'boss' : '', n.id === this.sel ? 'sel' : ''].join(' ');
      const glyph = n.done ? icon('check') : n.boss ? icon('skull') : n.available ? icon('target') : icon('cross');
      const rewards = n.mission && !n.done ? `<div class="rewards">${n.mission.objectives.map((o) => rewardChips(o.reward)).join('')}</div>` : '';
      const pin = el(`<div class="${cls}" data-act="region" data-id="${n.id}" style="left:${x}px;top:${y - 30}px">
          <div class="pin">${glyph}</div><div class="rname">${esc(n.name)}</div>${rewards}</div>`);
      box.appendChild(pin);
    }
  }

  private renderBrief(): void {
    const box = this.root.querySelector('#brief') as HTMLElement;
    const n = this.nodes().find((x) => x.id === this.sel);
    if (!n || !n.mission) {
      box.innerHTML = `<div class="dim">${t('island.selectRegion')}</div>`;
      return;
    }
    const m = n.mission;
    const objectives = m.objectives
      .map((o) => {
        const main = o.kind === 'bomb';
        return `<div class="obj-line ${main ? 'main' : ''}" title="${esc(objectiveHint(o.kind))}"><span class="${main ? 'cyan' : 'amber'}">${icon(main ? 'bolt' : 'star')}</span><span class="grow">${esc(objectiveLabel(o, m.boss))}${main ? ` <span class="red">${t('island.required')}</span>` : ''}</span>${rewardChips(o.reward)}</div>`;
      })
      .join('');
    const enemies = [...new Set([...(m.boss ? [m.boss] : []), ...m.pool])]
      .map((id) => `<span class="chip ${UNITS[id].boss ? 'red' : ''}" title="${esc(unitDesc(id))}">${esc(unitName(id))}</span>`)
      .join('');
    let status = '';
    if (n.done) status = `<div class="obj-line ok"><span class="green">${icon('check')}</span><span class="grow">${t('island.regionDefended')}</span></div>`;
    else if (!n.available)
      status = n.boss
        ? `<div class="obj-line fail"><span class="red">${icon('cross')}</span><span class="grow">${tn('island.bossLocked', REGIONS_BEFORE_BOSS)}</span></div>`
        : `<div class="obj-line fail"><span class="red">${icon('cross')}</span><span class="grow">${t('island.regionLocked')}</span></div>`;
    box.innerHTML = `
      <div><div class="label">${n.boss ? t('island.leaderSighted') : t('island.region')}</div><div class="h2">${esc(n.name)}</div></div>
      <p style="margin:0;line-height:1.45;color:#c9d3df;font-size:14px">${esc(missionBriefing(m, n.region ? n.region.id : ''))}</p>
      <div><div class="label" style="margin-bottom:6px">${t('hud.objectives')}</div>
        <div class="obj-line main"><span class="cyan">${icon('hourglass')}</span><span class="grow">${tn('hud.survive', m.turns)} · ${t('island.keepGrid')}</span></div>
        ${objectives}</div>
      ${m.hazard ? `<div><div class="label" style="margin-bottom:6px">${t('island.environment')}</div><div class="obj-line" style="border-left-color:var(--violet)"><span class="grow"><b>${esc(hazardName(m.hazard))}</b><br><span class="dim">${esc(hazardDesc(m.hazard))}</span></span></div></div>` : ''}
      <div><div class="label" style="margin-bottom:6px">${t('island.expectedVek')}</div><div class="enemy-chips">${enemies}</div></div>
      ${status}
      <div style="margin-top:auto;display:flex;gap:10px">
        <button class="btn big" style="flex:1" data-act="deploy" ${n.available ? '' : 'disabled'}>${icon('bolt')}${t('island.deploy')}</button>
      </div>`;
  }

  key(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      const n = this.nodes().find((x) => x.id === this.sel);
      if (n?.available) this.app.launchMission(n.region ? n.region.id : '');
    }
  }

  resize(): void {
    this.render();
  }

  relocalize(): void {
    this.render();
  }
}
