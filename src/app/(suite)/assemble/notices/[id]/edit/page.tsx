import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffViewer } from "@/lib/assemble/access";
import { addDays, todayKey } from "@/lib/assemble/dates";
import { getNotice } from "@/lib/assemble/notices";
import { encodeAudience, getAudienceOptions } from "@/lib/audience";
import { dayKey } from "@/lib/format";
import { NoticeForm } from "../../NoticeForm";

export const metadata: Metadata = { title: "Edit notice" };

export default async function EditNoticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireStaffViewer();
  const found = getNotice(viewer, id);
  if (!found) notFound();
  const n = found.notice;
  const tz = viewer.school.timezone;
  return (
    <NoticeForm
      values={{
        id: n.id,
        title: n.title,
        body: n.body,
        category: n.category,
        audience: encodeAudience(n.audienceType, n.audienceId),
        pinned: n.pinned,
        requiresAck: n.requiresAck,
        expiresOn: n.expiresAt ? dayKey(n.expiresAt, tz) : "",
      }}
      audienceOptions={getAudienceOptions(viewer.schoolId, viewer.school.state)}
      minDate={addDays(todayKey(tz), 1)}
    />
  );
}
