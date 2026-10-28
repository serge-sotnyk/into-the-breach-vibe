import type { App, ModalHandle } from '../app';
import type { MissionReport } from '../../game/campaign/campaign';
import { LEVEL_PERKS, SKILLS } from '../../game/data/pilots';
import { esc, gridBar, rewardChips } from '../common';
import { icon } from '../icons';

export function showResults(app: App, r: MissionReport, onContinue: () => void): void {
  const c = app.campaign!;
  let h: ModalHandle | null = null;
  const title = r.victory ? (r.campaignWon ? 'THE HIVE COLLAPSES' : 'MISSION COMPLETE') : 'TIMELINE LOST';
  const objectives = r.objectives
    .map(
      (o) => `<div class="obj-line ${o.success ? 'ok' : 'fail'}">${o.success ? `<span class="green">${icon('check')}</span>` : `<span class="red">${icon('cross')}</span>`}
        <span class="grow">${esc(o.label)}</span>${rewardChips(o.reward)}</div>`,
    )
    .join('');
  const pilots = r.pilots
    .map((p) => {
      let right = '';
      if (p.died) right = `<span class="red">${icon('skull')} KILLED IN ACTION</span>`;
      else if (p.ai) right = '<span class="dim">Autopilot</span>';
      else right = `<span class="cyan">+${p.xpGained} XP</span>`;
      const extra: string[] = [];
      if (p.ejected) extra.push('<span class="amber">Ejected safely — mech rebuilt.</span>');
      if (p.leveled) extra.push(`<span class="amber">${icon('star')} LEVEL ${p.level}! ${LEVEL_PERKS[p.level - 1]}</span>`);
      return `<div class="pilot-line"><span><b>${esc(p.name)}</b> <span class="dim">· ${esc(p.chassis)}</span></span>${right}${extra.length ? `<span style="grid-column:1/-1">${extra.join(' ')}</span>` : ''}</div>`;
    })
    .join('');
  const gained: string[] = [];
  if (r.rep) gained.push(`<span class="chip rep">${icon('star')}+${r.rep} reputation</span>`);
  if (r.power) gained.push(`<span class="chip power">${icon('bolt')}+${r.power} grid power</span>`);
  if (r.defense) gained.push(`<span class="chip power">+${r.defense}% grid defense (grid full)</span>`);
  if (r.cores) gained.push(`<span class="chip core">${icon('core')}+${r.cores} reactor core${r.cores > 1 ? 's' : ''}</span>`);
  if (r.newPilot) gained.push(`<span class="chip pilot">${icon('pilot')}${esc(r.newPilot.name)} joins (${esc(SKILLS[r.newPilot.skill]?.name ?? '')})</span>`);
  let banner = '';
  if (r.islandSecured) banner = `<div class="obj-line ok" style="font-size:16px"><span class="green">${icon('check')}</span><span class="grow"><b>${esc(r.islandSecured)} secured!</b> The corporation patches the grid, hands you a reactor core and opens its armory.</span></div>`;
  if (r.finalNext) banner = `<div class="obj-line main" style="font-size:15px"><span class="cyan">${icon('bolt')}</span><span class="grow">The Breach Bomb is inbound. One last stand at the Hive Heart.</span></div>`;
  if (r.campaignWon) banner = `<div class="obj-line ok" style="font-size:15px"><span class="green">${icon('check')}</span><span class="grow">The bomb detonates. The Hive is gone — this timeline is saved.</span></div>`;
  if (!r.victory) banner = `<div class="obj-line fail" style="font-size:15px;opacity:1"><span class="red">${icon('skull')}</span><span class="grow">${c.grid <= 0 ? 'The power grid collapsed.' : 'The squad has fallen.'} Your saved campaigns are still available from the Load menu.</span></div>`;

  h = app.modal(
    `<div class="h2 ${r.victory ? 'amber' : 'red'}">${title}</div>
     <div class="dim" style="letter-spacing:.14em;text-transform:uppercase;margin-bottom:14px">${esc(r.missionName)} · ${r.kills} Vek destroyed · ${r.gridLost} grid power lost</div>
     ${banner}
     <div class="result-grid" style="margin-top:14px">
       <div><div class="label">Objectives</div>${objectives || '<div class="dim">—</div>'}
         ${gained.length ? `<div class="label" style="margin-top:14px">Rewards</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${gained.join('')}</div>` : ''}
         <div class="label" style="margin-top:14px">Power grid</div><div style="margin-top:6px">${gridBar(c.grid, c.gridMax)} <span class="dim">&nbsp;${c.grid}/${c.gridMax} · defense ${c.gridDef}%</span></div>
       </div>
       <div><div class="label">Pilots</div>${pilots}</div>
     </div>
     <div class="actions"><button class="btn big" data-act="go">Continue</button></div>`,
    { dismissable: false, handlers: { go: () => { h?.close(); onContinue(); } } },
  );
  app.sound.play(r.victory ? 'win' : 'lose');
  if (r.pilots.some((p) => p.leveled)) setTimeout(() => app.sound.play('levelup'), 600);
}
