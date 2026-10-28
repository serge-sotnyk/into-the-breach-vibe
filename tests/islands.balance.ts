import { it } from 'vitest';
import { newCampaign, enterIsland, startMission } from '../src/game/campaign/campaign';
import { autoDeploy, autoPlayTurn } from '../src/game/battle/autoplay';
import { startBattle, withoutRecording } from '../src/game/battle/turn';

it('balance', () => {
  const rows: string[] = [];
  for (const diff of ['normal'] as const) {
    for (const tier of [0, 1, 2]) {
      for (const squad of ['ironclad', 'tempest', 'inferno']) {
        let loss = 0, wins = 0, n = 0, mechDeaths = 0, attacks = 0, bAttacks = 0;
        for (let seed = 1; seed <= 16; seed++) {
          const c = newCampaign(squad, diff, seed * 104729 + tier);
          c.secured = tier;
          enterIsland(c, seed % 4);
          const isl = c.islands[c.current];
          const r = isl.regions[seed % 6];
          const s = startMission(c, r.mission!);
          autoDeploy(s);
          withoutRecording(() => startBattle(s));
          let g = 0;
          while (s.phase === 'player' && g++ < 10) {
            for (const u of s.units) if (u.team === 'enemy' && u.plan) attacks++;
            autoPlayTurn(s);
          }
          n++;
          loss += s.stats.gridLost;
          if (s.phase === 'won') wins++;
          mechDeaths += s.units.filter((u) => u.slot >= 0 && u.dead).length;
        }
        rows.push(`${diff} tier${tier} ${squad.padEnd(8)} win ${wins}/${n} gridLoss/battle ${(loss / n).toFixed(2)} mechDeaths/battle ${(mechDeaths / n).toFixed(2)} attacks/battle ${(attacks / n).toFixed(1)}`);
      }
    }
  }
  console.log(rows.join('\n'));
});
