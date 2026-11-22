import type { Metadata } from "next";
import { requireStaffViewer } from "@/lib/assemble/access";
import { addDays, todayKey } from "@/lib/assemble/dates";
import { getAudienceOptions } from "@/lib/audience";
import { NoticeForm } from "../NoticeForm";

export const metadata: Metadata = { title: "New notice" };

export default async function NewNoticePage() {
  const viewer = await requireStaffViewer();
  return (
    <NoticeForm
      values={{ title: "", body: "", category: "general", audience: "school", pinned: false, requiresAck: false, expiresOn: "" }}
      audienceOptions={getAudienceOptions(viewer.schoolId, viewer.school.state)}
      minDate={addDays(todayKey(viewer.school.timezone), 1)}
    />
  );
}
