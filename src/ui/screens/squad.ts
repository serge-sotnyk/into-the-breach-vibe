import type { App, Screen } from '../app';
import type { Difficulty } from '../../game/types';
import { SQUADS } from '../../game/data/squads';
import { UNITS } from '../../game/data/units';
import { WEAPONS } from '../../game/data/weapons';
import { DIFFICULTY } from '../../game/campaign/campaign';
import { bind, el } from '../dom';
import { esc, spriteCanvas, weaponStats } from '../common';
import { icon } from '../icons';

export class SquadScreen implements Screen {
  private squad = 'ironclad';
  private diff: Difficulty = 'normal';
  private root!: HTMLElement;

  constructor(private app: App) {}

  mount(root: HTMLElement): void {
    this.root = root;
    this.render();
  }

  private render(): void {
    const cards = Object.values(SQUADS)
      .map(
        (sq) => `<div class="panel squad-card ${sq.id === this.squad ? 'sel' : ''}" data-act="squad" data-id="${sq.id}">
          <div style="display:flex;justify-content:space-between;align-items:baseline"><div class="h2">${esc(sq.name)}</div><span class="chip">${esc(sq.difficulty)}</span></div>
          <div class="amber" style="letter-spacing:.14em;font-weight:700;font-size:13px">${esc(sq.tagline)}</div>
          <div class="mechrow">${sq.mechs.map((m, i) => `<div data-c="${sq.id}-${i}"></div>`).join('')}</div>
          <p style="font-size:13px;line-height:1.4;color:#c9d3df;min-height:54px">${esc(sq.desc)}</p>
          ${sq.mechs
            .map((m) => {
              const d = UNITS[m.chassis];
              return `<div style="margin-top:8px"><div style="font-weight:700;font-size:13px">${esc(d.name)} <span class="dim" style="font-weight:400">· HP ${d.hp} · Move ${d.move}${d.flying ? ' · Flying' : ''}${d.armored ? ' · Armored' : ''}${d.fireImmune ? ' · Fire immune' : ''}</span></div>
                ${m.weapons.map((wid) => `<div class="weap" title="${esc(WEAPONS[wid].desc)}"><span class="amber">${icon(WEAPONS[wid].icon)}</span>${esc(WEAPONS[wid].name)} <span class="dim">— ${weaponStats(WEAPONS[wid])}</span></div>`).join('')}</div>`;
            })
            .join('')}
        </div>`,
      )
      .join('');
    const diffs = (Object.keys(DIFFICULTY) as Difficulty[])
      .map((k) => {
        const d = DIFFICULTY[k];
        return `<div class="panel cyan diff-opt ${k === this.diff ? 'sel' : ''}" data-act="diff" data-id="${k}"><div class="h3">${d.label}</div><div class="dim" style="font-size:12px;margin-top:3px">${d.desc}</div><div style="font-size:12px;margin-top:4px">Grid ${d.grid}/${d.gridMax} · Defense ${d.gridDef}%</div></div>`;
      })
      .join('');
    this.root.innerHTML = '';
    const node = el(`<div class="screen"><div class="bg-grid"></div>
      <div class="topbar"><button class="btn ghost small" data-act="back">${icon('undo')}Back</button><div class="h2">Choose your squad</div><div class="grow"></div></div>
      <div class="screen-body">
        <div class="squads">${cards}</div>
        <div class="difficulty">${diffs}</div>
        <div style="text-align:center;margin-top:18px"><button class="btn big" data-act="start">${icon('bolt')}Begin Campaign</button></div>
      </div></div>`);
    this.root.appendChild(node);
    node.querySelectorAll<HTMLElement>('[data-c]').forEach((slot) => {
      const [id, i] = slot.dataset.c!.split('-');
      const sq = SQUADS[id];
      slot.appendChild(spriteCanvas(sq.mechs[Number(i)].chassis, sq.palette, 96));
    });
    bind(
      node,
      {
        squad: (b) => {
          this.squad = b.dataset.id!;
          this.render();
        },
        diff: (b) => {
          this.diff = b.dataset.id as Difficulty;
          this.render();
        },
        back: () => this.app.showTitle(),
        start: () => this.app.startCampaign(this.squad, this.diff),
      },
      () => this.app.sound.play('click'),
    );
  }

  key(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.app.showTitle();
  }
}
