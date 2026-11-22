import type { Metadata } from "next";
import { staffBoards } from "@/lib/fete/boards";
import { requireStaffCampaign } from "@/lib/fete/access";
import { getTiers, listDonations, scoreboard } from "@/lib/fete/queries";
import { publicStudentName } from "@/lib/fete/privacy";
import { OverviewView } from "./OverviewView";

export const metadata: Metadata = { title: "Campaign dashboard" };
export const dynamic = "force-dynamic";

export default async function CampaignOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { campaign } = await requireStaffCampaign(id);
  const board = scoreboard(campaign.id);
  const tiers = getTiers(campaign.id);
  const recent = listDonations(campaign.id, { limit: 8 });
  const t = board.totals;

  return (
    <OverviewView
      campaign={{ id: campaign.id, slug: campaign.slug, status: campaign.status, goalCents: campaign.goalCents }}
      totals={t}
      boards={staffBoards(board)}
      hasTiers={tiers.length > 0}
      tierReach={tiers.map((tier) => ({
        id: tier.id,
        emoji: tier.emoji,
        name: tier.name,
        count: board.participants.filter((p) => p.raisedCents >= tier.thresholdCents).length,
      }))}
      recent={recent.map((d) => ({
        id: d.id,
        who: d.donorName + (d.anonymous ? " (anonymous)" : ""),
        forLabel: d.participantId
          ? `→ ${publicStudentName({ firstName: d.studentFirstName ?? "", preferredName: d.studentPreferredName, lastName: d.studentLastName ?? "" })}${d.className ? ` (${d.className})` : ""}`
          : "→ the school",
        message: d.message,
        amountCents: d.amountCents,
        createdAt: d.createdAt.toISOString(),
        method: d.method,
      }))}
      now={new Date().toISOString()}
    />
  );
}
