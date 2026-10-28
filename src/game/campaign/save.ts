// Persistent storage. Manual saves live in independent localStorage keys so a
// defeat (which only clears the auto-resume slot) never touches them.

import type { BattleState, Campaign, Difficulty } from '../types';
import { SQUADS } from '../data/squads';
import { CAMPAIGN_VERSION } from './campaign';

const PREFIX = 'irongrid.v1';
export const SLOT_COUNT = 6;

export interface SlotMeta {
  savedAt: number;
  label: string;
  secured: number;
  grid: number;
  gridMax: number;
  rep: number;
  cores: number;
  squad: string;
  difficulty: Difficulty;
  pilots: string[];
  playMs: number;
  version: number;
}

export interface SlotData {
  meta: SlotMeta;
  campaign: Campaign;
}

export type SlotRead = { status: 'empty' } | { status: 'ok'; data: SlotData } | { status: 'corrupt'; reason: string };

export interface ResumeData {
  campaign: Campaign;
  battle: BattleState | null;
  regionId: string;
  savedAt: number;
}

let store: Storage | null | undefined;

/** Injects a storage backend (used by tests). */
export function setStorage(st: Storage | null): void {
  store = st;
}

/** The browser's storage if it can be read. Writes may still fail (full quota). */
function storage(): Storage | null {
  if (store !== undefined) return store;
  try {
    const ls = globalThis.localStorage;
    ls.getItem(`${PREFIX}.probe`);
    store = ls;
  } catch {
    store = null;
  }
  return store;
}

/** Whether new saves can be written right now (checked each time; the quota may change). */
export function storageAvailable(): boolean {
  const st = storage();
  if (!st) return false;
  try {
    const probe = `${PREFIX}.probe`;
    st.setItem(probe, '1');
    st.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const slotKey = (i: number): string => `${PREFIX}.slot.${i}`;
const RESUME_KEY = `${PREFIX}.resume`;

const isArr = (v: unknown): v is unknown[] => Array.isArray(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function validCampaign(c: unknown): c is Campaign {
  if (!isObj(c)) return false;
  const o = c as Partial<Campaign>;
  return (
    isNum(o.version) &&
    o.version <= CAMPAIGN_VERSION &&
    typeof o.squad === 'string' &&
    !!SQUADS[o.squad] &&
    isArr(o.mechs) &&
    o.mechs.length === 3 &&
    o.mechs.every((m) => isObj(m) && typeof m.chassis === 'string' && isObj(m.pilot) && isArr(m.weapons)) &&
    isArr(o.islands) &&
    o.islands.every((i) => isObj(i) && isArr(i.regions)) &&
    isArr(o.reserve) &&
    isArr(o.inventory) &&
    isArr(o.shop) &&
    isArr(o.finalMissions) &&
    isArr(o.usedPilots) &&
    isObj(o.stats) &&
    isNum(o.grid) &&
    isNum(o.gridMax) &&
    isNum(o.rng) &&
    typeof o.phase === 'string'
  );
}

function validMeta(m: unknown): m is SlotMeta {
  return (
    isObj(m) &&
    isNum(m.savedAt) &&
    typeof m.label === 'string' &&
    isNum(m.secured) &&
    isNum(m.grid) &&
    isNum(m.gridMax) &&
    isNum(m.rep) &&
    isNum(m.cores) &&
    typeof m.squad === 'string' &&
    typeof m.difficulty === 'string' &&
    isArr(m.pilots) &&
    isNum(m.playMs)
  );
}

/** Structural check for a battle restored from the auto-resume save. */
export function validBattle(b: unknown): b is BattleState {
  if (!isObj(b)) return false;
  const o = b as Partial<BattleState>;
  return (
    isArr(o.tiles) &&
    o.tiles.length === 64 &&
    o.tiles.every((t) => isObj(t) && typeof t.t === 'string') &&
    isArr(o.units) &&
    o.units.every((u) => isObj(u) && isNum(u.id) && isNum(u.x) && isNum(u.y) && isNum(u.hp) && typeof u.def === 'string' && isArr(u.weapons)) &&
    isArr(o.objectives) &&
    isArr(o.deployZone) &&
    isArr(o.spawnPlan) &&
    isArr(o.enemyPool) &&
    isObj(o.stats) &&
    isNum(o.turn) &&
    isNum(o.maxTurns) &&
    isNum(o.grid) &&
    isNum(o.rng) &&
    typeof o.phase === 'string'
  );
}

export function metaFor(c: Campaign, label: string): SlotMeta {
  return {
    savedAt: Date.now(),
    label,
    secured: c.secured,
    grid: c.grid,
    gridMax: c.gridMax,
    rep: c.rep,
    cores: c.cores,
    squad: c.squad,
    difficulty: c.difficulty,
    pilots: c.mechs.map((m) => m.pilot.name),
    playMs: c.playMs,
    version: c.version,
  };
}

export function readSlot(i: number): SlotRead {
  const st = storage();
  if (!st) return { status: 'empty' };
  let raw: string | null;
  try {
    raw = st.getItem(slotKey(i));
  } catch {
    return { status: 'corrupt', reason: 'Storage unavailable' };
  }
  if (!raw) return { status: 'empty' };
  try {
    const data = JSON.parse(raw) as SlotData;
    if (!isObj(data) || !validCampaign(data.campaign)) return { status: 'corrupt', reason: 'Unrecognised save data' };
    // the campaign is what matters; damaged slot metadata is rebuilt from it
    if (!validMeta(data.meta)) {
      const old: Record<string, unknown> = isObj(data.meta) ? data.meta : {};
      data.meta = { ...metaFor(data.campaign, typeof old.label === 'string' ? old.label : ''), savedAt: isNum(old.savedAt) ? old.savedAt : 0 };
    }
    return { status: 'ok', data };
  } catch {
    return { status: 'corrupt', reason: 'Save data is damaged' };
  }
}

export function listSlots(): SlotRead[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => readSlot(i));
}

export function writeSlot(i: number, c: Campaign, label: string): string {
  const st = storage();
  if (!st) return 'Browser storage is unavailable (private mode?)';
  const data: SlotData = { meta: metaFor(c, label), campaign: c };
  try {
    st.setItem(slotKey(i), JSON.stringify(data));
    return '';
  } catch (e) {
    return e instanceof Error && /quota/i.test(e.name + e.message) ? 'Storage is full' : 'Could not write save';
  }
}

/** Deep copy so later play cannot mutate the loaded save in memory. */
export function loadSlot(i: number): Campaign | null {
  const r = readSlot(i);
  if (r.status !== 'ok') return null;
  return structuredClone(r.data.campaign);
}

export function deleteSlot(i: number): void {
  try {
    storage()?.removeItem(slotKey(i));
  } catch {
    /* ignore */
  }
}

export function writeResume(data: ResumeData): void {
  try {
    storage()?.setItem(RESUME_KEY, JSON.stringify(data));
  } catch {
    /* resume is best-effort */
  }
}

export function readResume(): ResumeData | null {
  try {
    const raw = storage()?.getItem(RESUME_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as ResumeData;
    if (!isObj(d) || !validCampaign(d.campaign)) return null;
    if (d.campaign.phase === 'defeat' || d.campaign.phase === 'victory') return null;
    // a damaged battle snapshot falls back to resuming between missions
    if (d.battle != null && !validBattle(d.battle)) d.battle = null;
    if (typeof d.regionId !== 'string') d.regionId = '';
    return d;
  } catch {
    return null;
  }
}

export function clearResume(): void {
  try {
    storage()?.removeItem(RESUME_KEY);
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ settings

export interface Settings {
  sfx: number;
  music: number;
  fast: boolean;
  orderAlways: boolean;
}

const SETTINGS_KEY = `${PREFIX}.settings`;
const DEFAULT_SETTINGS: Settings = { sfx: 0.7, music: 0.35, fast: false, orderAlways: true };

export function loadSettings(): Settings {
  try {
    const raw = storage()?.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* defaults */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings): void {
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
