import type { App, Screen } from '../app';
import { SQUADS } from '../../game/data/squads';
import { UNITS } from '../../game/data/units';
import { DIFFICULTY } from '../../game/campaign/campaign';
import { listSlots } from '../../game/campaign/save';
import { bind, el } from '../dom';
import { esc, fmtTime, portraitCanvas, skillLine } from '../common';
import { icon } from '../icons';
import { openSaves } from '../modals/saves';

/** Shown after the final victory or when the timeline is lost. */
export class EndScreen implements Screen {
  constructor(private app: App, private won: boolean) {}

  mount(root: HTMLElement): void {
    const c = this.app.campaign!;
    const sq = SQUADS[c.squad];
    const hasSaves = listSlots().some((r) => r.status === 'ok');
    const pilots = c.mechs
      .map((m, i) => `<div class="panel" style="padding:10px 14px;display:flex;gap:10px;align-items:center;text-align:left;min-width:250px"><div data-p="${i}"></div><div><b>${esc(m.pilot.name)}</b> <span class="dim">· ${esc(UNITS[m.chassis].name)}</span><div style="font-size:12px">${skillLine(m.pilot)}</div></div></div>`)
      .join('');
    const node = el(`<div class="screen end-screen"><div class="bg-grid"></div>
      <div class="label">${esc(sq.name)} squad · ${DIFFICULTY[c.difficulty].label}</div>
      <div class="big-title ${this.won ? 'amber' : 'red'}">${this.won ? 'TIMELINE SAVED' : 'TIMELINE LOST'}</div>
      <div style="max-width:620px;color:#c9d3df;line-height:1.5">${
        this.won
          ? 'The Breach Bomb tears through the Hive Caldera. The Vek tunnels collapse and, for the first time in a century, the islands fall quiet. Your pilots step out of their mechs into a future that will now exist.'
          : c.grid <= 0
            ? 'The power grid collapses. Cities go dark and the Vek pour through. Your pilots slip back through the breach to try again in another timeline.'
            : 'Your squad has fallen. Without its mechs the grid cannot hold. The surviving pilots escape through the breach.'
      }</div>
      <div class="stats-row">
        <div class="stat"><b>${c.secured}</b><span class="label">Islands secured</span></div>
        <div class="stat"><b>${c.stats.missions}</b><span class="label">Battles won</span></div>
        <div class="stat"><b>${c.stats.kills}</b><span class="label">Vek destroyed</span></div>
        <div class="stat"><b>${c.stats.buildingsLost}</b><span class="label">Grid power lost</span></div>
        <div class="stat"><b>${c.stats.bonusDone}/${c.stats.bonusTotal}</b><span class="label">Bonus objectives</span></div>
        <div class="stat"><b>${fmtTime(c.playMs)}</b><span class="label">Time</span></div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">${pilots}</div>
      <div style="display:flex;gap:12px;margin-top:10px">
        ${!this.won ? `<button class="btn big cyan" data-act="load" ${hasSaves ? '' : 'disabled'}>${icon('load')}Load a save</button>` : ''}
        <button class="btn big" data-act="new">${icon('bolt')}New campaign</button>
        <button class="btn big ghost" data-act="title">Title screen</button>
      </div>
      ${!this.won && !hasSaves ? '<div class="dim" style="font-size:12px">Tip: save between islands from the world map to keep a checkpoint.</div>' : ''}
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
