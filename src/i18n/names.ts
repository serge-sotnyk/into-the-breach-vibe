// Display text for game data, looked up by id. Saves keep only ids (plus legacy English
// names that are never shown), so everything here follows the current language.

import type { MissionKind, MissionSpec, ObjKind, Objective, Pilot } from '../game/types';
import { UNITS } from '../game/data/units';
import { WEAPONS } from '../game/data/weapons';
import { t, tn, type StrKey } from './index';

const k = (s: string): StrKey => s as StrKey;

export const unitName = (def: string): string => (UNITS[def] ? t(k(`unit.${def}.name`)) : def);
export const unitDesc = (def: string): string => t(k(`unit.${def}.desc`));
export const className = (cls: string): string => t(k(`class.${cls}`));

export const weaponName = (id: string): string => t(k(`weapon.${id}.name`));
export const weaponDesc = (id: string): string => t(k(`weapon.${id}.desc`));

export function upgradeText(weapon: string, i: number): { name: string; desc: string } {
  const up = WEAPONS[weapon]?.up[i];
  if (up?.tpl === 'damage') {
    const n = up.mod.dmgAdd ?? 0;
    return { name: t('upgrade.damage.name', { n }), desc: t('upgrade.damage.desc', { n }) };
  }
  return { name: t(k(`weapon.${weapon}.up.${i}.name`)), desc: t(k(`weapon.${weapon}.up.${i}.desc`)) };
}

/** Pilots keep their own names; the autopilot is named in the current language. */
export const pilotName = (p: Pilot): string => (p.ai ? t('pilot.autopilot') : p.name);

export const skillName = (id: string): string => t(k(`skill.${id}.name`));
export const skillDesc = (id: string): string => t(k(`skill.${id}.desc`));
/** The reward for reaching pilot level `level` (1 or 2). */
export const perkText = (level: number): string => t(k(`perk.${level - 1}`));

export const squadName = (id: string): string => t(k(`squad.${id}.name`));
export const squadText = (id: string, field: 'tagline' | 'desc' | 'difficulty'): string => t(k(`squad.${id}.${field}`));

export const islandName = (id: string): string => t(k(`island.${id}.name`));
export const islandDesc = (id: string): string => t(k(`island.${id}.desc`));
export const islandCorp = (id: string): string => (id === 'caldera' ? t('final.corp') : t(k(`island.${id}.corp`)));

export const hazardName = (id: string): string => t(k(`hazard.${id}.name`));
export const hazardDesc = (id: string): string => t(k(`hazard.${id}.desc`));

export const difficultyName = (id: string): string => t(k(`difficulty.${id}.name`));
export const difficultyDesc = (id: string): string => t(k(`difficulty.${id}.desc`));

export const terrainName = (id: string): string => t(k(`terrain.${id}.name`));
export const terrainDesc = (id: string): string => t(k(`terrain.${id}.desc`));

/** Region ids are `<island>-<index>` or `<island>-hq`. */
function parseRegion(regionId: string): { island: string; index: number } | null {
  const m = /^([a-z]+)-(hq|\d+)$/.exec(regionId);
  if (!m) return null;
  return { island: m[1], index: m[2] === 'hq' ? -1 : Number(m[2]) };
}

export function regionName(regionId: string): string {
  const r = parseRegion(regionId);
  if (!r) return '';
  return r.index < 0 ? t(k(`island.${r.island}.hq`)) : t(k(`island.${r.island}.region.${r.index}`));
}

/** The name of a mission: its region, or the stage of the final assault. */
export function missionTitle(kind: MissionKind, regionId: string): string {
  if (kind === 'final1') return t('final.rim');
  if (kind === 'final2') return t('final.heart');
  return regionName(regionId);
}

export function missionBriefing(m: MissionSpec, regionId: string): string {
  const region = missionTitle(m.kind, regionId);
  const corp = islandCorp(m.theme);
  const lines: string[] = [];
  if (m.kind === 'boss') lines.push(t('brief.boss', { boss: unitName(m.boss), region, corp }));
  else if (m.kind === 'final1') lines.push(t('brief.final1'));
  else if (m.kind === 'final2') lines.push(t('brief.final2'));
  else lines.push(t(k(`brief.std.${(parseRegion(regionId)?.index ?? 0) % 3}`), { region, corp }));
  if (m.hazard) lines.push(t('brief.hazard', { name: hazardName(m.hazard), desc: hazardDesc(m.hazard) }));
  return lines.join(' ');
}

export function objectiveLabel(o: Objective, bossDef = ''): string {
  switch (o.kind) {
    case 'kill':
      return tn('obj.kill.label', o.n);
    case 'block':
      return tn('obj.block.label', o.n);
    case 'lowdmg':
      return t('obj.lowdmg.label', { n: o.n });
    case 'boss':
      return t('obj.boss.label', { boss: bossDef ? unitName(bossDef) : t('battle.leader') });
    default:
      return t(k(`obj.${o.kind}.label`));
  }
}

export function objectiveHint(kind: ObjKind, podTurn = 2): string {
  return t(k(`obj.${kind}.hint`), { turn: podTurn });
}
