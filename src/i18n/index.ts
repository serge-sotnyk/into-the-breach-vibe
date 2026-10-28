// Translations. English (en.ts) is the source of every key; other languages mirror it
// and the type checker rejects a missing, extra or wrongly shaped entry.

import { en } from './en';
import { uk } from './uk';

/** Plural forms, as named by Intl.PluralRules. English needs one/other. */
export interface Plural {
  one: string;
  few?: string;
  many?: string;
  other: string;
}

type En = typeof en;
export type Key = keyof En;
export type StrKey = { [K in Key]: En[K] extends string ? K : never }[Key];
export type PluralKey = Exclude<Key, StrKey>;
/** A complete translation; `P` is the set of plural forms the language uses. */
export type Dict<P extends Plural = Plural> = { [K in Key]: En[K] extends string ? string : P };
export type Params = Record<string, string | number>;

export const LANGS = [
  { id: 'en', name: 'English', short: 'EN' },
  { id: 'uk', name: 'Українська', short: 'УКР' },
] as const;
export type Lang = (typeof LANGS)[number]['id'];

const DICTS: Record<Lang, Dict> = { en, uk };
let lang: Lang = 'en';
let rules = new Intl.PluralRules('en');

export function isLang(v: unknown): v is Lang {
  return LANGS.some((l) => l.id === v);
}

export function getLang(): Lang {
  return lang;
}

/** The first browser language we have a translation for. */
export function detectLang(): Lang {
  const list = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  for (const l of list) {
    const base = String(l).toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

export function setLang(l: Lang): void {
  lang = l;
  rules = new Intl.PluralRules(l);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = l;
    document.title = t('meta.title');
  }
}

function fill(s: string, p?: Params): string {
  return p ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in p ? String(p[k]) : m)) : s;
}

/** The text for `key` in the current language, with `{name}` placeholders filled from `p`. */
export function t(key: StrKey, p?: Params): string {
  const s = (DICTS[lang][key] ?? en[key]) as string | undefined;
  return fill(s ?? key, p);
}

/** The plural form of `key` for `n`; `{n}` is filled automatically. */
export function tn(key: PluralKey, n: number, p?: Params): string {
  const forms = (DICTS[lang][key] ?? en[key]) as Plural | undefined;
  if (!forms) return key;
  const form = forms[rules.select(n) as keyof Plural] ?? forms.other;
  return fill(form, { n, ...p });
}

/** Text for a message key that may be singular or plural (see `Note` in game/types). */
export function msg(key: Key | '', n = 0, p?: Params): string {
  if (!key) return '';
  return typeof en[key] === 'string' ? t(key as StrKey, p) : tn(key as PluralKey, n, p);
}

/** Play time, e.g. "1h 05m". */
export function fmtTime(ms: number): string {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? t('time.hm', { h, m: String(m % 60).padStart(2, '0') }) : t('time.m', { m });
}

export function fmtDate(at: number): string {
  return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(at));
}
