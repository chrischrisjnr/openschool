import type { Metadata } from "next";
import { requireStaffViewer } from "@/lib/assemble/access";
import { upcomingEvents } from "@/lib/assemble/calendar";
import { formatKeyShort, todayKey } from "@/lib/assemble/dates";
import { getAudienceOptions } from "@/lib/audience";
import { ItemForm } from "./ItemForm";

export const metadata: Metadata = { title: "New form or payment" };

export default async function NewItemPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const viewer = await requireStaffViewer();
  const { event } = await searchParams;
  const tz = viewer.school.timezone;
  const events = upcomingEvents(viewer, 180).filter((e) => e.category !== "holiday" && e.category !== "term");
  return (
    <ItemForm
      audienceOptions={getAudienceOptions(viewer.schoolId, viewer.school.state)}
      events={events.map((e) => ({ id: e.id, label: `${formatKeyShort(e.startDay, tz)} — ${e.title}` }))}
      minDate={todayKey(tz)}
      defaultEventId={events.some((e) => e.id === event) ? event! : ""}
    />
  );
}
