import type { Metadata } from "next";
import { requireStaffCampaign } from "@/lib/fete/access";
import { listDonations, scoreboard } from "@/lib/fete/queries";
import { participantOptions } from "../options";
import { DonationsView } from "./DonationsView";

export const metadata: Metadata = { title: "Donations" };
export const dynamic = "force-dynamic";

export default async function DonationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { campaign } = await requireStaffCampaign(id);
  const board = scoreboard(campaign.id);
  const donations = listDonations(campaign.id, { includeAll: true });

  return (
    <DonationsView
      campaignId={campaign.id}
      closed={campaign.status === "closed"}
      participants={participantOptions(board)}
      donations={donations.map((d) => ({
        id: d.id,
        createdAt: d.createdAt.toISOString(),
        donorName: d.donorName,
        donorEmail: d.donorEmail,
        anonymous: d.anonymous,
        message: d.message,
        amountCents: d.amountCents,
        method: d.method,
        status: d.status,
        student: d.participantId ? `${d.studentPreferredName ?? d.studentFirstName} ${d.studentLastName}` : null,
        className: d.className,
      }))}
      totals={board.totals}
    />
  );
}
