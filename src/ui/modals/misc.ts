import type { App, ModalHandle } from '../app';
import { FINAL_UNLOCK, REGIONS_BEFORE_BOSS } from '../../game/campaign/campaign';
import { SLOT_COUNT } from '../../game/campaign/save';
import { LANGS, isLang, t, tn, type StrKey } from '../../i18n';
import { icon } from '../icons';
import { canHover, hasTouch } from '../gestures';

/** The installed app already runs full screen; browsers that allow it get a toggle. */
function canFullscreen(): boolean {
  return document.fullscreenEnabled && !matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
}

export function openSettings(app: App): void {
  const s = { ...app.settings };
  let h: ModalHandle | null = null;
  const render = (): string => `
    <div class="h2">${t('settings.title')}</div>
    <div class="range-row"><span class="label">${t('settings.language')}</span><span class="lang-pick">${LANGS.map((l) => `<button class="btn small ${l.id === s.lang ? '' : 'ghost'}" data-act="lang" data-lang="${l.id}">${l.name}</button>`).join('')}</span></div>
    <div class="range-row"><span class="label">${t('settings.touch')}</span><span class="lang-pick">${(['tap', 'button'] as const).map((m) => `<button class="btn small ${m === s.touchConfirm ? '' : 'ghost'}" data-act="touch" data-mode="${m}">${t(m === 'tap' ? 'settings.touchTap' : 'settings.touchButton')}</button>`).join('')}</span></div>
    ${canFullscreen() ? `<div class="range-row"><span class="label">${t('settings.screen')}</span><span class="lang-pick"><button class="btn small ${document.fullscreenElement ? '' : 'ghost'}" data-act="fullscreen">${t(document.fullscreenElement ? 'settings.windowed' : 'settings.fullscreen')}</button></span></div>` : ''}
    <div class="range-row"><span class="label">${t('settings.sfx')}</span><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-k="sfx"><span>${Math.round(s.sfx * 100)}%</span></div>
    <div class="range-row"><span class="label">${t('settings.music')}</span><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-k="music"><span>${Math.round(s.music * 100)}%</span></div>
    <label class="check-row"><input type="checkbox" data-k="fast" ${s.fast ? 'checked' : ''}> ${t('settings.fast')}</label>
    <label class="check-row"><input type="checkbox" data-k="orderAlways" ${s.orderAlways ? 'checked' : ''}> ${t('settings.order')}</label>
    <div class="actions"><button class="btn" data-act="close">${t('common.done')}</button></div>`;
  h = app.modal(render(), {
    handlers: {
      close: () => h?.close(),
      lang: (b) => {
        const l = b.dataset.lang;
        if (!isLang(l) || l === s.lang) return;
        s.lang = l;
        app.setLang(l, h?.el);
        if (h) h.el.innerHTML = render();
      },
      fullscreen: () => {
        const done = (): void => {
          if (h) h.el.innerHTML = render();
        };
        (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).then(done, done);
      },
      touch: (b) => {
        s.touchConfirm = b.dataset.mode === 'button' ? 'button' : 'tap';
        app.applySettings({ ...s });
        if (h) h.el.innerHTML = render();
      },
    },
  });
  h.el.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    const k = el.dataset.k as 'sfx' | 'music' | 'fast' | 'orderAlways' | undefined;
    if (!k) return;
    if (el.type === 'range') {
      (s as Record<string, unknown>)[k] = Number(el.value);
      (el.nextElementSibling as HTMLElement).textContent = `${Math.round(Number(el.value) * 100)}%`;
    } else (s as Record<string, unknown>)[k] = el.checked;
    app.applySettings({ ...s });
    if (k === 'sfx') app.sound.play('select');
  });
}

export function openHelp(app: App): void {
  let h: ModalHandle | null = null;
  const icons = { target: icon('target'), bolt: icon('bolt'), burst: icon('burst'), info: icon('info'), star: icon('star'), core: icon('core') };
  const kbd = (...keys: string[]): string => keys.map((k) => `<kbd>${k}</kbd>`).join(' ');
  const controls: [string, StrKey][] = [
    [kbd(t('help.kbd.click')), 'help.key.click'],
    [`${kbd(t('help.kbd.rclick'))} / ${kbd('Esc')}`, 'help.key.cancel'],
    [kbd('1', '2'), 'help.key.weapons'],
    [kbd('R'), 'help.key.repair'],
    [kbd('Tab'), 'help.key.next'],
    [kbd('Z'), 'help.key.undo'],
    [kbd(t('help.kbd.space')), 'help.key.end'],
    [kbd('A'), 'help.key.order'],
    [kbd('F'), 'help.key.skip'],
  ];
  const touch: StrKey[] = ['help.touch.tap', 'help.touch.aim', 'help.touch.hold', 'help.touch.cancel', 'help.touch.skip'];
  const status: [string, StrKey][] = [
    ['flame', 'help.fire'],
    ['smoke', 'help.smoke'],
    ['drop', 'help.acid'],
    ['snow', 'help.frozen'],
    ['shield', 'help.shield'],
    ['web', 'help.web'],
  ];
  h = app.modal(
    `<div class="help">
      <div class="h2">${t('common.howToPlay')}</div>
      <p>${t('help.intro')}</p>
      <h3>${t('help.turnH')}</h3>
      <p>${t('help.turn')}</p>
      <h3>${t('help.boardH')}</h3>
      <div class="cols">
        <p>${icons.target} ${t('help.board.tiles')}</p>
        <p>${icons.bolt} ${t('help.board.grid')}</p>
        <p>${icons.burst} ${t('help.board.spawn')}</p>
        <p>${icons.info} ${t(canHover() ? 'help.board.hover' : 'help.board.touch')}</p>
      </div>
      <h3>${t('help.pushH')}</h3>
      <p>${t('help.push')}</p>
      <h3>${t('help.statusH')}</h3>
      <div class="cols">${status.map(([ic, key]) => `<p>${icon(ic)} ${t(key)}</p>`).join('')}</div>
      <h3>${t('help.campaignH')}</h3>
      <p>${t('help.campaign', { regions: tn('help.regions', REGIONS_BEFORE_BOSS), islands: tn('help.islands', FINAL_UNLOCK), star: icons.star, bolt: icons.bolt, core: icons.core })}</p>
      <p>${t('help.saving', { slots: SLOT_COUNT })}</p>
      ${hasTouch() ? `<h3>${t('help.touchH')}</h3>
      <div class="cols">${touch.map((key) => `<p>${t(key)}</p>`).join('')}</div>` : ''}
      ${canHover() ? `<h3>${t('help.controlsH')}</h3>
      <div class="cols">${controls.map(([keys, key]) => `<p>${keys} ${t(key)}</p>`).join('')}</div>` : ''}
    </div>
    <div class="actions"><button class="btn" data-act="close">${t('help.ok')}</button></div>`,
    { handlers: { close: () => h?.close() } },
  );
}
