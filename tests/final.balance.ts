import { it } from 'vitest';
import { newCampaign, enterFinal, startMission } from '../src/game/campaign/campaign';
import { autoDeploy, autoPlayTurn } from '../src/game/battle/autoplay';
import { startBattle, withoutRecording } from '../src/game/battle/turn';

it('final balance', () => {
  const rows: string[] = [];
  for (const squad of ['ironclad', 'tempest', 'inferno']) {
    for (const stage of [0, 1]) {
      let wins = 0, loss = 0, n = 0, bomb = 0;
      for (let seed = 1; seed <= 16; seed++) {
        const c = newCampaign(squad, 'normal', seed * 7717);
        c.secured = 2;
        c.grid = 7;
        for (const m of c.mechs) { m.pilot.level = 1; m.pilot.xp = 8; }
        enterFinal(c);
        const s = startMission(c, c.finalMissions[stage]);
        autoDeploy(s);
        withoutRecording(() => startBattle(s));
        let g = 0;
        while (s.phase === 'player' && g++ < 10) autoPlayTurn(s);
        n++;
        if (s.phase === 'won') wins++;
        if (s.lostReason === 'bomb') bomb++;
        loss += s.stats.gridLost;
      }
      rows.push(`${squad.padEnd(8)} final${stage + 1} win ${wins}/${n} gridLoss ${(loss / n).toFixed(2)} bombLost ${bomb}`);
    }
  }
  console.log(rows.join('\n'));
});
