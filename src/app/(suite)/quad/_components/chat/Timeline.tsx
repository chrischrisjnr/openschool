"use client";

import { Button } from "@primer/react";
import { Fragment } from "react";
import { dayKey, formatLongDate } from "@/lib/format";
import type { MessageDTO } from "@/lib/quad/types";
import { MessageItem, PendingItem } from "./MessageItem";
import type { PendingMessage } from "./store";
import styles from "./chat.module.css";

const COLLAPSE_MS = 5 * 60 * 1000;

type Entry =
  | { type: "message"; message: MessageDTO; collapsed: boolean }
  | { type: "pending"; pending: PendingMessage; collapsed: boolean }
  | { type: "new" };

type Day = { key: string; label: string; entries: Entry[] };

export function dayLabel(key: string, at: number, todayKey: string, yesterdayKey: string): string {
  if (key === todayKey) return "Today";
  if (key === yesterdayKey) return "Yesterday";
  const label = formatLongDate(at);
  return key.slice(0, 4) === todayKey.slice(0, 4) ? label.replace(/ \d{4}$/, "") : label;
}

/** Groups messages by day, collapsing runs by the same person. */
export function buildDays(
  messages: MessageDTO[],
  pending: PendingMessage[],
  opts: { now: number; firstUnreadId?: string | null; viewerId: string },
): Day[] {
  const todayKey = dayKey(opts.now);
  const yesterdayKey = dayKey(opts.now - 24 * 60 * 60 * 1000);
  const days: Day[] = [];
  let prev: { authorId: string; at: number; deleted: boolean } | null = null;

  const push = (at: number, entry: (collapsed: boolean) => Entry, authorId: string, deleted: boolean, isNew: boolean) => {
    const key = dayKey(at);
    let day = days.at(-1);
    if (!day || day.key !== key) {
      day = { key, label: dayLabel(key, at, todayKey, yesterdayKey), entries: [] };
      days.push(day);
      prev = null;
    }
    if (isNew) {
      day.entries.push({ type: "new" });
      prev = null;
    }
    const p = prev as typeof prev;
    const collapsed = !!p && !p.deleted && !deleted && p.authorId === authorId && at - p.at < COLLAPSE_MS;
    day.entries.push(entry(collapsed));
    prev = { authorId, at, deleted };
  };

  for (const m of messages) {
    push(
      m.createdAt,
      (collapsed) => ({ type: "message", message: m, collapsed }),
      m.author.id,
      !!m.deleted,
      m.id === opts.firstUnreadId,
    );
  }
  for (const p of pending) {
    push(p.createdAt, (collapsed) => ({ type: "pending", pending: p, collapsed }), opts.viewerId, false, false);
  }
  return days;
}

export function Timeline({
  days,
  highlightId,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onRetry,
  onDiscard,
  inThread = false,
}: {
  days: Day[];
  highlightId?: string | null;
  hasMore?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  onRetry: (p: PendingMessage) => void;
  onDiscard: (p: PendingMessage) => void;
  inThread?: boolean;
}) {
  return (
    <>
      {hasMore && onLoadOlder ? (
        <div className={styles.loadOlder}>
          <Button size="small" onClick={onLoadOlder} loading={loadingOlder}>
            Show earlier messages
          </Button>
        </div>
      ) : null}
      {days.map((day) => (
        <section key={day.key} className={styles.day} aria-label={day.label}>
          <h2 className={styles.dayDivider} data-thread={inThread || undefined}>
            <span>{day.label}</span>
          </h2>
          {day.entries.map((entry, i) => (
            <Fragment key={entry.type === "message" ? entry.message.id : entry.type === "pending" ? entry.pending.nonce : `new-${i}`}>
              {entry.type === "new" ? (
                <div className={styles.newDivider} id="new-messages" role="separator" aria-label="New messages">
                  <span>New messages</span>
                </div>
              ) : entry.type === "message" ? (
                <MessageItem
                  message={entry.message}
                  collapsed={entry.collapsed}
                  inThread={inThread}
                  highlighted={entry.message.id === highlightId}
                />
              ) : (
                <PendingItem
                  pending={entry.pending}
                  collapsed={entry.collapsed}
                  onRetry={() => onRetry(entry.pending)}
                  onDiscard={() => onDiscard(entry.pending)}
                />
              )}
            </Fragment>
          ))}
        </section>
      ))}
    </>
  );
}
