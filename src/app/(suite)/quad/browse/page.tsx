import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listAudienceSpaces, listGroups } from "@/lib/quad/spaces";
import { getViewer } from "@/lib/viewer";
import { BrowseView } from "./BrowseView";

export const metadata: Metadata = { title: "Browse groups · Quad" };

export default async function BrowsePage() {
  const viewer = await getViewer();
  if (viewer.role === "student") redirect("/quad");
  return (
    <BrowseView
      groups={listGroups(viewer)}
      audienceSpaces={viewer.isStaff ? listAudienceSpaces(viewer) : []}
      isStaff={viewer.isStaff}
    />
  );
}
