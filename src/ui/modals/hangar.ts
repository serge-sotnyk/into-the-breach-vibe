import type { App, ModalHandle } from '../app';
import type { MechCfg } from '../../game/types';
import { UNITS } from '../../game/data/units';
import { WEAPONS } from '../../game/data/weapons';
import { SQUADS } from '../../game/data/squads';
import { LEVEL_PERKS, LEVEL_XP } from '../../game/data/pilots';
import { equipWeapon, freeCores, swapPilot, toggleUpgrade, unequipWeapon, weaponCost } from '../../game/campaign/campaign';
import { resolveWeapon } from '../../game/battle/attacks';
import { esc, portraitCanvas, skillLine, spriteCanvas, weaponStats } from '../common';
import { icon } from '../icons';

export function mechNumbers(m: MechCfg): { hp: number; move: number; traits: string[] } {
  const d = UNITS[m.chassis];
  let hp = d.hp;
  let move = d.move;
  const traits: string[] = [];
  const p = m.pilot;
  if (p.level >= 1) hp += 2;
  if (p.level >= 2) move += 1;
  if (!p.ai && p.skill === 'tough') hp += 2;
  if (!p.ai && p.skill === 'swift') move += 1;
  if (d.flying || (!p.ai && p.skill === 'flying')) traits.push('Flying');
  if (d.armored || (!p.ai && p.skill === 'armored')) traits.push('Armored');
  if (d.fireImmune || (!p.ai && p.skill === 'fireproof')) traits.push('Fire immune');
  if (d.massive) traits.push('Massive');
  return { hp, move, traits };
}

export function openHangar(app: App, onClose?: () => void): void {
  const c = app.campaign!;
  const pal = SQUADS[c.squad].palette;
  let picking: { mech: number; slot: number } | null = null;
  let h: ModalHandle | null = null;

  const coreDots = (): string => {
    const free = freeCores(c);
    let s = '';
    for (let i = 0; i < c.cores; i++) s += `<span style="color:${i < c.cores - free ? '#4a6b7a' : 'var(--cyan)'}">${icon('core')}</span>`;
    return s || '<span class="dim">none</span>';
  };

  const weaponBox = (mi: number, si: number): string => {
    const m = c.mechs[mi];
    const w = m.weapons[si];
    if (picking && picking.mech === mi && picking.slot === si) {
      const free = freeCores(c) + (w ? weaponCost(w.id, w.up) : 0);
      const items = c.inventory
        .map((id, k) => {
          const d = WEAPONS[id];
          const ok = d.power <= free;
          return `<button class="btn small ${ok ? 'cyan' : 'ghost'}" style="justify-content:flex-start" data-act="equip" data-m="${mi}" data-s="${si}" data-k="${k}" ${ok ? '' : 'disabled'} title="${esc(d.desc)}">${icon(d.icon)}${esc(d.name)} ${d.power ? `<span class="cyan">${icon('core')}${d.power}</span>` : ''}</button>`;
        })
        .join('');
      return `<div class="slot"><div class="label">Equip from armory</div>${items || '<div class="dim">Your armory is empty. Buy weapons in shops or find them in time pods.</div>'}
        <button class="btn small ghost" data-act="cancelpick">Cancel</button></div>`;
    }
    if (!w) {
      return `<div class="slot"><div class="dim" style="font-size:13px">Empty weapon slot</div>
        <button class="btn small" data-act="pick" data-m="${mi}" data-s="${si}" ${c.inventory.length ? '' : 'disabled'}>Equip weapon</button></div>`;
    }
    const d = WEAPONS[w.id];
    const rw = resolveWeapon({ id: w.id, up: w.up, uses: -1 });
    const ups = d.up
      .map(
        (u, k) => `<div class="upg ${w.up[k] ? 'on' : ''}" data-act="upg" data-m="${mi}" data-s="${si}" data-u="${k}" title="${esc(u.desc)}">
          <span class="box"></span><span style="flex:1">${esc(u.name)}</span><span class="cyan">${icon('core')}${u.cost}</span></div>`,
      )
      .join('');
    return `<div class="slot filled">
      <div class="whead">${icon(d.icon)}<div style="flex:1"><div class="h3" style="font-size:14px">${esc(d.name)}</div><div class="dim" style="font-size:11px">${weaponStats(rw)}</div></div>
        ${d.power ? `<span class="chip core" title="Reactor cores needed to power this weapon">${icon('core')}${d.power}</span>` : ''}</div>
      <div style="font-size:12px;color:#c9d3df;line-height:1.35">${esc(d.desc)}</div>
      ${ups}
      <div style="display:flex;gap:6px">
        <button class="btn small ghost" data-act="pick" data-m="${mi}" data-s="${si}" ${c.inventory.length ? '' : 'disabled'}>Swap</button>
        <button class="btn small ghost" data-act="unequip" data-m="${mi}" data-s="${si}">Unequip</button>
      </div></div>`;
  };

  const render = (): string => {
    const cols = c.mechs
      .map((m, mi) => {
        const d = UNITS[m.chassis];
        const n = mechNumbers(m);
        const p = m.pilot;
        const nextXp = p.level < 2 ? LEVEL_XP[p.level] : 0;
        const prevXp = p.level === 0 ? 0 : LEVEL_XP[p.level - 1];
        const pct = p.level >= 2 ? 100 : Math.round(((p.xp - prevXp) / (nextXp - prevXp)) * 100);
        return `<div class="mech-col panel">
          <div data-mech-canvas="${mi}" style="align-self:center"></div>
          <div><div class="h3">${esc(d.name)} <span class="dim" style="font-size:12px">${d.cls ?? ''}</span></div>
            <div style="display:flex;gap:12px;margin-top:4px;font-size:13px">
              <span>${icon('heart')} HP <b>${n.hp}</b></span><span>${icon('move')} Move <b>${n.move}</b></span>
            </div>
            <div class="dim" style="font-size:12px;margin-top:3px">${n.traits.join(' · ')}</div></div>
          <div class="pilot-box"><div data-pilot-canvas="${mi}"></div>
            <div><div><b>${esc(p.name)}</b> ${p.ai ? '' : `<span class="chip">LV ${p.level}</span>`}</div>
              <div style="font-size:12px;line-height:1.3;margin-top:2px">${skillLine(p)}</div>
              ${p.ai ? '' : `<div class="xpbar" style="margin-top:5px" title="${p.level >= 2 ? 'Max level' : `${p.xp}/${nextXp} XP — next: ${LEVEL_PERKS[p.level]}`}"><b style="width:${pct}%"></b></div>`}
            </div></div>
          ${weaponBox(mi, 0)}
          ${weaponBox(mi, 1)}
        </div>`;
      })
      .join('');
    const inv = c.inventory.length
      ? c.inventory
          .map((id) => {
            const d = WEAPONS[id];
            return `<div class="inv-item"><div style="display:flex;gap:6px;align-items:center"><span class="amber">${icon(d.icon)}</span><b>${esc(d.name)}</b>${d.power ? `<span class="chip core">${icon('core')}${d.power}</span>` : ''}</div><div class="dim" style="margin-top:3px">${esc(d.desc)}</div></div>`;
          })
          .join('')
      : '<div class="dim">No spare weapons. Shops open after you secure an island.</div>';
    const reserve = c.reserve.length
      ? c.reserve
          .map(
            (p, k) => `<div class="inv-item"><b>${esc(p.name)}</b> <span class="chip">LV ${p.level}</span><div style="margin:3px 0 6px">${skillLine(p)}</div>
            ${c.mechs.map((m, mi) => `<button class="btn small ghost" data-act="assign" data-p="${k}" data-m="${mi}">Pilot ${esc(UNITS[m.chassis].name)}</button>`).join(' ')}</div>`,
          )
          .join('')
      : '';
    return `<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:14px">
        <div class="h2">Hangar</div><div class="grow" style="flex:1"></div>
        <div class="label">Reactor cores</div><div style="display:flex;gap:2px;font-size:18px">${coreDots()}</div>
        <div class="chip core">${freeCores(c)} free</div>
      </div>
      <p class="dim" style="margin:-6px 0 14px;font-size:13px">Reactor cores power weapons and upgrades. They can be freely reassigned here at any time between missions.</p>
      <div class="hangar">${cols}</div>
      <div class="label" style="margin:18px 0 8px">Armory</div><div class="inv-list">${inv}</div>
      ${reserve ? `<div class="label" style="margin:18px 0 8px">Reserve pilots</div><div class="inv-list">${reserve}</div>` : ''}
      <div class="actions"><button class="btn big" data-act="close">Done</button></div>`;
  };

  const paint = (): void => {
    if (!h) return;
    h.el.innerHTML = render();
    h.el.querySelectorAll<HTMLElement>('[data-mech-canvas]').forEach((slot) => {
      const mi = Number(slot.dataset.mechCanvas);
      const cv = spriteCanvas(c.mechs[mi].chassis, pal, 110);
      cv.className = 'mech';
      slot.appendChild(cv);
    });
    h.el.querySelectorAll<HTMLElement>('[data-pilot-canvas]').forEach((slot) => {
      const mi = Number(slot.dataset.pilotCanvas);
      slot.appendChild(portraitCanvas(c.mechs[mi].pilot, 48, pal.main));
    });
  };

  const report = (err: string): void => {
    if (err) {
      app.toast(err, true);
      app.sound.play('denied');
    } else app.sound.play('select');
    app.saveResume();
    paint();
  };

  h = app.modal('<div></div>', {
    cls: 'hangar-modal',
    onClose: () => onClose?.(),
    handlers: {
      close: () => h?.close(),
      pick: (b) => {
        picking = { mech: Number(b.dataset.m), slot: Number(b.dataset.s) };
        paint();
      },
      cancelpick: () => {
        picking = null;
        paint();
      },
      equip: (b) => {
        picking = null;
        report(equipWeapon(c, Number(b.dataset.m), Number(b.dataset.s), Number(b.dataset.k)));
      },
      unequip: (b) => report(unequipWeapon(c, Number(b.dataset.m), Number(b.dataset.s))),
      upg: (b) => report(toggleUpgrade(c, Number(b.dataset.m), Number(b.dataset.s), Number(b.dataset.u))),
      assign: (b) => {
        swapPilot(c, Number(b.dataset.m), Number(b.dataset.p));
        report('');
      },
    },
  });
  paint();
}
