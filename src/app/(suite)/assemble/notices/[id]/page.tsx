import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getNotice, noticeReach, readStateFor, recordRead } from "@/lib/assemble/notices";
import { formatDate, formatDateTime } from "@/lib/format";
import { getViewer } from "@/lib/viewer";
import { NoticeDetailView } from "./NoticeDetailView";

export const metadata: Metadata = { title: "Notice" };

export default async function NoticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  const found = getNotice(viewer, id);
  if (!found) notFound();
  const { notice: n } = found;
  const tz = viewer.school.timezone;

  recordRead(n.id, viewer.id);
  const state = readStateFor(n.id, viewer.id);
  const canAck = n.requiresAck && (viewer.role === "parent" || (viewer.isStaff && n.audienceType === "staff"));
  const reach = viewer.isStaff ? noticeReach(viewer.schoolId, n) : null;

  return (
    <NoticeDetailView
      notice={{
        id: n.id,
        title: n.title,
        body: n.body,
        category: n.category,
        pinned: n.pinned,
        requiresAck: n.requiresAck,
        audience: found.audience,
        published: formatDateTime(n.publishedAt, tz),
        expires: n.expiresAt ? formatDate(n.expiresAt, tz) : null,
        expired: !!n.expiresAt && n.expiresAt <= new Date(),
        authorName: found.authorName,
        authorTitle: found.authorTitle,
      }}
      ack={canAck ? { done: !!state?.acknowledgedAt, at: state?.acknowledgedAt ? formatDateTime(state.acknowledgedAt, tz) : null } : null}
      reach={reach}
      canEdit={viewer.isStaff}
    />
  );
}
