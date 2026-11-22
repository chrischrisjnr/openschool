"use client";

import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "@primer/octicons-react";
import { Banner, IconButton, LinkButton, SegmentedControl } from "@primer/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { EventCategory } from "@/db/schema";
import { ButtonLink, EmptyState, PageTitle } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import type { CalendarEvent } from "@/lib/assemble/calendar";
import { EVENT_CATEGORIES, EVENT_CATEGORY_KEYS } from "@/lib/assemble/constants";
import { formatKeyLong, monthOf } from "@/lib/assemble/dates";
import { formatEventTime } from "@/lib/assemble/format-event";
import { EventAgenda } from "../_components/EventAgenda";
import shared from "../_components/assemble.module.css";
import styles from "./calendar.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Events grouped under day headings, for the agenda list. */
function Agenda({ events, from, to, today, tz }: { events: CalendarEvent[]; from: string; to: string; today: string; tz: string }) {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const day = e.startDay < from ? from : e.startDay;
    if (day > to) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), e]);
  }
  const days = [...byDay.keys()].sort();
  if (!days.length) return <EmptyState icon="calendar" title="Nothing on the calendar" description="There are no events here yet." />;
  return (
    <div className={styles.agenda}>
      {days.map((d) => (
        <section key={d} id={`day-${d}`} aria-labelledby={`h-${d}`}>
          <h2 id={`h-${d}`} className={styles.agendaDay} data-today={d === today || undefined}>
            {d === today ? "Today · " : ""}
            {formatKeyLong(d, tz)}
          </h2>
          <Card padded={false}>
            <EventAgenda events={byDay.get(d)!} tz={tz} today={today} fromDay={d} label={formatKeyLong(d, tz)} />
          </Card>
        </section>
      ))}
    </div>
  );
}

export function CalendarView({
  view,
  month,
  monthLabel,
  prevMonth,
  nextMonth,
  thisMonth,
  weeks,
  today,
  category,
  events,
  canCreate,
  deleted,
  tz,
}: {
  view: "month" | "list";
  month: string;
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  thisMonth: string;
  weeks: string[][];
  today: string;
  category: EventCategory | null;
  events: CalendarEvent[];
  canCreate: boolean;
  deleted: boolean;
  tz: string;
}) {
  const router = useRouter();
  const href = (p: { month?: string; view?: string; category?: string | null }) => {
    const q = new URLSearchParams();
    const v = p.view ?? view;
    if (v === "list") q.set("view", "list");
    const m = p.month ?? month;
    if (v === "month" && m !== thisMonth) q.set("month", m);
    const c = p.category === undefined ? category : p.category;
    if (c) q.set("category", c);
    const s = q.toString();
    return `/assemble/calendar${s ? `?${s}` : ""}`;
  };

  const eventsOn = (day: string) => events.filter((e) => e.startDay <= day && e.endDay >= day);
  const monthEvents = events.filter((e) => e.endDay >= `${month}-01` && e.startDay <= `${month}-31`);

  return (
    <div className={shared.stack}>
      <PageTitle
        title="Calendar"
        description="School events, excursions, term dates and holidays."
        actions={
          <>
            <LinkButton href="/api/assemble/calendar.ics" leadingVisual={DownloadIcon} download="">
              Add to my calendar
            </LinkButton>
            {canCreate ? (
              <ButtonLink href="/assemble/calendar/new" variant="primary" leadingIcon="plus">
                New event
              </ButtonLink>
            ) : null}
          </>
        }
      />
      {deleted ? <Banner variant="success" title="Event deleted" hideTitle description="The event has been removed from the calendar." /> : null}

      <div className={styles.toolbar}>
        {view === "month" ? (
          <div className={styles.monthNav}>
            <IconButton icon={ChevronLeftIcon} aria-label="Previous month" variant="invisible" onClick={() => router.push(href({ month: prevMonth }), { scroll: false })} />
            <h2 className={styles.monthLabel}>{monthLabel}</h2>
            <IconButton icon={ChevronRightIcon} aria-label="Next month" variant="invisible" onClick={() => router.push(href({ month: nextMonth }), { scroll: false })} />
            {month !== thisMonth ? (
              <NextLink href={href({ month: thisMonth })} className={styles.todayLink} scroll={false}>
                Today
              </NextLink>
            ) : null}
          </div>
        ) : (
          <h2 className={styles.monthLabel}>Coming up</h2>
        )}
        <SegmentedControl aria-label="Calendar view" size="small" onChange={(i) => router.push(href({ view: i === 0 ? "month" : "list" }), { scroll: false })}>
          <SegmentedControl.Button selected={view === "month"}>Month</SegmentedControl.Button>
          <SegmentedControl.Button selected={view === "list"}>List</SegmentedControl.Button>
        </SegmentedControl>
      </div>

      <nav aria-label="Filter by category" className={shared.chips}>
        <NextLink href={href({ category: null })} className={shared.chip} aria-current={!category ? "true" : undefined} scroll={false}>
          All
        </NextLink>
        {EVENT_CATEGORY_KEYS.map((c) => (
          <NextLink
            key={c}
            href={href({ category: c })}
            className={shared.chip}
            aria-current={category === c ? "true" : undefined}
            scroll={false}
          >
            <span className={styles.dot} data-variant={EVENT_CATEGORIES[c].variant} aria-hidden />
            {EVENT_CATEGORIES[c].label}
          </NextLink>
        ))}
      </nav>

      {view === "month" ? (
        <>
          <div className={styles.grid} role="table" aria-label={monthLabel}>
            <div className={styles.weekdays} role="row">
              {WEEKDAYS.map((d) => (
                <div key={d} role="columnheader" className={styles.weekday}>
                  {d}
                </div>
              ))}
            </div>
            {weeks.map((week) => (
              <div key={week[0]} className={styles.week} role="row">
                {week.map((day) => {
                  const list = eventsOn(day);
                  const outside = monthOf(day) !== month;
                  return (
                    <div
                      key={day}
                      role="cell"
                      className={styles.day}
                      data-outside={outside || undefined}
                      data-today={day === today || undefined}
                      data-weekend={[5, 6].includes(week.indexOf(day)) || undefined}
                    >
                      <span className={styles.dayNumber}>
                        <span className="sr-only">{formatKeyLong(day, tz)}</span>
                        <span aria-hidden>{Number(day.slice(8))}</span>
                      </span>
                      <ul className={styles.dayEvents}>
                        {list.slice(0, 3).map((e) => (
                          <li key={e.id}>
                            <NextLink
                              href={`/assemble/calendar/${e.id}`}
                              className={styles.chip}
                              data-variant={EVENT_CATEGORIES[e.category].variant}
                              data-allday={e.allDay || undefined}
                              title={e.title}
                            >
                              {!e.allDay ? <span className={styles.chipTime}>{formatEventTime(e, tz).replace(":00", "")}</span> : null}
                              <span className={styles.chipTitle}>{e.title}</span>
                            </NextLink>
                          </li>
                        ))}
                        {list.length > 3 ? <li className={styles.more}>+{list.length - 3} more</li> : null}
                      </ul>
                      {list.length ? (
                        <span className={styles.dots} aria-hidden>
                          {list.slice(0, 4).map((e) => (
                            <span key={e.id} className={styles.dot} data-variant={EVENT_CATEGORIES[e.category].variant} />
                          ))}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className={styles.mobileAgenda}>
            <Agenda events={monthEvents} from={`${month}-01`} to={`${month}-31`} today={today} tz={tz} />
          </div>
        </>
      ) : (
        <Agenda events={events} from={today} to="9999-12-31" today={today} tz={tz} />
      )}
      <p className={`${shared.muted} ${shared.small}`}>
        “Add to my calendar” downloads the next six months of events you can see, ready for Apple Calendar, Google Calendar or
        Outlook.
      </p>
    </div>
  );
}
