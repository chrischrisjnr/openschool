import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEvent } from "@/lib/assemble/calendar";
import { formatEventWhen } from "@/lib/assemble/format-event";
import { formatMoney } from "@/lib/format";
import { getViewer } from "@/lib/viewer";
import { EventDetailView } from "./EventDetailView";

export const metadata: Metadata = { title: "Event" };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  const found = getEvent(viewer, id);
  if (!found) notFound();
  const { event: e, items } = found;
  const tz = viewer.school.timezone;
  return (
    <EventDetailView
      event={{
        id: e.id,
        title: e.title,
        description: e.description,
        location: e.location,
        category: e.category,
        when: formatEventWhen(e, tz),
        audience: e.audience,
        month: e.startDay.slice(0, 7),
      }}
      items={items.map((i) => ({
        id: i.id,
        title: i.title,
        detail: [i.amountCents ? formatMoney(i.amountCents) : null, i.requiresConsent ? "permission needed" : null].filter(Boolean).join(" · "),
      }))}
      canEdit={viewer.isStaff}
    />
  );
}
