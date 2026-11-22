/**
 * Formatting helpers. Safe to use in both server and client components.
 * Everything is Australian English, AUD and (by default) Melbourne time.
 */

export const DEFAULT_TIMEZONE = "Australia/Melbourne";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
const moneyWhole = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

/** 12345 → "$123.45". Pass `{ whole: true }` to drop cents when they're zero. */
export function formatMoney(cents: number, opts: { whole?: boolean } = {}): string {
  if (opts.whole && cents % 100 === 0) return moneyWhole.format(cents / 100);
  return money.format(cents / 100);
}

/** "$12.50" / "12.5" / "12" → cents, or null if not a valid positive amount. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return Number.isFinite(cents) ? cents : null;
}

type DateInput = Date | number | string;
const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d));

function fmt(d: DateInput, options: Intl.DateTimeFormatOptions, timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat("en-AU", { timeZone, ...options }).format(toDate(d));
}

/** "Mon 3 Mar" */
export const formatShortDate = (d: DateInput, tz?: string) =>
  fmt(d, { weekday: "short", day: "numeric", month: "short" }, tz);

/** "Monday 3 March 2026" */
export const formatLongDate = (d: DateInput, tz?: string) =>
  fmt(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, tz);

/** "3 Mar 2026" */
export const formatDate = (d: DateInput, tz?: string) =>
  fmt(d, { day: "numeric", month: "short", year: "numeric" }, tz);

/** "9:30 am" */
export const formatTime = (d: DateInput, tz?: string) =>
  fmt(d, { hour: "numeric", minute: "2-digit", hour12: true }, tz).replace(/\s?([ap])\.?m\.?/i, " $1m");

/** "Mon 3 Mar, 9:30 am" */
export const formatDateTime = (d: DateInput, tz?: string) =>
  `${formatShortDate(d, tz)}, ${formatTime(d, tz)}`;

/** Calendar day key "YYYY-MM-DD" for a moment, in the school's timezone. */
export function dayKey(d: DateInput = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(toDate(d));
  return parts; // en-CA formats as YYYY-MM-DD
}

/** "just now", "5 min ago", "3 hours ago", "yesterday", "3 Mar". */
export function formatRelative(d: DateInput, now: Date = new Date(), tz?: string): string {
  const date = toDate(d);
  const diff = now.getTime() - date.getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60000);
  if (min < 1) return future ? "in a moment" : "just now";
  if (min < 60) return future ? `in ${min} min` : `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return future ? `in ${hrs} hr${hrs === 1 ? "" : "s"}` : `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return future ? "tomorrow" : "yesterday";
  if (days < 7) return future ? `in ${days} days` : `${days} days ago`;
  return formatShortDate(date, tz);
}

/** Year level label. 0 is the first year of school, which differs by state. */
export function yearLabel(year: number, state = "VIC"): string {
  if (year > 0) return `Year ${year}`;
  switch (state) {
    case "NSW":
    case "ACT":
      return "Kindergarten";
    case "QLD":
    case "WA":
      return "Prep";
    case "SA":
      return "Reception";
    case "TAS":
      return "Prep";
    case "NT":
      return "Transition";
    default:
      return "Foundation";
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

export function pluralise(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
