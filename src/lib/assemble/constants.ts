/**
 * Labels and colours shared by Assemble's server pages and client views.
 * Safe to import anywhere (no server-only code).
 */
import type { LabelColorOptions } from "@primer/react";
import type { AbsenceReason, AttendanceStatus, EventCategory } from "@/db/schema";

export type CategoryMeta = { label: string; variant: LabelColorOptions };

export const NOTICE_CATEGORIES = {
  general: { label: "General", variant: "secondary" },
  learning: { label: "Learning", variant: "accent" },
  events: { label: "Events", variant: "done" },
  health: { label: "Health & safety", variant: "attention" },
  sport: { label: "Sport", variant: "success" },
  community: { label: "Community", variant: "sponsors" },
  urgent: { label: "Urgent", variant: "danger" },
} as const satisfies Record<string, CategoryMeta>;
export type NoticeCategory = keyof typeof NOTICE_CATEGORIES;
export const NOTICE_CATEGORY_KEYS = Object.keys(NOTICE_CATEGORIES) as NoticeCategory[];
export const noticeCategory = (c: string): CategoryMeta =>
  (NOTICE_CATEGORIES as Record<string, CategoryMeta>)[c] ?? NOTICE_CATEGORIES.general;

export const EVENT_CATEGORIES = {
  event: { label: "School event", variant: "accent" },
  excursion: { label: "Excursion", variant: "success" },
  sport: { label: "Sport", variant: "attention" },
  meeting: { label: "Meeting", variant: "done" },
  holiday: { label: "Holiday", variant: "severe" },
  term: { label: "Term dates", variant: "sponsors" },
} as const satisfies Record<EventCategory, CategoryMeta>;
export const EVENT_CATEGORY_KEYS = Object.keys(EVENT_CATEGORIES) as EventCategory[];

export const ITEM_CATEGORIES = {
  excursion: { label: "Excursion", variant: "success" },
  incursion: { label: "Incursion", variant: "accent" },
  camp: { label: "Camp", variant: "done" },
  sport: { label: "Sport", variant: "attention" },
  levy: { label: "Levy", variant: "secondary" },
  event: { label: "Event", variant: "sponsors" },
  consent: { label: "Consent", variant: "severe" },
  other: { label: "Other", variant: "secondary" },
} as const satisfies Record<string, CategoryMeta>;
export type ItemCategory = keyof typeof ITEM_CATEGORIES;
export const ITEM_CATEGORY_KEYS = Object.keys(ITEM_CATEGORIES) as ItemCategory[];
export const itemCategory = (c: string): CategoryMeta =>
  (ITEM_CATEGORIES as Record<string, CategoryMeta>)[c] ?? ITEM_CATEGORIES.other;

export const ABSENCE_REASONS: Record<AbsenceReason, string> = {
  illness: "Sick",
  medical: "Medical or dental appointment",
  family: "Family reasons",
  holiday: "Family holiday",
  other: "Other",
};
export const ABSENCE_REASON_KEYS = Object.keys(ABSENCE_REASONS) as AbsenceReason[];

export const ATTENDANCE_STATUS = {
  present: { label: "Present", variant: "success" },
  late: { label: "Late", variant: "attention" },
  absent: { label: "Absent", variant: "danger" },
  excused: { label: "Excused", variant: "accent" },
} as const satisfies Record<AttendanceStatus, CategoryMeta>;
