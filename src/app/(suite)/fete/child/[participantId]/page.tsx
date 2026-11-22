import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireFamilyParticipant } from "@/lib/fete/access";
import { daysLeftLabel } from "@/lib/fete/dates";
import { firstNameOf } from "@/lib/fete/privacy";
import { childProgress } from "@/lib/fete/progress";
import { getTiers, listDonations, publicUrls, qrSvg, scoreboard } from "@/lib/fete/queries";
import { studentPath } from "@/lib/fete/share";
import { ChildView } from "./ChildView";

export const metadata: Metadata = { title: "Share & track" };
export const dynamic = "force-dynamic";

export default async function ChildPage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;
  const { viewer, child, participant, campaign } = await requireFamilyParticipant(participantId);
  const board = scoreboard(campaign.id);
  const tiers = getTiers(campaign.id);
  const progress = childProgress(board, participant.id, tiers);
  if (!progress) notFound();
  const score = board.participants.find((p) => p.participantId === participant.id)!;
  const firstName = child ? firstNameOf(child) : firstNameOf(score);
  const { studentUrl } = await publicUrls(campaign.slug, participant.code);
  const donations = listDonations(campaign.id, { participantId: participant.id });
  const now = new Date();

  return (
    <ChildView
      participantId={participant.id}
      firstName={firstName}
      canEdit={viewer.role !== "student" && campaign.status !== "closed"}
      campaign={{
        name: campaign.name,
        status: campaign.status,
        cause: campaign.cause,
        timeLabel: daysLeftLabel(campaign.endsAt, now, viewer.school.timezone),
      }}
      schoolName={viewer.school.shortName}
      progress={progress}
      tiers={tiers}
      studentUrl={studentUrl!}
      publicPath={studentPath(campaign.slug, participant.code)}
      qr={await qrSvg(studentUrl!)}
      qrDownload={`/api/fete/qr/${participant.code}`}
      donations={donations.map((d) => ({
        id: d.id,
        who: d.donorName + (d.anonymous ? " (name hidden publicly)" : ""),
        message: d.message,
        amountCents: d.amountCents,
        createdAt: d.createdAt.toISOString(),
        method: d.method,
      }))}
      now={now.toISOString()}
    />
  );
}
