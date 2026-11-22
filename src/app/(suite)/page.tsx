import { HomeView } from "./HomeView";
import { assembleSummary } from "@/lib/assemble/summary";
import { feteSummary } from "@/lib/fete/summary";
import { quadSummary } from "@/lib/quad/summary";
import { yearLabel } from "@/lib/format";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = await getViewer();
  const [assemble, quad, fete] = await Promise.all([
    assembleSummary(viewer),
    quadSummary(viewer),
    feteSummary(viewer),
  ]);
  return (
    <HomeView
      firstName={viewer.name.split(" ")[0] ?? viewer.name}
      schoolName={viewer.school.name}
      role={viewer.role}
      students={viewer.students.map((s) => ({
        id: s.id,
        name: s.displayName,
        detail: [yearLabel(s.yearLevel, viewer.school.state), s.className && `Class ${s.className}`, s.houseName && `${s.houseName} house`]
          .filter(Boolean)
          .join(" · "),
      }))}
      summaries={{ assemble, quad, fete }}
    />
  );
}
