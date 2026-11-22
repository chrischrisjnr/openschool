/**
 * Calendar-day helpers for Assemble. Days are "YYYY-MM-DD" strings in the
 * school's timezone (see dayKey() in lib/format). Safe on server and client.
 */
import { DEFAULT_TIMEZONE, dayKey, formatDate, formatLongDate, formatShortDate } from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isDayKey = (s: unknown): s is string =>
  typeof s === "string" && KEY_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

const keyToUtc = (key: string) => Date.parse(`${key}T00:00:00Z`);
const utcToKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (key: string, n: number) => utcToKey(keyToUtc(key) + n * DAY_MS);
export const daysBetween = (from: string, to: string) => Math.round((keyToUtc(to) - keyToUtc(from)) / DAY_MS);
/** 0 = Sunday … 6 = Saturday */
export const weekdayOf = (key: string) => new Date(keyToUtc(key)).getUTCDay();
export const isWeekend = (key: string) => weekdayOf(key) === 0 || weekdayOf(key) === 6;

/** The most recent weekday on or before `key`. */
export function lastWeekday(key: string): string {
  let k = key;
  while (isWeekend(k)) k = addDays(k, -1);
  return k;
}
/** The next weekday on or after `key`. */
export function nextWeekday(key: string): string {
  let k = key;
  while (isWeekend(k)) k = addDays(k, 1);
  return k;
}

/** Offset (ms) of a timezone from UTC at a given instant. */
function tzOffset(at: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(at));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at / 1000) * 1000;
}

/** The instant a wall-clock time occurs in the school's timezone. */
export function zonedTime(key: string, time = "00:00", timeZone = DEFAULT_TIMEZONE): Date {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const wall = keyToUtc(key) + (h * 60 + m) * 60 * 1000;
  let guess = wall - tzOffset(wall, timeZone);
  guess = wall - tzOffset(guess, timeZone);
  return new Date(guess);
}

/** "HH:MM" wall-clock time of an instant in the school's timezone. */
export function timeOfDay(d: Date | number, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(d),
  );
}

/** Midday on a day — handy for formatting a day key with the format helpers. */
const noon = (key: string, tz?: string) => zonedTime(key, "12:00", tz);
export const formatKeyShort = (key: string, tz?: string) => formatShortDate(noon(key, tz), tz);
export const formatKeyLong = (key: string, tz?: string) => formatLongDate(noon(key, tz), tz);
export const formatKey = (key: string, tz?: string) => formatDate(noon(key, tz), tz);

/** "Mon 3 – Fri 7 Mar" style range for two day keys. */
export function formatKeyRange(from: string, to: string, tz?: string): string {
  if (from === to) return formatKeyShort(from, tz);
  return `${formatKeyShort(from, tz)} – ${formatKeyShort(to, tz)}`;
}

export const todayKey = (tz = DEFAULT_TIMEZONE) => dayKey(new Date(), tz);

/* ------------------------------------------------------------------ */
/* School terms                                                        */
/* ------------------------------------------------------------------ */

export type Term = { label: string; start: string; end: string };

/**
 * Victorian government school term dates. Schools in other states can edit
 * this list (a future settings page will let admins manage it).
 */
export const TERMS: Term[] = [
  { label: "Term 1 2026", start: "2026-01-28", end: "2026-04-02" },
  { label: "Term 2 2026", start: "2026-04-20", end: "2026-06-26" },
  { label: "Term 3 2026", start: "2026-07-13", end: "2026-09-18" },
  { label: "Term 4 2026", start: "2026-10-05", end: "2026-12-18" },
  { label: "Term 1 2027", start: "2027-01-28", end: "2027-03-25" },
  { label: "Term 2 2027", start: "2027-04-12", end: "2027-06-25" },
  { label: "Term 3 2027", start: "2027-07-12", end: "2027-09-17" },
  { label: "Term 4 2027", start: "2027-10-04", end: "2027-12-17" },
];

/**
 * The term containing `key`, or the most recent one during the holidays.
 * Falls back to the last ten weeks when the date is outside the known terms.
 */
export function termFor(key: string): Term {
  const current = TERMS.find((t) => t.start <= key && key <= t.end);
  if (current) return current;
  const past = TERMS.filter((t) => t.end < key).at(-1);
  if (past && daysBetween(past.end, key) < 60) return past;
  return { label: "Last 10 weeks", start: addDays(key, -70), end: key };
}

/* ------------------------------------------------------------------ */
/* Months                                                              */
/* ------------------------------------------------------------------ */

export const isMonthKey = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const monthOf = (key: string) => key.slice(0, 7);
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/** Weeks (Monday first) covering a month, as arrays of 7 day keys. */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const start = addDays(first, -((weekdayOf(first) + 6) % 7));
  const weeks: string[][] = [];
  let k = start;
  do {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(k);
      k = addDays(k, 1);
    }
    weeks.push(week);
  } while (monthOf(k) === month);
  return weeks;
}
