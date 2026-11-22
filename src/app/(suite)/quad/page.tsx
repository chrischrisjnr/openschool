import type { Metadata } from "next";
import { cookies } from "next/headers";
import { listMySpaces, recentActivity } from "@/lib/quad/spaces";
import { getViewer } from "@/lib/viewer";
import { QuadHomeView } from "./_components/QuadHomeView";

export const metadata: Metadata = { title: "Quad" };

export default async function QuadHome() {
  const viewer = await getViewer();
  const spaces = listMySpaces(viewer);
  const activity = recentActivity(viewer, 8);
  const seenGuidelines = (await cookies()).get("quad_guidelines")?.value === "seen";

  return (
    <QuadHomeView
      firstName={viewer.name.split(" ")[0] ?? viewer.name}
      role={viewer.role}
      spaces={spaces}
      activity={activity}
      showGuidelines={!seenGuidelines}
    />
  );
}
