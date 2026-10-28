import { describe, expect, it } from 'vitest';
import { blankBattle, mech } from './helpers';
import { makeUnit } from '../src/game/battle/effects';
import { canMove, doAttack, doMove, doRepair } from '../src/game/battle/turn';
import { idx } from '../src/game/util';

describe('pilot skills', () => {
  it('Afterburner can move after attacking, but only once', () => {
    const s = blankBattle();
    const m = mech(s, 'brawler', 2, 2, ['fist']);
    m.skill = 'afterburn';
    makeUnit(s, 'rammer', 3, 2);
    doAttack(s, m, 0, idx(3, 2));
    expect(canMove(s, m)).toBe(true);
    doMove(s, m, idx(2, 4));
    expect(canMove(s, m)).toBe(false);
  });

  it('a normal pilot cannot move after attacking', () => {
    const s = blankBattle();
    const m = mech(s, 'brawler', 2, 2, ['fist']);
    makeUnit(s, 'rammer', 3, 2);
    doAttack(s, m, 0, idx(3, 2));
    expect(canMove(s, m)).toBe(false);
  });

  it('Field Medic repairs 2 and heals adjacent allies', () => {
    const s = blankBattle();
    const m = mech(s, 'brawler', 2, 2, ['fist']);
    const ally = mech(s, 'cannon', 3, 2, ['cannon'], 1);
    m.skill = 'medic';
    m.hp = 1;
    ally.hp = 1;
    ally.fire = true;
    doRepair(s, m);
    expect(m.hp).toBe(3);
    expect(ally.hp).toBe(2);
    expect(ally.fire).toBe(false);
  });
});
