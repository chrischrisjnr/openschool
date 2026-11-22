import type { Metadata } from "next";
import type { EventCategory } from "@/db/schema";
import { eventsBetween } from "@/lib/assemble/calendar";
import { EVENT_CATEGORY_KEYS } from "@/lib/assemble/constants";
import { addDays, addMonths, isMonthKey, monthGrid, monthLabel, monthOf, todayKey } from "@/lib/assemble/dates";
import { getViewer } from "@/lib/viewer";
import { CalendarView } from "./CalendarView";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string; category?: string; deleted?: string }>;
}) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const tz = viewer.school.timezone;
  const today = todayKey(tz);
  const view = sp.view === "list" ? "list" : "month";
  const month = isMonthKey(sp.month) ? sp.month : monthOf(today);
  const category = EVENT_CATEGORY_KEYS.includes(sp.category as EventCategory) ? (sp.category as EventCategory) : undefined;

  const weeks = monthGrid(month);
  const from = view === "month" ? weeks[0]![0]! : today;
  const to = view === "month" ? weeks.at(-1)!.at(-1)! : addDays(today, 120);
  const events = eventsBetween(viewer, from, to, category);

  return (
    <CalendarView
      view={view}
      month={month}
      monthLabel={monthLabel(month)}
      prevMonth={addMonths(month, -1)}
      nextMonth={addMonths(month, 1)}
      thisMonth={monthOf(today)}
      weeks={weeks}
      today={today}
      category={category ?? null}
      events={events}
      canCreate={viewer.isStaff}
      deleted={sp.deleted === "1"}
      tz={tz}
    />
  );
}
