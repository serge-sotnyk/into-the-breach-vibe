import type { App, ModalHandle } from '../app';
import type { MissionReport } from '../../game/campaign/campaign';
import { esc, gridBar, rewardChips } from '../common';
import { icon } from '../icons';
import { t, tn } from '../../i18n';
import { islandName, missionTitle, objectiveLabel, perkText, skillName, unitName } from '../../i18n/names';

export function showResults(app: App, r: MissionReport, onContinue: () => void): void {
  const c = app.campaign!;
  let h: ModalHandle | null = null;
  const title = t(r.victory ? (r.campaignWon ? 'results.hiveCollapses' : 'results.complete') : 'end.lost');
  const objectives = r.objectives
    .map(
      (o) => `<div class="obj-line ${o.success ? 'ok' : 'fail'}">${o.success ? `<span class="green">${icon('check')}</span>` : `<span class="red">${icon('cross')}</span>`}
        <span class="grow">${esc(objectiveLabel(o.objective, o.boss))}</span>${rewardChips(o.reward)}</div>`,
    )
    .join('');
  const pilots = r.pilots
    .map((p) => {
      let right = '';
      if (p.died) right = `<span class="red">${icon('skull')} ${t('results.kia')}</span>`;
      else if (p.ai) right = `<span class="dim">${t('pilot.autopilot')}</span>`;
      else right = `<span class="cyan">${t('results.xp', { n: p.xpGained })}</span>`;
      const extra: string[] = [];
      if (p.ejected) extra.push(`<span class="amber">${t('results.ejected')}</span>`);
      if (p.leveled) extra.push(`<span class="amber">${icon('star')} ${t('results.levelUp', { n: p.level })} ${esc(perkText(p.level))}</span>`);
      return `<div class="pilot-line"><span><b>${esc(p.ai ? t('pilot.autopilot') : p.name)}</b> <span class="dim">· ${esc(unitName(p.chassis))}</span></span>${right}${extra.length ? `<span style="grid-column:1/-1">${extra.join(' ')}</span>` : ''}</div>`;
    })
    .join('');
  const gained: string[] = [];
  if (r.rep) gained.push(`<span class="chip rep">${icon('star')}${tn('results.rep', r.rep)}</span>`);
  if (r.power) gained.push(`<span class="chip power">${icon('bolt')}${tn('results.power', r.power)}</span>`);
  if (r.defense) gained.push(`<span class="chip power">${t('results.defense', { n: r.defense })}</span>`);
  if (r.cores) gained.push(`<span class="chip core">${icon('core')}${tn('results.cores', r.cores)}</span>`);
  if (r.newPilot) gained.push(`<span class="chip pilot">${icon('pilot')}${esc(t('results.joins', { name: r.newPilot.name, skill: skillName(r.newPilot.skill) }))}</span>`);
  let banner = '';
  if (r.islandSecured) banner = `<div class="obj-line ok" style="font-size:16px"><span class="green">${icon('check')}</span><span class="grow"><b>${esc(t('results.secured', { name: islandName(r.islandSecured) }))}</b> ${t('results.securedBody')}</span></div>`;
  if (r.finalNext) banner = `<div class="obj-line main" style="font-size:15px"><span class="cyan">${icon('bolt')}</span><span class="grow">${t('results.finalNext')}</span></div>`;
  if (r.campaignWon) banner = `<div class="obj-line ok" style="font-size:15px"><span class="green">${icon('check')}</span><span class="grow">${t('results.won')}</span></div>`;
  if (!r.victory) banner = `<div class="obj-line fail" style="font-size:15px;opacity:1"><span class="red">${icon('skull')}</span><span class="grow">${t(c.grid <= 0 ? 'results.lostGrid' : 'results.lostMechs')} ${t('results.lostSaves')}</span></div>`;

  h = app.modal(
    `<div class="h2 ${r.victory ? 'amber' : 'red'}">${title}</div>
     <div class="dim" style="letter-spacing:.14em;text-transform:uppercase;margin-bottom:14px">${esc(missionTitle(r.missionKind, r.regionId))} · ${tn('results.kills', r.kills)} · ${tn('results.gridLost', r.gridLost)}</div>
     ${banner}
     <div class="result-grid" style="margin-top:14px">
       <div><div class="label">${t('hud.objectives')}</div>${objectives || '<div class="dim">—</div>'}
         ${gained.length ? `<div class="label" style="margin-top:14px">${t('results.rewards')}</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${gained.join('')}</div>` : ''}
         <div class="label" style="margin-top:14px">${t('hud.grid')}</div><div style="margin-top:6px">${gridBar(c.grid, c.gridMax)} <span class="dim">&nbsp;${c.grid}/${c.gridMax} · ${t('results.gridDefense', { n: c.gridDef })}</span></div>
       </div>
       <div><div class="label">${t('results.pilots')}</div>${pilots}</div>
     </div>
     <div class="actions"><button class="btn big" data-act="go">${t('common.continue')}</button></div>`,
    { dismissable: false, handlers: { go: () => { h?.close(); onContinue(); } } },
  );
  app.sound.play(r.victory ? 'win' : 'lose');
  if (r.pilots.some((p) => p.leveled)) setTimeout(() => app.sound.play('levelup'), 600);
}
