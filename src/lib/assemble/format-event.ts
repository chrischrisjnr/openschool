import { formatTime } from "@/lib/format";
import { formatKeyRange, formatKeyShort } from "./dates";

type When = { allDay: boolean; startsAt: Date | string; endsAt: Date | string; startDay: string; endDay: string };

/** Human "when" for an event, e.g. "Fri 4 Dec · 6:00 pm – 8:30 pm" or "Mon 7 – Fri 11 Dec". */
export function formatEventWhen(e: When, tz?: string, opts: { withDate?: boolean } = {}): string {
  const withDate = opts.withDate ?? true;
  if (e.allDay) {
    if (e.startDay !== e.endDay) return formatKeyRange(e.startDay, e.endDay, tz);
    return withDate ? `${formatKeyShort(e.startDay, tz)} · All day` : "All day";
  }
  const time = `${formatTime(e.startsAt, tz)} – ${formatTime(e.endsAt, tz)}`;
  if (e.startDay !== e.endDay) return `${formatKeyShort(e.startDay, tz)}, ${formatTime(e.startsAt, tz)} – ${formatKeyShort(e.endDay, tz)}, ${formatTime(e.endsAt, tz)}`;
  return withDate ? `${formatKeyShort(e.startDay, tz)} · ${time}` : time;
}

/** Just the time part for compact lists: "9:00 am" or "All day". */
export function formatEventTime(e: When, tz?: string): string {
  if (e.allDay) return e.startDay !== e.endDay ? "Multi-day" : "All day";
  return formatTime(e.startsAt, tz);
}
