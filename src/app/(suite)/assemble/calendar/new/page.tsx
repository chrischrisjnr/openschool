import type { Metadata } from "next";
import { requireStaffViewer } from "@/lib/assemble/access";
import { isDayKey, todayKey } from "@/lib/assemble/dates";
import { getAudienceOptions } from "@/lib/audience";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const viewer = await requireStaffViewer();
  const { date } = await searchParams;
  return (
    <EventForm
      values={{
        title: "",
        description: "",
        location: "",
        category: "event",
        audience: "school",
        date: isDayKey(date) ? date : todayKey(viewer.school.timezone),
        endDate: "",
        allDay: false,
        startTime: "09:00",
        endTime: "10:00",
      }}
      audienceOptions={getAudienceOptions(viewer.schoolId, viewer.school.state)}
    />
  );
}
