import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { eventsBetween, getEvent, type CalendarEvent } from "@/lib/assemble/calendar";
import { addDays, todayKey } from "@/lib/assemble/dates";
import { getViewer } from "@/lib/viewer";

/**
 * iCalendar (.ics) download of the events the signed-in person can see —
 * the next six months, or a single event with ?event=<id>.
 */
export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return new NextResponse("Please sign in to download the calendar.", { status: 401 });
  }
  const viewer = await getViewer();
  const tz = viewer.school.timezone;
  const eventId = req.nextUrl.searchParams.get("event");

  let list: CalendarEvent[];
  if (eventId) {
    const found = getEvent(viewer, eventId);
    if (!found) return new NextResponse("Event not found.", { status: 404 });
    list = [found.event];
  } else {
    const today = todayKey(tz);
    list = eventsBetween(viewer, addDays(today, -7), addDays(today, 183));
  }

  const host = req.nextUrl.hostname || "openschools";
  const stamp = icsUtc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Open Schools//Assemble//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(viewer.school.shortName)}`,
    `X-WR-TIMEZONE:${tz}`,
  ];
  for (const e of list) {
    lines.push("BEGIN:VEVENT", `UID:${e.id}@${host}`, `DTSTAMP:${stamp}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${e.startDay.replaceAll("-", "")}`, `DTEND;VALUE=DATE:${addDays(e.endDay, 1).replaceAll("-", "")}`);
    } else {
      lines.push(`DTSTART:${icsUtc(e.startsAt)}`, `DTEND:${icsUtc(e.endsAt)}`);
    }
    lines.push(`SUMMARY:${icsText(e.title)}`);
    if (e.location) lines.push(`LOCATION:${icsText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsText(e.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");

  const filename = eventId ? "event.ics" : `${viewer.school.slug}-calendar.ics`;
  return new NextResponse(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

const icsUtc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** RFC 5545 line folding at 75 octets. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, "utf8") > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}
