import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyBattle,
  enterFinal,
  enterIsland,
  finalUnlocked,
  leaveShop,
  newCampaign,
  regionAvailable,
  startMission,
  buyItem,
  buyPower,
  freeCores,
  equipWeapon,
  toggleUpgrade,
} from '../src/game/campaign/campaign';
import { autoDeploy, autoPlayTurn } from '../src/game/battle/autoplay';
import { startBattle, withoutRecording } from '../src/game/battle/turn';
import type { BattleState, Campaign } from '../src/game/types';
import { clearResume, listSlots, loadSlot, readResume, setStorage, writeResume, writeSlot, deleteSlot } from '../src/game/campaign/save';
import { memoryStorage } from './helpers';

function playBattle(s: BattleState): BattleState {
  autoDeploy(s);
  withoutRecording(() => startBattle(s));
  let guard = 0;
  while (s.phase === 'player' && guard++ < 20) autoPlayTurn(s);
  return s;
}

function playCampaign(seed: number, squad: string): { c: Campaign; battles: number; won: number } {
  const c = newCampaign(squad, 'easy', seed);
  let battles = 0;
  let won = 0;
  for (let guard = 0; guard < 40; guard++) {
    if (c.phase === 'defeat' || c.phase === 'victory') break;
    if (c.phase === 'world') {
      if (finalUnlocked(c)) {
        enterFinal(c);
      } else {
        const i = c.islands.findIndex((x) => !x.secured);
        enterIsland(c, i);
      }
      continue;
    }
    if (c.phase === 'shop') {
      while (buyPower(c));
      for (let i = 0; i < c.shop.length; i++) buyItem(c, i);
      if (c.inventory.length) equipWeapon(c, 0, 1, 0);
      leaveShop(c);
      continue;
    }
    let regionId = '';
    let spec;
    if (c.phase === 'final') {
      spec = c.finalMissions[c.finalStage];
    } else {
      const isl = c.islands[c.current];
      const r = isl.regions.find((x) => regionAvailable(isl, x))!;
      regionId = r.id;
      spec = r.mission!;
    }
    const s = playBattle(startMission(c, spec));
    battles++;
    if (s.phase === 'won') won++;
    expect(['won', 'lost']).toContain(s.phase);
    applyBattle(c, regionId, s);
  }
  return { c, battles, won };
}

describe('campaign flow', () => {
  it('plays complete campaigns headlessly without errors', () => {
    const results = [
      playCampaign(101, 'ironclad'),
      playCampaign(202, 'tempest'),
      playCampaign(303, 'inferno'),
    ];
    for (const r of results) {
      expect(r.battles).toBeGreaterThan(0);
      expect(['victory', 'defeat']).toContain(r.c.phase);
    }
    // eslint-disable-next-line no-console
    console.log(results.map((r) => `${r.c.squad}: ${r.c.phase} after ${r.battles} battles (${r.won} won), islands ${r.c.secured}`).join('\n'));
  });

  it('reactor cores gate upgrades', () => {
    const c = newCampaign('ironclad', 'normal', 5);
    expect(freeCores(c)).toBe(1);
    expect(toggleUpgrade(c, 0, 0, 1)).not.toBe('');
    expect(toggleUpgrade(c, 2, 0, 0)).toBe('');
    expect(freeCores(c)).toBe(0);
    expect(toggleUpgrade(c, 2, 0, 0)).toBe('');
    expect(freeCores(c)).toBe(1);
  });
});

describe('saves', () => {
  beforeEach(() => setStorage(memoryStorage()));

  it('round-trips campaigns through slots', () => {
    const c = newCampaign('inferno', 'hard', 77);
    enterIsland(c, 1);
    c.phase = 'world';
    expect(writeSlot(2, c, 'Before Dune')).toBe('');
    const slots = listSlots();
    expect(slots[2].status).toBe('ok');
    expect(slots[0].status).toBe('empty');
    const loaded = loadSlot(2)!;
    expect(loaded).toEqual(c);
    loaded.grid = 1;
    expect(loadSlot(2)!.grid).toBe(c.grid);
    deleteSlot(2);
    expect(listSlots()[2].status).toBe('empty');
  });

  it('keeps manual saves after defeat while clearing resume', () => {
    const c = newCampaign('ironclad', 'normal', 9);
    writeSlot(0, c, 'Start');
    writeResume({ campaign: c, battle: null, regionId: '', savedAt: 1 });
    expect(readResume()).not.toBeNull();
    c.phase = 'defeat';
    clearResume();
    expect(readResume()).toBeNull();
    expect(loadSlot(0)?.phase).toBe('world');
  });

  it('reports corrupt slots instead of crashing', () => {
    const st = memoryStorage();
    setStorage(st);
    st.setItem('irongrid.v1.slot.1', '{not json');
    st.setItem('irongrid.v1.slot.3', JSON.stringify({ meta: {}, campaign: { version: 99 } }));
    const slots = listSlots();
    expect(slots[1].status).toBe('corrupt');
    expect(slots[3].status).toBe('corrupt');
    expect(loadSlot(1)).toBeNull();
  });
});
