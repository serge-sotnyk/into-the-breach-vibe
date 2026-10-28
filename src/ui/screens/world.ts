import type { App, Screen } from '../app';
import type { Campaign } from '../../game/types';
import { FINAL_ISLAND, ISLANDS } from '../../game/data/islands';
import { SQUADS } from '../../game/data/squads';
import { UNITS } from '../../game/data/units';
import { DIFFICULTY, FINAL_UNLOCK, finalUnlocked, freeCores } from '../../game/campaign/campaign';
import { renderThumb } from '../../render/renderer';
import { bind, el } from '../dom';
import { esc, fmtTime, gridBar } from '../common';
import { icon } from '../icons';
import { islandBoard } from '../thumbs';
import { openSaves } from '../modals/saves';
import { openHangar } from '../modals/hangar';
import { openHelp, openSettings } from '../modals/misc';

export function campaignStats(c: Campaign): string {
  return `<div class="statgroup" title="Power grid: lose it all and the timeline is lost">${icon('bolt')}<span class="label">Grid</span>${gridBar(c.grid, c.gridMax)}<b>${c.grid}/${c.gridMax}</b></div>
    <div class="statgroup" title="Chance that a building resists damage"><span class="label">Defense</span><b>${c.gridDef}%</b></div>
    <div class="statgroup" title="Reputation — spend in shops after securing an island"><span class="amber">${icon('star')}</span><b>${c.rep}</b></div>
    <div class="statgroup" title="Reactor cores (free / total) — assign them in the Hangar"><span class="cyan">${icon('core')}</span><b>${freeCores(c)}/${c.cores}</b></div>`;
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
          ? `<div class="status green">${icon('check')} SECURED</div>`
          : `<div class="status amber">${icon('target')} THREAT LEVEL ${c.secured + 1}</div>`;
        return `<div class="panel island-card ${isl.secured ? 'secured' : ''}" data-act="${isl.secured ? '' : 'island'}" data-i="${i}">
          <div data-thumb="${i}"></div>
          <div><div class="h2">${esc(def.name)}</div><div class="label" style="margin:2px 0 6px">${esc(def.corp)}</div>
            <div style="font-size:13px;line-height:1.4;color:#c9d3df">${esc(def.desc)}</div>
            <div style="margin-top:6px;font-size:12px" class="dim">Vek: ${def.pool.map((p) => esc(UNITS[p].name)).join(', ')} · Leader: <span class="red">${esc(UNITS[def.boss].name)}</span></div>
            ${status}</div></div>`;
      })
      .join('');
    const finalCard = `<div class="panel red island-card final-card ${unlocked ? '' : 'locked'}" data-act="${unlocked ? 'final' : 'locked'}">
        <div data-thumb="final"></div>
        <div><div class="h2 red">${esc(FINAL_ISLAND.name)}</div><div class="label" style="margin:2px 0 6px">Final assault · two-part battle</div>
          <div style="font-size:13px;line-height:1.4;color:#c9d3df">${esc(FINAL_ISLAND.desc)}</div>
          <div class="status ${unlocked ? 'red' : 'dim'}">${unlocked ? `${icon('skull')} READY — secure more islands first to grow stronger, or strike now` : `${icon('cross')} LOCKED — secure ${FINAL_UNLOCK} islands (${c.secured}/${FINAL_UNLOCK})`}</div></div></div>`;

    const node = el(`<div class="screen"><div class="bg-grid"></div>
      <div class="topbar">
        <div class="h2" style="color:var(--amber)">${esc(sq.name)}</div>
        <span class="chip">${DIFFICULTY[c.difficulty].label}</span>
        <span class="dim" style="font-size:12px">${fmtTime(c.playMs)}</span>
        <div class="grow"></div>
        ${campaignStats(c)}
      </div>
      <div class="topbar" style="background:rgba(5,8,12,.6)">
        <div class="h3">Choose an island to defend</div>
        <div class="dim" style="font-size:13px">Each island: defend 3 regions, then destroy its Hive leader.</div>
        <div class="grow"></div>
        <button class="btn small" data-act="hangar">${icon('wrench')}Hangar</button>
        <button class="btn small cyan" data-act="save">${icon('save')}Save Game</button>
        <button class="btn small ghost" data-act="load">${icon('load')}Load</button>
        <button class="btn small ghost" data-act="help">${icon('info')}</button>
        <button class="btn small ghost" data-act="settings">${icon('gear')}</button>
        <button class="btn small ghost" data-act="title">Title</button>
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
          const ok = await this.app.confirm('Begin the final assault?', 'Once you land on the Hive Caldera there is no turning back. Two battles stand between you and victory.', 'Launch assault', true);
          if (ok) this.app.openFinal();
        },
        locked: () => this.app.toast(`Secure ${FINAL_UNLOCK} islands to unlock the final assault`),
        hangar: () => openHangar(this.app, () => this.app.showWorld()),
        save: () => openSaves(this.app, 'save'),
        load: () => openSaves(this.app, 'load'),
        help: () => openHelp(this.app),
        settings: () => openSettings(this.app),
        title: async () => {
          const ok = await this.app.confirm('Return to title?', 'Your current run is auto-saved — choose Continue on the title screen to resume. Use Save Game to keep a permanent copy.', 'Return');
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
