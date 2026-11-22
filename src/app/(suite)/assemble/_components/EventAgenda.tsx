"use client";

import { LocationIcon } from "@primer/octicons-react";
import type { CalendarEvent } from "@/lib/assemble/calendar";
import { formatEventWhen } from "@/lib/assemble/format-event";
import { zonedTime } from "@/lib/assemble/dates";
import { DateTile, EventCategoryLabel, Meta, Row, RowList } from "./bits";
import styles from "./assemble.module.css";

function tileParts(day: string, tz: string) {
  const d = zonedTime(day, "12:00", tz);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-AU", { timeZone: tz, ...o }).format(d);
  return { weekday: f({ weekday: "short" }), day: f({ day: "numeric" }), month: f({ month: "short" }) };
}

/**
 * Events as a simple list with a date tile per row. Multi-day events show on
 * the first day in range (`fromDay`) so ongoing events still appear.
 */
export function EventAgenda({
  events,
  tz,
  today,
  fromDay,
  emptyText = "Nothing on the calendar.",
  label = "Events",
}: {
  events: CalendarEvent[];
  tz: string;
  today: string;
  fromDay?: string;
  emptyText?: string;
  label?: string;
}) {
  if (!events.length) return <p className={styles.emptyLine}>{emptyText}</p>;
  return (
    <RowList label={label}>
      {events.map((e) => {
        const day = fromDay && e.startDay < fromDay ? fromDay : e.startDay;
        return (
          <Row
            key={e.id}
            href={`/assemble/calendar/${e.id}`}
            leading={<DateTile {...tileParts(day, tz)} tone={day === today ? "today" : undefined} />}
            title={e.title}
            meta={
              <Meta
                parts={[
                  formatEventWhen(e, tz, { withDate: e.startDay !== e.endDay }),
                  e.location ? (
                    <span>
                      <LocationIcon size={12} /> {e.location}
                    </span>
                  ) : null,
                  e.audience !== "Whole school" ? e.audience : null,
                ]}
              />
            }
            trailing={<EventCategoryLabel category={e.category} />}
          />
        );
      })}
    </RowList>
  );
}
