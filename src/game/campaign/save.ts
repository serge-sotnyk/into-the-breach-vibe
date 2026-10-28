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

function storage(): Storage | null {
  if (store !== undefined) return store;
  try {
    const ls = globalThis.localStorage;
    const probe = `${PREFIX}.probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    store = ls;
  } catch {
    store = null;
  }
  return store;
}

export function storageAvailable(): boolean {
  return !!storage();
}

const slotKey = (i: number): string => `${PREFIX}.slot.${i}`;
const RESUME_KEY = `${PREFIX}.resume`;

export function validCampaign(c: unknown): c is Campaign {
  if (!c || typeof c !== 'object') return false;
  const o = c as Partial<Campaign>;
  return (
    typeof o.version === 'number' &&
    o.version <= CAMPAIGN_VERSION &&
    typeof o.squad === 'string' &&
    !!SQUADS[o.squad] &&
    Array.isArray(o.mechs) &&
    o.mechs.length === 3 &&
    Array.isArray(o.islands) &&
    typeof o.grid === 'number' &&
    typeof o.gridMax === 'number' &&
    typeof o.rng === 'number' &&
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
    if (!data || !data.meta || !validCampaign(data.campaign)) return { status: 'corrupt', reason: 'Unrecognised save data' };
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
    if (!validCampaign(d.campaign)) return null;
    if (d.campaign.phase === 'defeat' || d.campaign.phase === 'victory') return null;
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
