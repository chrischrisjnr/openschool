import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { events } from "@/db/schema";
import { audienceLabeler } from "@/lib/assemble/audience";
import { canManageItem, familyCharges, itemDetail } from "@/lib/assemble/charges";
import { formatEventWhen } from "@/lib/assemble/format-event";
import { eventDays } from "@/lib/assemble/calendar";
import { formatDate, formatShortDate } from "@/lib/format";
import { getViewer } from "@/lib/viewer";
import { ItemFamilyView, ItemStaffView } from "./ItemView";

export const metadata: Metadata = { title: "Form or payment" };

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; filter?: string; class?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  const tz = viewer.school.timezone;

  const detail = viewer.isStaff ? itemDetail(viewer, id) : null;
  const charges = viewer.isStaff ? [] : familyCharges(viewer, { itemId: id });
  if (viewer.isStaff ? !detail : !charges.length) notFound();

  const item = detail?.item;
  const eventId = item?.eventId ?? charges[0]?.eventId ?? null;
  const ev = eventId ? db.select().from(events).where(eq(events.id, eventId)).get() : undefined;
  const event = ev ? { id: ev.id, title: ev.title, when: formatEventWhen({ ...ev, ...eventDays(ev, tz) }, tz) } : null;

  if (!detail) {
    const c = charges[0]!;
    const now = new Date();
    return (
      <ItemFamilyView
        info={{ title: c.title, description: c.description, category: c.category, due: c.dueAt ? formatDate(c.dueAt, tz) : null, closed: c.closed }}
        event={event}
        canAct={viewer.role === "parent"}
        kids={viewer.students.map((s) => ({ id: s.id, name: s.preferredName ?? s.firstName, fullName: s.displayName, className: s.className }))}
        charges={charges.map((ch) => ({
          ...ch,
          due: ch.dueAt ? formatShortDate(ch.dueAt, tz) : null,
          overdue: !!ch.dueAt && ch.dueAt < now && ch.needsAction,
          paidOn: ch.paidAt ? formatShortDate(ch.paidAt, tz) : null,
        }))}
      />
    );
  }

  const { summary, rows } = detail;
  const i = detail.item;
  const label = audienceLabeler(viewer.schoolId, viewer.school.state);
  const classes = [...new Set(rows.map((r) => r.className).filter((c): c is string => !!c))];
  return (
    <ItemStaffView
      item={{
        id: i.id,
        title: i.title,
        description: i.description,
        category: i.category,
        amountCents: i.amountCents,
        requiresConsent: i.requiresConsent,
        due: i.dueAt ? formatDate(i.dueAt, tz) : null,
        closed: i.closed,
        audience: label(i.audienceType, i.audienceId),
      }}
      summary={summary}
      rows={rows.map((r) => ({ ...r, paidOn: r.paidAt ? formatShortDate(r.paidAt, tz) : null, consentOn: r.consentAt ? formatShortDate(r.consentAt, tz) : null }))}
      event={event}
      classes={classes}
      created={sp.created === "1"}
      canManage={canManageItem(viewer, i)}
      showMoney={viewer.isAdmin || i.createdBy === viewer.id}
    />
  );
}
