import type { App, ModalHandle } from '../app';
import { SQUADS } from '../../game/data/squads';
import { DIFFICULTY } from '../../game/campaign/campaign';
import { deleteSlot, listSlots, loadSlot, storageAvailable, writeSlot, type SlotRead } from '../../game/campaign/save';
import { esc, fmtDate, fmtTime, gridBar } from '../common';
import { icon } from '../icons';

function slotInfo(r: SlotRead): string {
  if (r.status === 'empty') return '<div class="h3 dim">Empty slot</div>';
  if (r.status === 'corrupt') return `<div class="h3 red">Unreadable save</div><div class="dim">${esc(r.reason)}</div>`;
  const m = r.data.meta;
  const squad = SQUADS[m.squad]?.name ?? m.squad;
  return `<div class="h3">${esc(m.label || `${squad} campaign`)}</div>
    <div class="dim" style="margin-top:2px">${fmtDate(m.savedAt)} · ${squad} squad · ${DIFFICULTY[m.difficulty]?.label ?? m.difficulty} · played ${fmtTime(m.playMs)}</div>
    <div style="display:flex;gap:14px;align-items:center;margin-top:5px;flex-wrap:wrap">
      <span>${gridBar(m.grid, m.gridMax)}</span>
      <span class="chip">${m.secured} island${m.secured === 1 ? '' : 's'} secured</span>
      <span class="chip rep">${icon('star')}${m.rep}</span>
      <span class="chip core">${icon('core')}${m.cores}</span>
      <span class="dim">${m.pilots.map(esc).join(', ')}</span>
    </div>`;
}

/** Save/load slots. Saving is offered between islands; loading from the title, world map and defeat screens. */
export function openSaves(app: App, mode: 'save' | 'load'): void {
  let h: ModalHandle | null = null;
  const c = app.campaign;
  const defaultLabel = c ? `${SQUADS[c.squad].name} — ${c.secured} island${c.secured === 1 ? '' : 's'} secured` : '';

  const render = (): string => {
    const slots = listSlots();
    const rows = slots
      .map((r, i) => {
        const filled = r.status !== 'empty';
        const btns: string[] = [];
        if (mode === 'save') btns.push(`<button class="btn small" data-act="save" data-i="${i}">${icon('save')}${filled ? 'Overwrite' : 'Save here'}</button>`);
        if (mode === 'load') btns.push(`<button class="btn small cyan" data-act="load" data-i="${i}" ${r.status === 'ok' ? '' : 'disabled'}>${icon('load')}Load</button>`);
        if (filled) btns.push(`<button class="btn small danger" data-act="del" data-i="${i}" title="Delete this save">${icon('cross')}</button>`);
        return `<div class="slot-row ${filled ? '' : 'empty'}"><div class="num">${i + 1}</div><div class="info">${slotInfo(r)}</div><div class="btns">${btns.join('')}</div></div>`;
      })
      .join('');
    const warn = storageAvailable() ? '' : '<p class="red">Browser storage is unavailable, so saves cannot persist. Disable private browsing to save.</p>';
    return `<div class="h2">${mode === 'save' ? 'Save Campaign' : 'Load Campaign'}</div>
      <p class="dim" style="margin:6px 0 14px">${mode === 'save' ? 'Saves persist in this browser across restarts and survive a lost timeline.' : 'Saved campaigns resume on the world map between islands.'}</p>
      ${warn}
      ${mode === 'save' ? `<div style="margin-bottom:12px"><div class="label" style="margin-bottom:4px">Save name</div><input class="text" id="save-label" maxlength="48" value="${esc(defaultLabel)}"></div>` : ''}
      <div class="slots">${rows}</div>
      <div class="actions"><button class="btn ghost" data-act="close">Close</button></div>`;
  };

  const refresh = (): void => {
    if (!h) return;
    const label = (h.el.querySelector('#save-label') as HTMLInputElement | null)?.value;
    h.el.innerHTML = render();
    const input = h.el.querySelector('#save-label') as HTMLInputElement | null;
    if (input && label !== undefined) input.value = label;
  };

  const doSave = async (i: number): Promise<void> => {
    if (!c) return;
    const existing = listSlots()[i];
    if (existing.status !== 'empty') {
      const ok = await app.confirm('Overwrite save?', `Slot ${i + 1} already holds a campaign. Replace it with your current progress?`, 'Overwrite', true);
      if (!ok) return;
    }
    const label = ((h?.el.querySelector('#save-label') as HTMLInputElement | null)?.value || defaultLabel).trim();
    const err = writeSlot(i, c, label);
    if (err) {
      app.toast(err, true);
      app.sound.play('denied');
      return;
    }
    app.sound.play('save');
    app.toast(`Campaign saved to slot ${i + 1}`);
    refresh();
  };

  const doLoad = async (i: number): Promise<void> => {
    const camp = loadSlot(i);
    if (!camp) {
      app.toast('That save could not be read', true);
      return;
    }
    if (app.campaign && app.campaign.phase !== 'defeat' && app.campaign.phase !== 'victory') {
      const ok = await app.confirm('Load campaign?', 'Your current campaign progress since your last save will be lost.', 'Load');
      if (!ok) return;
    }
    h?.close();
    app.sound.play('save');
    app.loadCampaign(camp);
    app.toast(`Loaded slot ${i + 1}`);
  };

  const doDelete = async (i: number): Promise<void> => {
    const ok = await app.confirm('Delete save?', `Slot ${i + 1} will be permanently erased.`, 'Delete', true);
    if (!ok) return;
    deleteSlot(i);
    refresh();
  };

  h = app.modal(render(), {
    handlers: {
      close: () => h?.close(),
      save: (b) => void doSave(Number(b.dataset.i)),
      load: (b) => void doLoad(Number(b.dataset.i)),
      del: (b) => void doDelete(Number(b.dataset.i)),
    },
  });
}
