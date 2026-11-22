/** Date helpers for campaigns. Pure (Intl only), safe on server and client. */
import { DEFAULT_TIMEZONE, dayKey } from "@/lib/format";

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Midnight at the start of a YYYY-MM-DD day in the school's timezone. */
export function startOfDay(day: string, timeZone = DEFAULT_TIMEZONE): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - tzOffsetMs(new Date(guess), timeZone);
  // Re-check once in case the offset differs either side of a DST change.
  t = guess - tzOffsetMs(new Date(t), timeZone);
  return new Date(t);
}

/** The last millisecond of a YYYY-MM-DD day in the school's timezone. */
export function endOfDay(day: string, timeZone = DEFAULT_TIMEZONE): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return new Date(startOfDay(next, timeZone).getTime() - 1);
}

/** Whole days remaining until `endsAt` (0 on the final day, null once over). */
export function daysLeft(endsAt: Date, now = new Date(), timeZone = DEFAULT_TIMEZONE): number | null {
  if (now.getTime() > endsAt.getTime()) return null;
  const a = startOfDay(dayKey(now, timeZone), timeZone).getTime();
  const b = startOfDay(dayKey(endsAt, timeZone), timeZone).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function daysLeftLabel(endsAt: Date, now = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  const n = daysLeft(endsAt, now, timeZone);
  if (n === null) return "Finished";
  if (n === 0) return "Last day!";
  if (n === 1) return "1 day left";
  return `${n} days left`;
}
