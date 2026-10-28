import type { App, Screen } from '../app';
import type { Campaign } from '../../game/types';
import { ISLANDS } from '../../game/data/islands';
import { SQUADS } from '../../game/data/squads';
import { FINAL_UNLOCK, REGIONS_BEFORE_BOSS, finalUnlocked, freeCores } from '../../game/campaign/campaign';
import { renderThumb } from '../../render/renderer';
import { bind, el } from '../dom';
import { esc, gridBar } from '../common';
import { icon } from '../icons';
import { islandBoard } from '../thumbs';
import { openSaves } from '../modals/saves';
import { openHangar } from '../modals/hangar';
import { openHelp, openSettings } from '../modals/misc';
import { fmtTime, t, tn } from '../../i18n';
import { difficultyName, islandCorp, islandDesc, islandName, squadName, unitName } from '../../i18n/names';

export function campaignStats(c: Campaign): string {
  return `<div class="statgroup" title="${esc(t('stats.gridTitle'))}">${icon('bolt')}<span class="label">${t('stats.grid')}</span>${gridBar(c.grid, c.gridMax)}<b>${c.grid}/${c.gridMax}</b></div>
    <div class="statgroup" title="${esc(t('stats.defenseTitle'))}"><span class="label">${t('stats.defense')}</span><b>${c.gridDef}%</b></div>
    <div class="statgroup" title="${esc(t('stats.repTitle'))}"><span class="amber">${icon('star')}</span><b>${c.rep}</b></div>
    <div class="statgroup" title="${esc(t('stats.coresTitle'))}"><span class="cyan">${icon('core')}</span><b>${freeCores(c)}/${c.cores}</b></div>`;
}

export class WorldScreen implements Screen {
  inGame = true;
  constructor(private app: App) {}

  mount(root: HTMLElement): void {
    const c = this.app.campaign!;
    const sq = SQUADS[c.squad];
    const unlocked = finalUnlocked(c);
    const cards = c.islands
      .map((isl, i) => {
        const def = ISLANDS.find((d) => d.id === isl.id)!;
        const status = isl.secured
          ? `<div class="status green">${icon('check')} ${t('world.secured')}</div>`
          : `<div class="status amber">${icon('target')} ${t('world.threat', { n: c.secured + 1 })}</div>`;
        return `<div class="panel island-card ${isl.secured ? 'secured' : ''}" data-act="${isl.secured ? '' : 'island'}" data-i="${i}">
          <div data-thumb="${i}"></div>
          <div><div class="h2">${esc(islandName(def.id))}</div><div class="label" style="margin:2px 0 6px">${esc(islandCorp(def.id))}</div>
            <div style="font-size:13px;line-height:1.4;color:#c9d3df">${esc(islandDesc(def.id))}</div>
            <div style="margin-top:6px;font-size:12px" class="dim">${t('world.vek')}: ${def.pool.map((p) => esc(unitName(p))).join(', ')} · ${t('common.leader')}: <span class="red">${esc(unitName(def.boss))}</span></div>
            ${status}</div></div>`;
      })
      .join('');
    const finalCard = `<div class="panel red island-card final-card ${unlocked ? '' : 'locked'}" data-act="${unlocked ? 'final' : 'locked'}">
        <div data-thumb="final"></div>
        <div><div class="h2 red">${esc(islandName('caldera'))}</div><div class="label" style="margin:2px 0 6px">${t('world.finalSub')}</div>
          <div style="font-size:13px;line-height:1.4;color:#c9d3df">${esc(islandDesc('caldera'))}</div>
          <div class="status ${unlocked ? 'red' : 'dim'}">${unlocked ? `${icon('skull')} ${t('world.finalReady')}` : `${icon('cross')} ${tn('world.finalLocked', FINAL_UNLOCK, { done: c.secured })}`}</div></div></div>`;

    const node = el(`<div class="screen"><div class="bg-grid"></div>
      <div class="topbar">
        <div class="h2" style="color:var(--amber)">${esc(squadName(sq.id))}</div>
        <span class="chip">${esc(difficultyName(c.difficulty))}</span>
        <span class="dim" style="font-size:12px">${fmtTime(c.playMs)}</span>
        <div class="grow"></div>
        ${campaignStats(c)}
      </div>
      <div class="topbar" style="background:rgba(5,8,12,.6)">
        <div class="h3">${t('world.choose')}</div>
        <div class="dim" style="font-size:13px">${tn('world.each', REGIONS_BEFORE_BOSS)}</div>
        <div class="grow"></div>
        <button class="btn small" data-act="hangar">${icon('wrench')}${t('common.hangar')}</button>
        <button class="btn small cyan" data-act="save">${icon('save')}${t('world.save')}</button>
        <button class="btn small ghost" data-act="load">${icon('load')}${t('world.load')}</button>
        <button class="btn small ghost" data-act="help">${icon('info')}</button>
        <button class="btn small ghost" data-act="settings">${icon('gear')}</button>
        <button class="btn small ghost" data-act="title">${t('common.title')}</button>
      </div>
      <div class="screen-body"><div class="world">${cards}${finalCard}</div></div>
    </div>`);
    root.appendChild(node);
    node.querySelectorAll<HTMLElement>('[data-thumb]').forEach((slot) => {
      const k = slot.dataset.thumb!;
      const isFinal = k === 'final';
      const theme = isFinal ? 'caldera' : c.islands[Number(k)].id;
      const board = islandBoard(theme, (c.seed + (isFinal ? 99 : Number(k)) * 7919) >>> 0);
      const { canvas } = renderThumb(board, isFinal ? 260 : 220, isFinal ? 160 : 150, sq.palette);
      slot.appendChild(canvas);
    });
    bind(
      node,
      {
        island: (b) => this.app.openIsland(Number(b.dataset.i)),
        final: async () => {
          const ok = await this.app.confirm(t('world.finalQ'), t('world.finalBody'), t('world.finalOk'), true);
          if (ok) this.app.openFinal();
        },
        locked: () => this.app.toast(tn('world.finalToast', FINAL_UNLOCK)),
        hangar: () => openHangar(this.app, () => this.app.showWorld()),
        save: () => openSaves(this.app, 'save'),
        load: () => openSaves(this.app, 'load'),
        help: () => openHelp(this.app),
        settings: () => openSettings(this.app),
        title: async () => {
          const ok = await this.app.confirm(t('common.returnQ'), t('world.returnBody'), t('common.returnOk'));
          if (ok) this.app.abandonToTitle();
        },
      },
      () => this.app.sound.play('click'),
    );
  }

  frame(dt: number): void {
    void dt;
  }
}
