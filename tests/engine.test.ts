import { describe, expect, it } from 'vitest';
import { blankBattle, mech, setTile } from './helpers';
import { makeUnit, applyEffects } from '../src/game/battle/effects';
import { doAttack, doMove, endPlayerTurn, withoutRecording } from '../src/game/battle/turn';
import { previewAttack, computeThreats } from '../src/game/battle/preview';
import { idx } from '../src/game/util';
import { liveAt, unitById } from '../src/game/battle/board';
import { execCtx } from '../src/game/battle/turn';
import { planEnemies } from '../src/game/battle/ai';

describe('pushes and bumps', () => {
  it('drowns a non-massive Vek pushed into water', () => {
    const s = blankBattle();
    setTile(s, 3, 1, 'water');
    const m = mech(s, 'brawler', 3, 3, ['fist']);
    const v = makeUnit(s, 'spitter', 3, 2);
    doAttack(s, m, 0, idx(3, 2));
    expect(unitById(s, v.id)).toBeUndefined();
    expect(s.stats.kills).toBe(1);
    expect(m.kills).toBe(1);
  });

  it('bumps two units into each other for 1 damage each', () => {
    const s = blankBattle();
    const m = mech(s, 'brawler', 3, 4, ['fist']);
    const a = makeUnit(s, 'rammer', 3, 3);
    const b = makeUnit(s, 'rammer', 3, 2);
    doAttack(s, m, 0, idx(3, 3));
    expect(a.hp).toBe(4 - 2 - 1);
    expect(b.hp).toBe(4 - 1);
    expect(a.y).toBe(3);
  });

  it('pushing a unit into a building costs grid power', () => {
    const s = blankBattle();
    setTile(s, 3, 1, 'building', 1);
    const m = mech(s, 'brawler', 3, 3, ['fist']);
    makeUnit(s, 'rammer', 3, 2);
    doAttack(s, m, 0, idx(3, 2));
    expect(s.grid).toBe(4);
    expect(s.tiles[idx(3, 1)].t).toBe('rubble');
  });

  it('push into the map edge does nothing', () => {
    const s = blankBattle();
    const m = mech(s, 'brawler', 3, 1, ['fist']);
    const v = makeUnit(s, 'rammer', 3, 0);
    doAttack(s, m, 0, idx(3, 0));
    expect(v.y).toBe(0);
    expect(v.hp).toBe(2);
  });
});

describe('weapons', () => {
  it('projectile hits the first unit in line', () => {
    const s = blankBattle();
    const m = mech(s, 'cannon', 0, 4, ['cannon']);
    const near = makeUnit(s, 'rammer', 3, 4);
    const far = makeUnit(s, 'rammer', 6, 4);
    doAttack(s, m, 0, idx(3, 4));
    expect(near.hp).toBe(3);
    expect(near.x).toBe(4);
    expect(far.hp).toBe(4);
  });

  it('artillery damages center and pushes adjacent outward', () => {
    const s = blankBattle();
    const m = mech(s, 'mortar', 0, 4, ['mortar']);
    const c = makeUnit(s, 'rammer', 4, 4);
    const side = makeUnit(s, 'rammer', 4, 3);
    doAttack(s, m, 0, idx(4, 4));
    expect(c.hp).toBe(3);
    expect(side.y).toBe(2);
    expect(side.hp).toBe(4);
  });

  it('acid doubles damage and armor reduces it', () => {
    const s = blankBattle();
    const m = mech(s, 'brawler', 2, 2, ['fist']);
    const v = makeUnit(s, 'boss_jugg', 3, 2);
    doAttack(s, m, 0, idx(3, 2));
    expect(v.hp).toBe(6 - 1);
    const s2 = blankBattle();
    const m2 = mech(s2, 'brawler', 2, 2, ['fist']);
    const v2 = makeUnit(s2, 'boss_jugg', 3, 2);
    v2.acid = true;
    doAttack(s2, m2, 0, idx(3, 2));
    expect(v2.hp).toBe(6 - 4);
  });

  it('frozen units ignore the next hit', () => {
    const s = blankBattle();
    const m = mech(s, 'brawler', 2, 2, ['fist']);
    const v = makeUnit(s, 'rammer', 3, 2);
    v.frozen = true;
    doAttack(s, m, 0, idx(3, 2));
    expect(v.hp).toBe(4);
    expect(v.frozen).toBe(false);
  });

  it('preview matches the executed outcome', () => {
    const s = blankBattle();
    setTile(s, 5, 2, 'building', 2);
    const m = mech(s, 'mortar', 1, 2, ['mortar']);
    const v = makeUnit(s, 'rammer', 4, 2);
    const p = previewAttack(s, m, 0, idx(4, 2))!;
    expect(p.hpAfter.get(v.id)).toBe(3);
    doAttack(s, m, 0, idx(4, 2));
    expect(v.hp).toBe(3);
  });

  it('chain lightning hits every connected unit', () => {
    const s = blankBattle();
    const m = mech(s, 'arc', 1, 1, ['whip']);
    const a = makeUnit(s, 'rammer', 2, 1);
    const b = makeUnit(s, 'rammer', 3, 1);
    const c = makeUnit(s, 'rammer', 3, 2);
    doAttack(s, m, 0, idx(2, 1));
    expect([a.hp, b.hp, c.hp]).toEqual([2, 2, 2]);
  });
});

describe('enemy turn', () => {
  it('queued attacks move with the attacker when pushed', () => {
    const s = blankBattle();
    setTile(s, 4, 0, 'building', 1);
    setTile(s, 5, 0, 'building', 1);
    const v = makeUnit(s, 'spitter', 4, 3);
    v.plan = { w: 'e_spit', dir: 0, dist: 1, order: 1 };
    const m = mech(s, 'cannon', 0, 3, ['cannon']);
    const before = computeThreats(s)[0];
    expect([...before.outcome.buildingLoss.keys()]).toEqual([idx(4, 0)]);
    doAttack(s, m, 0, idx(4, 3));
    expect(v.x).toBe(5);
    const after = computeThreats(s)[0];
    expect([...after.outcome.buildingLoss.keys()]).toEqual([idx(5, 0)]);
  });

  it('smoke cancels an attack', () => {
    const s = blankBattle();
    setTile(s, 4, 0, 'building', 1);
    const v = makeUnit(s, 'spitter', 4, 3);
    v.plan = { w: 'e_spit', dir: 0, dist: 1, order: 1 };
    s.tiles[idx(4, 3)].smoke = 1;
    mech(s, 'cannon', 0, 7, ['cannon']);
    withoutRecording(() => endPlayerTurn(s));
    expect(s.grid).toBe(5);
  });

  it('blocking a spawn damages the blocker and stops the Vek', () => {
    const s = blankBattle();
    const m = mech(s, 'brawler', 2, 2, ['fist']);
    s.tiles[idx(2, 2)].spawn = 'spitter';
    withoutRecording(() => endPlayerTurn(s));
    expect(m.hp).toBe(2);
    expect(s.stats.blocked).toBe(1);
    expect(s.units.filter((u) => u.team === 'enemy').length).toBe(0);
  });

  it('Vek prefer to attack buildings', () => {
    const s = blankBattle();
    setTile(s, 3, 5, 'building', 1);
    mech(s, 'brawler', 7, 7, ['fist']);
    const v = makeUnit(s, 'spitter', 3, 1);
    planEnemies(s, execCtx(s, [], 0));
    expect(v.plan).not.toBeNull();
    const t = computeThreats(s)[0];
    expect(t.outcome.gridLoss).toBe(1);
  });

  it('webbed mechs cannot move', () => {
    const s = blankBattle();
    const m = mech(s, 'brawler', 3, 3, ['fist']);
    makeUnit(s, 'stinger', 3, 1);
    planEnemies(s, execCtx(s, [], 0));
    if (m.webbedBy) {
      const steps = doMove(s, m, idx(0, 3));
      expect(steps.length).toBe(0);
    }
  });

  it('fire burns units at the start of the enemy turn', () => {
    const s = blankBattle();
    const m = mech(s, 'brawler', 2, 2, ['fist']);
    m.fire = true;
    withoutRecording(() => endPlayerTurn(s));
    expect(m.hp).toBe(2);
  });

  it('explosive blob damages adjacent tiles', () => {
    const s = blankBattle();
    const b = makeUnit(s, 'blob', 3, 3);
    const m = mech(s, 'brawler', 3, 4, ['fist']);
    b.plan = { w: 'e_explode', dir: 0, dist: 0, order: 1 };
    withoutRecording(() => endPlayerTurn(s));
    expect(m.hp).toBe(2);
    expect(liveAt(s, 3, 3)).toBeUndefined();
  });
});

describe('effects engine', () => {
  it('wind pushes everything one tile', () => {
    const s = blankBattle();
    const a = makeUnit(s, 'rammer', 3, 3);
    const b = makeUnit(s, 'rammer', 4, 3);
    applyEffects(s, [{ k: 'wind', dir: 1 }], execCtx(s, [], 0));
    expect([a.x, b.x]).toEqual([4, 5]);
  });
});
