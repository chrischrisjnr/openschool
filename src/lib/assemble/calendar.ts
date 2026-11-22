import "server-only";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { events, paymentItems, type EventCategory } from "@/db/schema";
import { dayKey } from "@/lib/format";
import { audienceWhere, canSeeAudience, type Viewer } from "@/lib/viewer";
import { audienceLabeler } from "./audience";
import { addDays, zonedTime } from "./dates";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  category: EventCategory;
  allDay: boolean;
  startsAt: Date;
  endsAt: Date;
  /** First and last calendar day the event touches (inclusive). */
  startDay: string;
  endDay: string;
  audience: string;
};

type EventRow = typeof events.$inferSelect;

/** All-day events are stored with an exclusive end (midnight after the last day). */
export function eventDays(e: Pick<EventRow, "startsAt" | "endsAt" | "allDay">, tz: string) {
  const startDay = dayKey(e.startsAt, tz);
  const endDay = dayKey(new Date(e.endsAt.getTime() - (e.allDay ? 1 : 0)), tz);
  return { startDay, endDay: endDay < startDay ? startDay : endDay };
}

function toCalendarEvent(e: EventRow, tz: string, label: (t: EventRow["audienceType"], id: string | null) => string): CalendarEvent {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    category: e.category,
    allDay: e.allDay,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    ...eventDays(e, tz),
    audience: label(e.audienceType, e.audienceId),
  };
}

/** Events overlapping [fromDay, toDay] (inclusive day keys) the viewer can see. */
export function eventsBetween(
  viewer: Viewer,
  fromDay: string,
  toDay: string,
  category?: EventCategory,
): CalendarEvent[] {
  const tz = viewer.school.timezone;
  const from = zonedTime(fromDay, "00:00", tz);
  const to = zonedTime(addDays(toDay, 1), "00:00", tz);
  const label = audienceLabeler(viewer.schoolId, viewer.school.state);
  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.schoolId, viewer.schoolId),
        lt(events.startsAt, to),
        gt(events.endsAt, from),
        category ? eq(events.category, category) : undefined,
        audienceWhere(viewer, events.audienceType, events.audienceId),
      ),
    )
    .orderBy(asc(events.startsAt), asc(events.title))
    .all()
    .map((e) => toCalendarEvent(e, tz, label));
}

/** Upcoming events (from today) the viewer can see. */
export function upcomingEvents(viewer: Viewer, days: number, category?: EventCategory) {
  const today = dayKey(new Date(), viewer.school.timezone);
  return eventsBetween(viewer, today, addDays(today, days - 1), category);
}

export function getEvent(viewer: Viewer, id: string) {
  const e = db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.schoolId, viewer.schoolId)))
    .get();
  if (!e || !canSeeAudience(viewer, e.audienceType, e.audienceId)) return null;
  const label = audienceLabeler(viewer.schoolId, viewer.school.state);
  const items = db
    .select({ id: paymentItems.id, title: paymentItems.title, amountCents: paymentItems.amountCents, requiresConsent: paymentItems.requiresConsent })
    .from(paymentItems)
    .where(and(eq(paymentItems.eventId, e.id), eq(paymentItems.closed, false)))
    .all();
  return { event: toCalendarEvent(e, viewer.school.timezone, label), raw: e, items };
}
