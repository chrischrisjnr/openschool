import type { Metadata } from "next";
import { NOTICE_CATEGORY_KEYS, type NoticeCategory } from "@/lib/assemble/constants";
import { listNotices } from "@/lib/assemble/notices";
import { getViewer } from "@/lib/viewer";
import { NoticesView } from "./NoticesView";

export const metadata: Metadata = { title: "Notices" };

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; deleted?: string }>;
}) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const category = NOTICE_CATEGORY_KEYS.includes(sp.category as NoticeCategory) ? (sp.category as NoticeCategory) : undefined;
  const all = listNotices(viewer);
  const counts = new Map<string, number>();
  for (const n of all) counts.set(n.category, (counts.get(n.category) ?? 0) + 1);
  return (
    <NoticesView
      notices={category ? all.filter((n) => n.category === category) : all}
      category={category ?? null}
      categories={NOTICE_CATEGORY_KEYS.filter((c) => counts.has(c)).map((c) => ({ key: c, count: counts.get(c) ?? 0 }))}
      total={all.length}
      unread={all.filter((n) => !n.read).length}
      canPost={viewer.isStaff}
      deleted={sp.deleted === "1"}
      tz={viewer.school.timezone}
    />
  );
}
