import type { App, ModalHandle } from '../app';
import { icon } from '../icons';

export function openSettings(app: App): void {
  const s = { ...app.settings };
  let h: ModalHandle | null = null;
  const render = (): string => `
    <div class="h2">Settings</div>
    <div class="range-row"><span class="label">Sound effects</span><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-k="sfx"><span>${Math.round(s.sfx * 100)}%</span></div>
    <div class="range-row"><span class="label">Music</span><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-k="music"><span>${Math.round(s.music * 100)}%</span></div>
    <label class="check-row"><input type="checkbox" data-k="fast" ${s.fast ? 'checked' : ''}> Fast animations</label>
    <label class="check-row"><input type="checkbox" data-k="orderAlways" ${s.orderAlways ? 'checked' : ''}> Always show Vek attack order numbers</label>
    <div class="actions"><button class="btn" data-act="close">Done</button></div>`;
  h = app.modal(render(), { handlers: { close: () => h?.close() } });
  h.el.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    const k = t.dataset.k as keyof typeof s | undefined;
    if (!k) return;
    if (t.type === 'range') {
      (s as Record<string, number | boolean>)[k] = Number(t.value);
      (t.nextElementSibling as HTMLElement).textContent = `${Math.round(Number(t.value) * 100)}%`;
    } else (s as Record<string, number | boolean>)[k] = t.checked;
    app.applySettings({ ...s });
    if (k === 'sfx') app.sound.play('select');
  });
}

export function openHelp(app: App): void {
  let h: ModalHandle | null = null;
  h = app.modal(
    `<div class="help">
      <div class="h2">How to Play</div>
      <p>The Vek are surfacing across the islands. Command three mechs to protect the civilian <b class="amber">power grid</b>. If grid power drops to zero — or all three mechs are destroyed — the timeline is lost.</p>
      <h3>The turn</h3>
      <p>Each round the Vek move first and <b class="red">telegraph</b> exactly what they will attack (red tiles, arrows and damage numbers). Then you act: every mech may <b>move</b> once and then <b>use one weapon</b> (or repair). When you end your turn, the Vek attacks resolve in the numbered order shown. Survive the listed number of turns to win the battle.</p>
      <h3>Reading the board</h3>
      <div class="cols">
        <p>${icon('target')} <b>Red striped tiles</b> will be hit. Numbers show damage, white arrows show pushes.</p>
        <p>${icon('bolt')} A <b class="amber">!</b> warning over a building means the grid is about to lose power.</p>
        <p>${icon('burst')} <b>Glowing cracks</b> mark where new Vek emerge. Stand on them to block the spawn (1 damage).</p>
        <p>${icon('info')} Hover any tile or unit for details. Hover an enemy to isolate its attack.</p>
      </div>
      <h3>Pushing is everything</h3>
      <p>Vek attacks are aimed relative to the Vek. <b>Push a Vek and its attack moves with it</b> — turn a building strike into empty air or into another Vek. Units pushed into an obstacle or another unit take <b>1 bump damage</b> (as does the obstacle — careful near buildings!). Ground Vek pushed into <b>water</b> drown; anything pushed into a <b>chasm</b> falls.</p>
      <h3>Status effects</h3>
      <div class="cols">
        <p>${icon('flame')} <b>Fire</b>: 1 damage at the start of every enemy turn. Repair or water removes it.</p>
        <p>${icon('smoke')} <b>Smoke</b>: units inside cannot attack or repair. Smoke a Vek to cancel its attack.</p>
        <p>${icon('drop')} <b>A.C.I.D.</b>: doubles weapon damage taken (ignores armor).</p>
        <p>${icon('snow')} <b>Frozen</b>: cannot act, but the ice absorbs the next hit.</p>
        <p>${icon('shield')} <b>Shield</b>: blocks the next instance of damage or negative effect.</p>
        <p>${icon('web')} <b>Webbed</b>: cannot move until the webbing Vek dies or is pushed away.</p>
      </div>
      <h3>Campaign</h3>
      <p>Pick an island, defend three regions, then defeat the island's Hive leader to secure it. Bonus objectives earn <b class="amber">reputation</b> ${icon('star')} (spent in the shop after each island), <b class="amber">grid power</b> ${icon('bolt')} and <b class="cyan">reactor cores</b> ${icon('core')} (power weapons and upgrades in the Hangar). Pilots gain experience and level up — but die with their mech. Secure two islands to unlock the final assault on the Hive Caldera.</p>
      <p><b>Saving:</b> manual saves (6 slots) are available on the world map between islands and persist after defeat. Your current run also auto-saves so you can <b>Continue</b> after closing the browser.</p>
      <h3>Controls</h3>
      <div class="cols">
        <p><kbd>Click</kbd> select / move / fire &nbsp; <kbd>Right-click</kbd> / <kbd>Esc</kbd> cancel</p>
        <p><kbd>1</kbd> <kbd>2</kbd> weapons &nbsp; <kbd>R</kbd> repair &nbsp; <kbd>Tab</kbd> next mech</p>
        <p><kbd>Z</kbd> undo move &nbsp; <kbd>Space</kbd> end turn</p>
        <p><kbd>A</kbd> toggle attack order &nbsp; <kbd>F</kbd> skip animations</p>
      </div>
    </div>
    <div class="actions"><button class="btn" data-act="close">Got it</button></div>`,
    { handlers: { close: () => h?.close() } },
  );
}
