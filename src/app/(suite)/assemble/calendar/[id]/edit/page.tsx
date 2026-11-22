import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffViewer } from "@/lib/assemble/access";
import { getEvent } from "@/lib/assemble/calendar";
import { timeOfDay } from "@/lib/assemble/dates";
import { encodeAudience, getAudienceOptions } from "@/lib/audience";
import { EventForm } from "../../EventForm";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireStaffViewer();
  const found = getEvent(viewer, id);
  if (!found) notFound();
  const { event: e, raw } = found;
  const tz = viewer.school.timezone;
  return (
    <EventForm
      values={{
        id: e.id,
        title: e.title,
        description: e.description ?? "",
        location: e.location ?? "",
        category: e.category,
        audience: encodeAudience(raw.audienceType, raw.audienceId),
        date: e.startDay,
        endDate: e.endDay !== e.startDay ? e.endDay : "",
        allDay: e.allDay,
        startTime: e.allDay ? "09:00" : timeOfDay(e.startsAt, tz),
        endTime: e.allDay ? "10:00" : timeOfDay(e.endsAt, tz),
      }}
      audienceOptions={getAudienceOptions(viewer.schoolId, viewer.school.state)}
    />
  );
}
