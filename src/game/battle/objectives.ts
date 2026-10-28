import type { BattleState, Objective } from '../types';

export type ObjState = 'ok' | 'done' | 'fail' | 'pending';

function objectiveBuildingAlive(s: BattleState, tag: string): boolean {
  const t = s.tiles.find((x) => x.obj === tag);
  return !!t && t.t === 'building';
}

/** Live status of a bonus objective during battle. */
export function objectiveState(s: BattleState, o: Objective): { state: ObjState; progress: string } {
  const st = s.stats;
  switch (o.kind) {
    case 'kill':
      return { state: st.kills >= o.n ? 'done' : 'pending', progress: `${Math.min(st.kills, o.n)}/${o.n}` };
    case 'relay':
    case 'lab':
    case 'uplink':
      return { state: objectiveBuildingAlive(s, o.kind) ? 'ok' : 'fail', progress: '' };
    case 'lowdmg':
      return { state: st.mechDamage < o.n ? 'ok' : 'fail', progress: `${st.mechDamage}/${o.n}` };
    case 'block':
      return { state: st.blocked >= o.n ? 'done' : 'pending', progress: `${Math.min(st.blocked, o.n)}/${o.n}` };
    case 'pod':
      return {
        state: st.pod === 'collected' ? 'done' : st.pod === 'destroyed' ? 'fail' : 'pending',
        progress: st.pod === 'none' ? 'lands turn 2' : st.pod === 'landed' ? 'landed' : '',
      };
    case 'tank':
      return { state: st.npcLost ? 'fail' : 'ok', progress: '' };
    case 'boss':
      return { state: st.bossKilled ? 'done' : 'pending', progress: '' };
    case 'bomb':
      return { state: st.bombLost ? 'fail' : 'ok', progress: '' };
  }
  return { state: 'pending', progress: '' };
}

/** Whether the objective counts as completed when the battle ends in victory. */
export function objectiveSucceeded(s: BattleState, o: Objective): boolean {
  if (s.phase !== 'won') return false;
  const st = objectiveState(s, o).state;
  return st === 'ok' || st === 'done';
}
