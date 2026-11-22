"use client";

import { useSyncExternalStore } from "react";
import { formatLongDate, formatShortDate, formatTime } from "@/lib/format";

/* A single shared minute ticker for every timestamp on the page. */
let now = typeof window === "undefined" ? 0 : Date.now();
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  now = Date.now();
  for (const s of subscribers) s();
}

function subscribe(cb: () => void) {
  subscribers.add(cb);
  if (!timer) {
    timer = setInterval(tick, 30_000);
    queueMicrotask(tick);
  }
  return () => {
    subscribers.delete(cb);
    if (!subscribers.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/**
 * The current time, refreshed every 30 seconds — or null during server
 * rendering and hydration so the first render is identical on both sides.
 */
export function useNow(): number | null {
  const value = useSyncExternalStore(
    subscribe,
    () => now,
    () => 0,
  );
  return value || null;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "just now", "5 min ago", "2 hr ago", then the clock time / date. */
export function relativeLabel(at: number, current: number | null, short = false): string {
  if (current === null) return short ? formatShortDate(at) : formatTime(at);
  const diff = current - at;
  if (diff < MIN) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)} min${short ? "" : " ago"}`;
  if (diff < 12 * HOUR) {
    const h = Math.floor(diff / HOUR);
    return short ? `${h} hr` : `${h} hr${h === 1 ? "" : "s"} ago`;
  }
  if (diff < 6 * DAY && !short) return formatTime(at);
  if (diff < 6 * DAY) return new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "Australia/Melbourne" }).format(at);
  return short ? formatShortDate(at) : formatTime(at);
}

export function RelativeTime({ at, short = false }: { at: number; short?: boolean }) {
  const current = useNow();
  return (
    <time dateTime={new Date(at).toISOString()} title={`${formatLongDate(at)}, ${formatTime(at)}`}>
      {relativeLabel(at, current, short)}
    </time>
  );
}
