import type { App, ModalHandle } from '../app';
import { deleteSlot, listSlots, loadSlot, readResume, storageAvailable, writeSlot, type SlotRead } from '../../game/campaign/save';
import { esc, gridBar } from '../common';
import { icon } from '../icons';
import { fmtDate, fmtTime, msg, t, tn } from '../../i18n';
import { difficultyName, squadName } from '../../i18n/names';

function slotInfo(r: SlotRead): string {
  if (r.status === 'empty') return `<div class="h3 dim">${t('saves.empty')}</div>`;
  if (r.status === 'corrupt') return `<div class="h3 red">${t('saves.unreadable')}</div><div class="dim">${esc(msg(r.reason))}</div>`;
  const m = r.data.meta;
  const squad = squadName(m.squad);
  return `<div class="h3">${esc(m.label || t('saves.defaultName', { squad }))}</div>
    <div class="dim" style="margin-top:2px">${fmtDate(m.savedAt)} · ${esc(t('common.squadNamed', { name: squad }))} · ${esc(difficultyName(m.difficulty))} · ${t('saves.played', { time: fmtTime(m.playMs) })}</div>
    <div style="display:flex;gap:14px;align-items:center;margin-top:5px;flex-wrap:wrap">
      <span>${gridBar(m.grid, m.gridMax)}</span>
      <span class="chip">${tn('common.islandsSecured', m.secured)}</span>
      <span class="chip rep">${icon('star')}${m.rep}</span>
      <span class="chip core">${icon('core')}${m.cores}</span>
      <span class="dim">${m.pilots.map((p) => esc(p === 'Autopilot' ? t('pilot.autopilot') : p)).join(', ')}</span>
    </div>`;
}

/** Save/load slots. Saving is offered between islands; loading from the title, world map and defeat screens. */
export function openSaves(app: App, mode: 'save' | 'load'): void {
  let h: ModalHandle | null = null;
  const c = app.campaign;
  const defaultLabel = c ? `${squadName(c.squad)} — ${tn('common.islandsSecured', c.secured)}` : '';

  const render = (): string => {
    const slots = listSlots();
    const rows = slots
      .map((r, i) => {
        const filled = r.status !== 'empty';
        const btns: string[] = [];
        if (mode === 'save') btns.push(`<button class="btn small" data-act="save" data-i="${i}">${icon('save')}${t(filled ? 'saves.overwrite' : 'saves.saveHere')}</button>`);
        if (mode === 'load') btns.push(`<button class="btn small cyan" data-act="load" data-i="${i}" ${r.status === 'ok' ? '' : 'disabled'}>${icon('load')}${t('saves.load')}</button>`);
        if (filled) btns.push(`<button class="btn small danger" data-act="del" data-i="${i}" title="${esc(t('saves.deleteTitle'))}">${icon('cross')}</button>`);
        return `<div class="slot-row ${filled ? '' : 'empty'}"><div class="num">${i + 1}</div><div class="info">${slotInfo(r)}</div><div class="btns">${btns.join('')}</div></div>`;
      })
      .join('');
    const warn = storageAvailable() ? '' : `<p class="red">${t('saves.noStorage')}</p>`;
    return `<div class="h2">${t(mode === 'save' ? 'saves.saveTitle' : 'saves.loadTitle')}</div>
      <p class="dim" style="margin:6px 0 14px">${t(mode === 'save' ? 'saves.saveHint' : 'saves.loadHint')}</p>
      ${warn}
      ${mode === 'save' ? `<div style="margin-bottom:12px"><div class="label" style="margin-bottom:4px">${t('saves.name')}</div><input class="text" id="save-label" maxlength="48" value="${esc(defaultLabel)}"></div>` : ''}
      <div class="slots">${rows}</div>
      <div class="actions"><button class="btn ghost" data-act="close">${t('common.close')}</button></div>`;
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
      const ok = await app.confirm(t('saves.overwriteQ'), t('saves.overwriteBody', { n: i + 1 }), t('saves.overwrite'), true);
      if (!ok) return;
    }
    const label = ((h?.el.querySelector('#save-label') as HTMLInputElement | null)?.value || defaultLabel).trim();
    const err = writeSlot(i, c, label);
    if (err) {
      app.toast(msg(err), true);
      app.sound.play('denied');
      return;
    }
    app.sound.play('save');
    app.toast(t('saves.saved', { n: i + 1 }));
    refresh();
  };

  const doLoad = async (i: number): Promise<void> => {
    const camp = loadSlot(i);
    if (!camp) {
      app.toast(t('saves.readFail'), true);
      return;
    }
    const active = app.campaign ? app.campaign.phase !== 'defeat' && app.campaign.phase !== 'victory' : !!readResume();
    if (active) {
      const ok = await app.confirm(t('saves.loadQ'), t('saves.loadBody'), t('saves.load'));
      if (!ok) return;
    }
    h?.close();
    app.sound.play('save');
    app.loadCampaign(camp);
    app.toast(t('saves.loaded', { n: i + 1 }));
  };

  const doDelete = async (i: number): Promise<void> => {
    const ok = await app.confirm(t('saves.deleteQ'), t('saves.deleteBody', { n: i + 1 }), t('saves.delete'), true);
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
