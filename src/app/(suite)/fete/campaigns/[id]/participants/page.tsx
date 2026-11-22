import type { Metadata } from "next";
import { yearLabel } from "@/lib/format";
import { requireStaffCampaign } from "@/lib/fete/access";
import { schoolStructure, scoreboard } from "@/lib/fete/queries";
import { studentPath } from "@/lib/fete/share";
import { ParticipantsView } from "./ParticipantsView";

export const metadata: Metadata = { title: "Students" };
export const dynamic = "force-dynamic";

export default async function ParticipantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const { viewer, campaign } = await requireStaffCampaign(id);
  const board = scoreboard(campaign.id);
  const structure = schoolStructure(viewer.schoolId);
  const enrolledByYear = new Map<number, number>();
  for (const p of board.participants) enrolledByYear.set(p.yearLevel, (enrolledByYear.get(p.yearLevel) ?? 0) + 1);

  return (
    <ParticipantsView
      campaignId={campaign.id}
      justCreated={created === "1"}
      closed={campaign.status === "closed"}
      years={structure.years.map((y) => ({
        yearLevel: y.yearLevel,
        label: yearLabel(y.yearLevel, viewer.school.state),
        total: y.count,
        enrolled: enrolledByYear.get(y.yearLevel) ?? 0,
      }))}
      participants={board.participants
        .map((p) => ({
          id: p.participantId,
          name: `${p.preferredName ?? p.firstName} ${p.lastName}`,
          className: p.className,
          yearLevel: p.yearLevel,
          houseName: p.houseName,
          houseColor: p.houseColor,
          raisedCents: p.raisedCents,
          goalCents: p.goalCents,
          points: p.points,
          donationCount: p.donationCount,
          code: p.code,
          publicPath: studentPath(campaign.slug, p.code),
        }))
        .sort((a, b) => a.yearLevel - b.yearLevel || (a.className ?? "").localeCompare(b.className ?? "") || a.name.localeCompare(b.name))}
    />
  );
}
