import { describe, expect, it } from 'vitest';
import { blankBattle, mech, setTile } from './helpers';
import { makeUnit, damageTile } from '../src/game/battle/effects';
import { endPlayerTurn, execCtx, startBattle, withoutRecording } from '../src/game/battle/turn';
import { applyBattle, aiPilot, newCampaign } from '../src/game/campaign/campaign';
import { idx } from '../src/game/util';

describe('review regressions', () => {
  it('a recruited pilot does not inherit the fate of the battle they missed', () => {
    const c = newCampaign('ironclad', 'normal', 11);
    c.phase = 'final';
    c.finalStage = 0;
    c.mechs[2].pilot = aiPilot(c);
    const s = blankBattle();
    s.phase = 'won';
    s.objectives = [{ kind: 'pod', n: 0, reward: { rep: 0, power: 0, core: 1, pilot: true } }];
    s.stats.pod = 'collected';
    const wrecked = mech(s, 'mortar', 2, 2, ['mortar'], 2);
    wrecked.dead = true;
    mech(s, 'brawler', 3, 3, ['fist'], 0);
    mech(s, 'cannon', 4, 4, ['cannon'], 1);
    // force the 60% recruit roll to succeed
    for (let seed = 1; seed < 200; seed++) {
      const copy = structuredClone(c);
      copy.rng = seed;
      const r = applyBattle(copy, '', structuredClone(s));
      if (!r.newPilot) continue;
      expect(r.pilots.some((p) => p.died)).toBe(false);
      expect(copy.mechs[2].pilot.name).toBe(r.newPilot.name);
      expect(copy.mechs[2].pilot.xp).toBe(0);
      return;
    }
    throw new Error('recruit roll never succeeded');
  });

  it('the Vek see hazards before they move (tidal row is avoided)', () => {
    const s = blankBattle();
    s.phase = 'deploy';
    s.hazard = 'tidal';
    setTile(s, 0, 0, 'building', 1);
    const r = makeUnit(s, 'rammer', 3, 0);
    mech(s, 'brawler', 3, 7, ['fist']);
    withoutRecording(() => startBattle(s));
    expect(s.tiles[idx(3, 0)].hazard).toBe(true);
    expect(r.y).not.toBe(0);
  });

  it('a pod always survives until the player has had a turn', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = blankBattle();
      s.rng = seed * 7919;
      s.phase = 'deploy';
      s.podTurn = 1;
      s.enemyPool = ['wasp'];
      for (let k = 0; k < 4; k++) makeUnit(s, 'wasp', 1 + k, 2 + (k % 2));
      mech(s, 'brawler', 0, 7, ['fist']);
      withoutRecording(() => startBattle(s));
      expect(s.stats.pod).toBe('landed');
    }
  });

  it('damage destroys a pod on sand and forest too', () => {
    for (const t of ['sand', 'forest'] as const) {
      const s = blankBattle();
      setTile(s, 2, 2, t);
      s.tiles[idx(2, 2)].pod = true;
      s.stats.pod = 'landed';
      damageTile(s, 2, 2, 1, {}, execCtx(s, [], 0));
      expect(s.tiles[idx(2, 2)].pod).toBe(false);
      expect(s.stats.pod).toBe('destroyed');
    }
  });

  it('a spawn under flooded ground never emerges and gives no kill', () => {
    const s = blankBattle();
    mech(s, 'brawler', 7, 7, ['fist']);
    setTile(s, 3, 3, 'water');
    s.tiles[idx(3, 3)].spawn = 'spitter';
    withoutRecording(() => endPlayerTurn(s));
    expect(s.units.some((u) => u.team === 'enemy')).toBe(false);
    expect(s.stats.kills).toBe(0);
  });
});
