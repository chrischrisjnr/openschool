import type { Metadata } from "next";
import { staffBoards } from "@/lib/fete/boards";
import { requireStaffCampaign } from "@/lib/fete/access";
import { listAwards, schoolStructure, scoreboard } from "@/lib/fete/queries";
import { yearLabel } from "@/lib/format";
import { participantOptions } from "../options";
import { PointsView } from "./PointsView";

export const metadata: Metadata = { title: "Bonus points" };
export const dynamic = "force-dynamic";

export default async function PointsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { viewer, campaign } = await requireStaffCampaign(id);
  const board = scoreboard(campaign.id);
  const s = schoolStructure(viewer.schoolId);
  const years = [...new Set(s.classes.map((c) => c.yearLevel))];

  return (
    <PointsView
      campaignId={campaign.id}
      pointsPerDollar={campaign.pointsPerDollar}
      targets={{
        student: participantOptions(board),
        class: s.classes.map((c) => ({ id: c.id, label: `Class ${c.name}`, group: yearLabel(c.yearLevel, viewer.school.state) })),
        year: years.map((y) => ({ id: String(y), label: yearLabel(y, viewer.school.state), group: "Year levels" })),
        house: s.houses.map((h) => ({ id: h.id, label: `${h.name} house`, group: "Houses" })),
      }}
      awards={listAwards(campaign.id, viewer.school.state).map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
      boards={staffBoards(board).slice(1)}
      now={new Date().toISOString()}
    />
  );
}
