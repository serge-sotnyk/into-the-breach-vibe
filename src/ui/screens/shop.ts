import type { App, Screen } from '../app';
import { WEAPONS } from '../../game/data/weapons';
import { POWER_PRICE, buyItem, buyPower, islandDef } from '../../game/campaign/campaign';
import { bind, el } from '../dom';
import { esc, gridBar, weaponStats } from '../common';
import { icon } from '../icons';
import { campaignStats } from './world';
import { openHangar } from '../modals/hangar';

export class ShopScreen implements Screen {
  inGame = true;
  private root!: HTMLElement;

  constructor(private app: App) {}

  mount(root: HTMLElement): void {
    this.root = root;
    this.render();
  }

  private render(): void {
    const c = this.app.campaign!;
    const isl = c.islands[c.current];
    const def = isl ? islandDef(isl.id) : null;
    const items = c.shop
      .map((it, i) => {
        const afford = c.rep >= it.price && !it.sold;
        const buy = `<button class="btn small" data-act="buy" data-i="${i}" ${afford ? '' : 'disabled'}>${it.sold ? 'Sold' : `${icon('star')} ${it.price}`}</button>`;
        if (it.kind === 'weapon') {
          const w = WEAPONS[it.id];
          return `<div class="panel shop-item ${it.sold ? 'sold' : ''}">
            <div style="display:flex;gap:10px;align-items:center">${icon(w.icon, 'big')}<div><div class="h3">${esc(w.name)}</div><div class="dim" style="font-size:12px">${weaponStats(w)}</div></div></div>
            <div style="font-size:13px;line-height:1.4;color:#c9d3df;flex:1">${esc(w.desc)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">${w.power ? `<span class="chip core" title="Reactor cores needed to equip">${icon('core')}${w.power} to power</span>` : '<span class="chip">No power needed</span>'}${buy}</div></div>`;
        }
        if (it.kind === 'core')
          return `<div class="panel cyan shop-item ${it.sold ? 'sold' : ''}"><div style="display:flex;gap:10px;align-items:center"><span class="cyan">${icon('core', 'big')}</span><div class="h3">Reactor Core</div></div>
            <div style="font-size:13px;color:#c9d3df;flex:1">Powers weapons and weapon upgrades. Assign it in the Hangar.</div><div style="text-align:right">${buy}</div></div>`;
        return `<div class="panel shop-item ${it.sold ? 'sold' : ''}"><div style="display:flex;gap:10px;align-items:center">${icon('shield', 'big')}<div class="h3">Grid Defense +5%</div></div>
          <div style="font-size:13px;color:#c9d3df;flex:1">Buildings get a better chance to shrug off damage. Currently ${c.gridDef}%.</div><div style="text-align:right">${buy}</div></div>`;
      })
      .join('');
    const canPower = c.grid < c.gridMax && c.rep >= POWER_PRICE;
    const power = `<div class="panel shop-item"><div style="display:flex;gap:10px;align-items:center">${icon('bolt', 'big')}<div class="h3">Grid Power +1</div></div>
      <div style="font-size:13px;color:#c9d3df;flex:1">Restore a bar of grid power. Can be bought repeatedly.<div style="margin-top:8px">${gridBar(c.grid, c.gridMax)}</div></div>
      <div style="text-align:right"><button class="btn small" data-act="power" ${canPower ? '' : 'disabled'}>${c.grid >= c.gridMax ? 'Grid full' : `${icon('star')} ${POWER_PRICE}`}</button></div></div>`;
    this.root.innerHTML = '';
    const node = el(`<div class="screen"><div class="bg-grid"></div>
      <div class="topbar">
        <div><div class="h2 green">${def ? `${esc(def.name)} secured` : 'Armory'}</div><div class="label">${def ? `${esc(def.corp)} opens its armory to you` : ''}</div></div>
        <div class="grow"></div>${campaignStats(c)}
      </div>
      <div class="screen-body">
        <div style="max-width:1180px;margin:0 auto 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <div class="h3">Spend reputation</div><span class="chip rep" style="font-size:16px">${icon('star')} ${c.rep} available</span>
          <div class="grow" style="flex:1"></div>
          <button class="btn" data-act="hangar">${icon('wrench')}Hangar</button>
          <button class="btn big green" data-act="leave">Continue ${icon('end')}</button>
        </div>
        <div class="shop-grid">${power}${items}</div>
      </div></div>`);
    this.root.appendChild(node);
    bind(node, {
      buy: (b) => {
        if (buyItem(c, Number(b.dataset.i))) {
          this.app.sound.play('buy');
          this.app.saveResume();
          this.render();
        }
      },
      power: () => {
        if (buyPower(c)) {
          this.app.sound.play('buy');
          this.app.saveResume();
          this.render();
        }
      },
      hangar: () => openHangar(this.app, () => this.render()),
      leave: () => this.app.leaveShop(),
    }, () => this.app.sound.play('click'));
  }
}
