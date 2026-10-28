import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { uk } from '../src/i18n/uk';
import { LANGS, setLang, t, tn, type Plural, type StrKey } from '../src/i18n';
import { missionBriefing, regionName, upgradeText } from '../src/i18n/names';
import { UNITS } from '../src/game/data/units';
import { WEAPONS } from '../src/game/data/weapons';
import { SKILLS } from '../src/game/data/pilots';
import { SQUADS } from '../src/game/data/squads';
import { HAZARDS, ISLANDS } from '../src/game/data/islands';
import { DIFFICULTY, enterIsland, newCampaign } from '../src/game/campaign/campaign';
import { loadSlot, setStorage, writeSlot } from '../src/game/campaign/save';
import type { MissionSpec } from '../src/game/types';
import { memoryStorage } from './helpers';

type Entry = string | Plural;
const DICTS: Record<string, Record<string, Entry>> = { uk };
const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (s: string): string[] => [...s.matchAll(/<[^>]+>/g)].map((m) => m[0]).sort();
const forms = (v: Entry): string[] => (typeof v === 'string' ? [v] : Object.values(v).filter((f): f is string => f !== undefined));
const reference = (v: Entry): string => (typeof v === 'string' ? v : v.other);

afterEach(() => setLang('en'));

describe('translations', () => {
  it('every language is registered and complete', () => {
    expect(LANGS.map((l) => l.id).sort()).toEqual(['en', ...Object.keys(DICTS)].sort());
    for (const dict of Object.values(DICTS)) expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
  });

  for (const [lang, dict] of Object.entries(DICTS)) {
    it(`${lang}: placeholders, markup and plural forms match English`, () => {
      const enDict = en as Record<string, Entry>;
      for (const key of Object.keys(en)) {
        const src = reference(enDict[key]);
        const dst = dict[key];
        expect(typeof dst, key).toBe(typeof enDict[key]);
        if (typeof dst !== 'string') for (const f of ['one', 'few', 'many', 'other'] as const) expect(dst[f], `${key}.${f}`).toBeTypeOf('string');
        for (const f of forms(dst)) {
          expect(f.trim(), key).not.toBe('');
          expect(placeholders(f), key).toEqual(placeholders(src));
          expect(tags(f), key).toEqual(tags(src));
          // quotes and markup characters outside tags would break attributes and innerHTML
          expect(f.replace(/<[^>]+>/g, ''), key).not.toMatch(/["<>&]/);
        }
      }
    });
  }

  it('Ukrainian plural forms follow the 1 / 2–4 / 5+ rule', () => {
    setLang('uk');
    const f = uk['hud.survive'];
    const expected: [number, keyof Plural][] = [[1, 'one'], [2, 'few'], [4, 'few'], [5, 'many'], [11, 'many'], [21, 'one'], [22, 'few'], [25, 'many']];
    for (const [n, form] of expected) expect(tn('hud.survive', n)).toBe(f[form]!.replace('{n}', String(n)));
  });

  it('fills placeholders and shows unknown keys as-is', () => {
    expect(t('battle.turnOf', { turn: 2, max: 5 })).toBe('Turn 2 of 5');
    expect(tn('hud.survive', 1)).toBe('Survive 1 turn');
    expect(tn('hud.survive', 4)).toBe('Survive 4 turns');
    expect(t('no.such.key' as StrKey)).toBe('no.such.key');
  });

  it('every piece of game data has its text', () => {
    const keys = new Set(Object.keys(en));
    const need = (k: string): void => expect(keys.has(k), k).toBe(true);
    for (const u of Object.values(UNITS)) {
      need(`unit.${u.id}.name`);
      need(`unit.${u.id}.desc`);
      if (u.cls) need(`class.${u.cls}`);
    }
    for (const w of Object.values(WEAPONS)) {
      need(`weapon.${w.id}.name`);
      need(`weapon.${w.id}.desc`);
      w.up.forEach((up, i) => {
        if (up.tpl) return;
        need(`weapon.${w.id}.up.${i}.name`);
        need(`weapon.${w.id}.up.${i}.desc`);
      });
    }
    for (const id of Object.keys(SKILLS)) ['name', 'desc'].forEach((f) => need(`skill.${id}.${f}`));
    for (const id of Object.keys(SQUADS)) ['name', 'tagline', 'desc', 'difficulty'].forEach((f) => need(`squad.${id}.${f}`));
    for (const isl of ISLANDS) {
      ['name', 'corp', 'desc', 'hq'].forEach((f) => need(`island.${isl.id}.${f}`));
      for (let i = 0; i < isl.regions; i++) need(`island.${isl.id}.region.${i}`);
    }
    ['name', 'desc'].forEach((f) => need(`island.caldera.${f}`));
    for (const id of Object.keys(HAZARDS)) ['name', 'desc'].forEach((f) => need(`hazard.${id}.${f}`));
    for (const id of Object.keys(DIFFICULTY)) ['name', 'desc'].forEach((f) => need(`difficulty.${id}.${f}`));
    for (const k of ['kill', 'relay', 'lab', 'lowdmg', 'block', 'pod', 'tank', 'boss', 'bomb', 'uplink']) ['label', 'hint'].forEach((f) => need(`obj.${k}.${f}`));
    for (const k of ['ground', 'rubble', 'building', 'mountain', 'water', 'chasm', 'forest', 'sand', 'ice', 'lava']) ['name', 'desc'].forEach((f) => need(`terrain.${k}.${f}`));
    for (const w of Object.values(WEAPONS)) w.up.forEach((_, i) => expect(upgradeText(w.id, i).name).not.toMatch(/^weapon\./));
  });

  it('region names and briefings resolve on every island, in every language', () => {
    for (const lang of LANGS) {
      setLang(lang.id);
      for (const isl of ISLANDS) {
        const ids = [...Array.from({ length: isl.regions }, (_, i) => `${isl.id}-${i}`), `${isl.id}-hq`];
        for (const id of ids) {
          expect(regionName(id), id).not.toBe('');
          const spec = { kind: id.endsWith('hq') ? 'boss' : 'standard', boss: isl.boss, hazard: isl.hazards[0], theme: isl.id } as MissionSpec;
          const text = missionBriefing(spec, id);
          expect(text, id).not.toMatch(/[{}]|brief\.|island\./);
          expect(text).toContain(regionName(id));
        }
      }
      for (const kind of ['final1', 'final2'] as const) {
        const text = missionBriefing({ kind, boss: 'boss_tyrant', hazard: kind === 'final1' ? 'volcanic' : '', theme: 'caldera' } as MissionSpec, '');
        expect(text).not.toMatch(/[{}]|brief\./);
      }
    }
  });

  it('saves from before translations (with English names stored) load and show the current language', () => {
    setStorage(memoryStorage());
    const c = newCampaign('ironclad', 'normal', 9);
    enterIsland(c, 0);
    // older saves stored display names and composed briefings alongside the ids
    for (const r of c.islands[0].regions) Object.assign(r, { name: 'Old Orchard' }, r.mission ? { mission: { ...r.mission, name: 'Old Orchard', briefing: 'Vek are tunnelling up.' } } : {});
    expect(writeSlot(0, c, 'Legacy')).toBe('');
    const loaded = loadSlot(0)!;
    setLang('uk');
    const r = loaded.islands[0].regions[0];
    expect(regionName(r.id)).toBe(uk['island.verdant.region.0']);
    expect(missionBriefing(r.mission!, r.id)).toContain(uk['island.verdant.region.0']);
  });
});
