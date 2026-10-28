import { describe, expect, it } from 'vitest';
import { blankBattle, mech, setTile } from './helpers';
import { makeUnit } from '../src/game/battle/effects';
import { doAttack, doMove, endPlayerTurn, execCtx, withoutRecording } from '../src/game/battle/turn';
import { applyHazards } from '../src/game/battle/hazards';
import { computeThreats } from '../src/game/battle/preview';
import { objectiveState } from '../src/game/battle/objectives';
import { idx } from '../src/game/util';
import { unitById } from '../src/game/battle/board';

describe('objectives and pods', () => {
  it('collects a time pod when a mech steps on it', () => {
    const s = blankBattle();
    const m = mech(s, 'brawler', 2, 4, ['fist']);
    s.tiles[idx(3, 4)].pod = true;
    s.stats.pod = 'landed';
    doMove(s, m, idx(3, 4));
    expect(s.stats.pod).toBe('collected');
    expect(objectiveState(s, { kind: 'pod', n: 0, reward: { rep: 0, power: 0, core: 1, pilot: false } }).state).toBe('done');
  });

  it('a Vek attack destroys the pod', () => {
    const s = blankBattle();
    s.tiles[idx(4, 3)].pod = true;
    s.stats.pod = 'landed';
    const v = makeUnit(s, 'spitter', 4, 0);
    v.plan = { w: 'e_spit', dir: 2, dist: 1, order: 1 };
    mech(s, 'brawler', 0, 7, ['fist']);
    withoutRecording(() => endPlayerTurn(s));
    expect(s.stats.pod).toBe('destroyed');
  });

  it('losing the field tank fails its objective', () => {
    const s = blankBattle();
    const tank = makeUnit(s, 'tank', 3, 3, 'player');
    const v = makeUnit(s, 'spitter', 3, 0);
    v.plan = { w: 'e_spit', dir: 2, dist: 1, order: 1 };
    mech(s, 'brawler', 7, 7, ['fist']);
    withoutRecording(() => endPlayerTurn(s));
    expect(unitById(s, tank.id)).toBeUndefined();
    expect(objectiveState(s, { kind: 'tank', n: 0, reward: { rep: 2, power: 0, core: 0, pilot: false } }).state).toBe('fail');
  });
});

describe('hazards', () => {
  it('lightning destroys units on marked tiles', () => {
    const s = blankBattle();
    s.hazard = 'lightning';
    const v = makeUnit(s, 'rammer', 2, 2);
    s.tiles[idx(2, 2)].hazard = true;
    applyHazards(s, execCtx(s, [], 0));
    expect(unitById(s, v.id)).toBeUndefined();
  });

  it('seismic activity turns tiles into chasms and units fall', () => {
    const s = blankBattle();
    s.hazard = 'seismic';
    const m = mech(s, 'brawler', 2, 2, ['fist']);
    s.tiles[idx(2, 2)].hazard = true;
    applyHazards(s, execCtx(s, [], 0));
    expect(s.tiles[idx(2, 2)].t).toBe('chasm');
    expect(m.dead).toBe(true);
  });

  it('tidal waves drown ground Vek but not massive mechs', () => {
    const s = blankBattle();
    s.hazard = 'tidal';
    const v = makeUnit(s, 'rammer', 1, 0);
    const m = mech(s, 'brawler', 2, 0, ['fist']);
    s.tiles[idx(1, 0)].hazard = true;
    s.tiles[idx(2, 0)].hazard = true;
    applyHazards(s, execCtx(s, [], 0));
    expect(unitById(s, v.id)).toBeUndefined();
    expect(m.dead).toBe(false);
  });
});

describe('psions and eggs', () => {
  it('shell psion armors other Vek', () => {
    const s = blankBattle();
    makeUnit(s, 'psion_shell', 6, 6);
    const v = makeUnit(s, 'rammer', 3, 2);
    const m = mech(s, 'brawler', 2, 2, ['fist']);
    doAttack(s, m, 0, idx(3, 2));
    expect(v.hp).toBe(3);
  });

  it('blast psion makes dying Vek explode', () => {
    const s = blankBattle();
    makeUnit(s, 'psion_blast', 7, 7);
    makeUnit(s, 'leaper', 3, 2);
    const other = makeUnit(s, 'rammer', 4, 2);
    const m = mech(s, 'brawler', 2, 2, ['fist']);
    s.units.find((u) => u.def === 'leaper')!.hp = 1;
    doAttack(s, m, 0, idx(3, 2));
    // punch kills the leaper (pushed into the rammer); its explosion damages adjacent tiles
    expect(other.hp).toBeLessThan(4);
  });

  it('eggs hatch into hatchlings after a turn', () => {
    const s = blankBattle();
    mech(s, 'brawler', 7, 7, ['fist']);
    const egg = makeUnit(s, 'egg', 3, 3);
    withoutRecording(() => endPlayerTurn(s));
    expect(unitById(s, egg.id)?.def).toBe('egg');
    withoutRecording(() => endPlayerTurn(s));
    expect(unitById(s, egg.id)?.def).toBe('hatchling');
  });
});

describe('bosses', () => {
  it("the Tyrant's lance stops at the first unit", () => {
    const s = blankBattle();
    const t = makeUnit(s, 'boss_tyrant', 3, 0);
    t.plan = { w: 'e_psy', dir: 2, dist: 1, order: 1 };
    const blocker = mech(s, 'judo', 3, 2, ['vice']);
    const bomb = makeUnit(s, 'bomb', 3, 5, 'neutral');
    const th = computeThreats(s)[0];
    expect(th.outcome.hpAfter.has(bomb.id)).toBe(false);
    expect(th.outcome.hpAfter.get(blocker.id)).toBe(blocker.hp - 2);
  });

  it('the bomb is armored', () => {
    const s = blankBattle();
    const bomb = makeUnit(s, 'bomb', 3, 3, 'neutral');
    const v = makeUnit(s, 'spitter', 3, 0);
    v.plan = { w: 'e_spit', dir: 2, dist: 1, order: 1 };
    mech(s, 'brawler', 7, 7, ['fist']);
    withoutRecording(() => endPlayerTurn(s));
    expect(bomb.hp).toBe(4);
  });
});

describe('terrain', () => {
  it('damaged forests catch fire and set the unit ablaze', () => {
    const s = blankBattle();
    setTile(s, 3, 2, 'forest');
    const v = makeUnit(s, 'rammer', 3, 2);
    const m = mech(s, 'cannon', 0, 2, ['cannon']);
    doAttack(s, m, 0, idx(3, 2));
    expect(s.tiles[idx(4, 2)].fire || s.tiles[idx(3, 2)].fire).toBe(true);
    expect(v.x).toBe(4);
  });

  it('ice cracks then shatters, drowning ground Vek', () => {
    const s = blankBattle();
    setTile(s, 3, 2, 'ice', 2);
    const v = makeUnit(s, 'leaper_a', 3, 2);
    const m = mech(s, 'mortar', 0, 2, ['mortar']);
    doAttack(s, m, 0, idx(3, 2));
    expect(s.tiles[idx(3, 2)].hp).toBe(1);
    doAttack(s, Object.assign(m, { acted: false, moved: false }), 0, idx(3, 2));
    expect(s.tiles[idx(3, 2)].t).toBe('water');
    expect(unitById(s, v.id)).toBeUndefined();
  });
});
