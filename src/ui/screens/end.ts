import type { App, Screen } from '../app';
import { SQUADS } from '../../game/data/squads';
import { listSlots } from '../../game/campaign/save';
import { bind, el } from '../dom';
import { esc, portraitCanvas, skillLine } from '../common';
import { icon } from '../icons';
import { openSaves } from '../modals/saves';
import { fmtTime, t } from '../../i18n';
import { difficultyName, pilotName, squadName, unitName } from '../../i18n/names';

/** Shown after the final victory or when the timeline is lost. */
export class EndScreen implements Screen {
  constructor(private app: App, private won: boolean) {}

  mount(root: HTMLElement): void {
    const c = this.app.campaign!;
    const sq = SQUADS[c.squad];
    const hasSaves = listSlots().some((r) => r.status === 'ok');
    const pilots = c.mechs
      .map((m, i) => `<div class="panel" style="padding:10px 14px;display:flex;gap:10px;align-items:center;text-align:left;min-width:250px"><div data-p="${i}"></div><div><b>${esc(pilotName(m.pilot))}</b> <span class="dim">· ${esc(unitName(m.chassis))}</span><div style="font-size:12px">${skillLine(m.pilot)}</div></div></div>`)
      .join('');
    const node = el(`<div class="screen end-screen"><div class="bg-grid"></div>
      <div class="label">${esc(t('common.squadNamed', { name: squadName(c.squad) }))} · ${esc(difficultyName(c.difficulty))}</div>
      <div class="big-title ${this.won ? 'amber' : 'red'}">${t(this.won ? 'end.saved' : 'end.lost')}</div>
      <div style="max-width:620px;color:#c9d3df;line-height:1.5">${
        this.won
          ? t('end.wonText')
          : c.grid <= 0
            ? t('end.lostGrid')
            : t('end.lostMechs')
      }</div>
      <div class="stats-row">
        <div class="stat"><b>${c.secured}</b><span class="label">${t('end.islands')}</span></div>
        <div class="stat"><b>${c.stats.missions}</b><span class="label">${t('end.battles')}</span></div>
        <div class="stat"><b>${c.stats.kills}</b><span class="label">${t('end.kills')}</span></div>
        <div class="stat"><b>${c.stats.buildingsLost}</b><span class="label">${t('end.gridLost')}</span></div>
        <div class="stat"><b>${c.stats.bonusDone}/${c.stats.bonusTotal}</b><span class="label">${t('end.bonus')}</span></div>
        <div class="stat"><b>${fmtTime(c.playMs)}</b><span class="label">${t('end.time')}</span></div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">${pilots}</div>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:10px">
        ${!this.won ? `<button class="btn big cyan" data-act="load" ${hasSaves ? '' : 'disabled'}>${icon('load')}${t('end.load')}</button>` : ''}
        <button class="btn big" data-act="new">${icon('bolt')}${t('title.new')}</button>
        <button class="btn big ghost" data-act="title">${t('end.title')}</button>
      </div>
      ${!this.won && !hasSaves ? `<div class="dim" style="font-size:12px">${t('end.tip')}</div>` : ''}
    </div>`);
    root.appendChild(node);
    node.querySelectorAll<HTMLElement>('[data-p]').forEach((slot) => slot.appendChild(portraitCanvas(c.mechs[Number(slot.dataset.p)].pilot, 44, sq.palette.main)));
    bind(node, {
      load: () => openSaves(this.app, 'load'),
      new: () => this.app.showSquadSelect(),
      title: () => this.app.showTitle(),
    }, () => this.app.sound.play('click'));
    this.app.sound.music('menu');
  }
}
