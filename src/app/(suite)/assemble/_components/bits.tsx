"use client";

/**
 * Small pieces shared by Assemble's views: filter chips, list rows, labels.
 */
import { Label } from "@primer/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import type { EventCategory } from "@/db/schema";
import {
  ATTENDANCE_STATUS,
  EVENT_CATEGORIES,
  itemCategory,
  noticeCategory,
} from "@/lib/assemble/constants";
import styles from "./assemble.module.css";

export function NoticeCategoryLabel({ category }: { category: string }) {
  const c = noticeCategory(category);
  return <Label variant={c.variant}>{c.label}</Label>;
}

export function EventCategoryLabel({ category, size }: { category: EventCategory; size?: "small" | "large" }) {
  const c = EVENT_CATEGORIES[category] ?? EVENT_CATEGORIES.event;
  return (
    <Label variant={c.variant} size={size}>
      {c.label}
    </Label>
  );
}

export function ItemCategoryLabel({ category }: { category: string }) {
  const c = itemCategory(category);
  return <Label variant={c.variant}>{c.label}</Label>;
}

export function AttendanceLabel({ status }: { status: keyof typeof ATTENDANCE_STATUS }) {
  const s = ATTENDANCE_STATUS[status];
  return <Label variant={s.variant}>{s.label}</Label>;
}

/** A row of link "chips" used as filters, e.g. notice categories. */
export function FilterChips({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; current: boolean; count?: number }[];
}) {
  return (
    <nav aria-label={label} className={styles.chips}>
      {items.map((i) => (
        <NextLink
          key={i.href}
          href={i.href}
          className={styles.chip}
          aria-current={i.current ? "true" : undefined}
          scroll={false}
        >
          {i.label}
          {i.count !== undefined ? <span className={styles.chipCount}>{i.count}</span> : null}
        </NextLink>
      ))}
    </nav>
  );
}

/** A list of rows inside a card. */
export function RowList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className={styles.list} aria-label={label}>
      {children}
    </ul>
  );
}

/** One list row; pass `href` to make the whole row a link. */
export function Row({
  href,
  leading,
  title,
  meta,
  trailing,
  unread,
}: {
  href?: string;
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  unread?: boolean;
}) {
  const body = (
    <>
      {leading ? <span className={styles.rowLeading}>{leading}</span> : null}
      <span className={styles.rowMain}>
        <span className={styles.rowTitle} data-unread={unread || undefined}>
          {unread ? (
            <span className={styles.unreadDot}>
              <span className="sr-only">Unread: </span>
            </span>
          ) : null}
          {title}
        </span>
        {meta ? <span className={styles.rowMeta}>{meta}</span> : null}
      </span>
      {trailing ? <span className={styles.rowTrailing}>{trailing}</span> : null}
    </>
  );
  return (
    <li className={styles.rowItem}>
      {href ? (
        <NextLink href={href} className={`${styles.row} ${styles.rowLink}`}>
          {body}
        </NextLink>
      ) : (
        <div className={styles.row}>{body}</div>
      )}
    </li>
  );
}

/** Date "tile" with weekday, day and month, used in agenda lists. */
export function DateTile({ weekday, day, month, tone }: { weekday: string; day: string; month: string; tone?: "today" }) {
  return (
    <span className={styles.dateTile} data-tone={tone} aria-hidden>
      <span className={styles.dateTileWeekday}>{weekday}</span>
      <span className={styles.dateTileDay}>{day}</span>
      <span className={styles.dateTileMonth}>{month}</span>
    </span>
  );
}

/** Small inline meta separator list: "Year 6 · Mr Reyes · 2 days ago". */
export function Meta({ parts }: { parts: (ReactNode | null | undefined | false)[] }) {
  const shown = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "");
  return (
    <>
      {shown.map((p, i) => (
        <span key={i}>
          {i > 0 ? <span className={styles.metaSep} aria-hidden> · </span> : null}
          {p}
        </span>
      ))}
    </>
  );
}

/** A horizontal progress meter with an accessible label. */
export function Meter({ value, max, label, tone = "accent" }: { value: number; max: number; label: string; tone?: "accent" | "success" | "attention" }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <span className={styles.meter} role="img" aria-label={`${label}: ${pct}%`} data-tone={tone}>
      <span className={styles.meterFill} style={{ width: `${pct}%` }} />
    </span>
  );
}
