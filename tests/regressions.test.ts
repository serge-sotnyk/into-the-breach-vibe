import { describe, expect, it } from 'vitest';
import { blankBattle, mech, memoryStorage, setTile } from './helpers';
import { applyEffects, makeUnit, damageTile } from '../src/game/battle/effects';
import { doRepair, endPlayerTurn, execCtx, repairBlock, startBattle, withoutRecording } from '../src/game/battle/turn';
import { applyBattle, aiPilot, newCampaign } from '../src/game/campaign/campaign';
import { computeThreats } from '../src/game/battle/preview';
import { listSlots, readResume, setStorage, storageAvailable, writeSlot } from '../src/game/campaign/save';
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

describe('codex review regressions', () => {
  it('threat previews account for earlier attacks on the same target', () => {
    const s = blankBattle();
    const b = setTile(s, 3, 0, 'building', 1);
    b.shield = 'shield';
    const a1 = makeUnit(s, 'spitter', 3, 3);
    a1.plan = { w: 'e_spit', dir: 0, dist: 1, order: 1 };
    const a2 = makeUnit(s, 'spitter', 0, 0);
    a2.plan = { w: 'e_spit', dir: 1, dist: 1, order: 2 };
    mech(s, 'brawler', 7, 7, ['fist']);
    const th = computeThreats(s);
    expect(th[0].outcome.gridLoss).toBe(0);
    expect(th[1].outcome.gridLoss).toBe(1);
  });

  it('threat previews include the environment step', () => {
    const s = blankBattle();
    setTile(s, 3, 0, 'building', 1);
    // a frozen Vek on a volcanic-rain tile will be thawed before it attacks
    s.hazard = 'volcanic';
    const v = makeUnit(s, 'spitter', 3, 3);
    v.frozen = true;
    v.plan = { w: 'e_spit', dir: 0, dist: 1, order: 1 };
    s.tiles[idx(3, 3)].hazard = true;
    // a burning 1-HP Vek dies before it can attack
    const l = makeUnit(s, 'leaper', 6, 6);
    l.fire = true;
    l.plan = { w: 'e_leap', dir: 3, dist: 1, order: 2 };
    mech(s, 'brawler', 0, 7, ['fist']);
    const th = computeThreats(s).filter((t) => t.id);
    expect(th.find((t) => t.id === v.id)!.cancel).toBe('');
    expect(th.find((t) => t.id === v.id)!.outcome.gridLoss).toBe(1);
    expect(th.find((t) => t.id === l.id)!.cancel).toBe('dead');
  });

  it('a healthy Field Medic can still repair to heal an adjacent ally', () => {
    const s = blankBattle();
    const medic = mech(s, 'brawler', 2, 2, ['fist']);
    medic.skill = 'medic';
    const ally = mech(s, 'cannon', 3, 2, ['cannon'], 1);
    ally.hp = 1;
    expect(repairBlock(s, medic)).toBe('');
    doRepair(s, medic);
    expect(ally.hp).toBe(2);
    const alone = mech(s, 'mortar', 6, 6, ['mortar'], 2);
    alone.skill = 'medic';
    expect(repairBlock(s, alone)).toBe('Undamaged');
  });

  it('thrown eggs land like any unit: pods break, acid sticks', () => {
    const s = blankBattle();
    s.tiles[idx(2, 2)].pod = true;
    s.stats.pod = 'landed';
    s.tiles[idx(4, 4)].acid = true;
    const ctx = execCtx(s, [], 0);
    applyEffects(s, [{ k: 'spawnUnit', x: 2, y: 2, def: 'egg' }, { k: 'spawnUnit', x: 4, y: 4, def: 'egg' }], ctx);
    expect(s.stats.pod).toBe('destroyed');
    expect(s.tiles[idx(4, 4)].acid).toBe(false);
    expect(s.units.find((u) => u.x === 4 && u.y === 4)?.acid).toBe(true);
  });
});

describe('save robustness', () => {
  it('existing saves stay readable when storage is full', () => {
    const st = memoryStorage();
    const c = newCampaign('ironclad', 'normal', 3);
    setStorage(st);
    expect(writeSlot(0, c, 'Full disk')).toBe('');
    const full = { ...st, getItem: st.getItem, removeItem: st.removeItem, setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); } } as Storage;
    setStorage(full);
    expect(storageAvailable()).toBe(false);
    expect(listSlots()[0].status).toBe('ok');
    expect(writeSlot(1, c, 'x')).toBe('Storage is full');
  });

  it('damaged slot metadata is rebuilt instead of breaking the menu', () => {
    const st = memoryStorage();
    setStorage(st);
    const c = newCampaign('tempest', 'easy', 4);
    st.setItem('irongrid.v1.slot.2', JSON.stringify({ meta: {}, campaign: c }));
    const r = listSlots()[2];
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.data.meta.pilots.length).toBe(3);
  });

  it('a damaged battle in the resume save falls back to the campaign', () => {
    const st = memoryStorage();
    setStorage(st);
    const c = newCampaign('inferno', 'normal', 5);
    st.setItem('irongrid.v1.resume', JSON.stringify({ campaign: c, battle: { phase: 'player' }, regionId: 'x', savedAt: 1 }));
    const r = readResume();
    expect(r).not.toBeNull();
    expect(r!.battle).toBeNull();
  });
});
