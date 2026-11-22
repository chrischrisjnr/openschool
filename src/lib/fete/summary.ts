import "server-only";
import { db } from "@/db";
import { formatMoney } from "@/lib/format";
import type { HomeSummary, SummaryProvider } from "@/lib/summary";
import { firstNameOf } from "./privacy";
import { donationsSince, liveCampaigns, participationsFor } from "./queries";
import { getCampaignTotals, getScoreboard } from "./scoring";

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Home-page card for Fete: how the live fundraiser is going. */
export const feteSummary: SummaryProvider = (viewer): HomeSummary => {
  const live = liveCampaigns(viewer.schoolId);
  const campaign = live[0];
  if (!campaign) return { highlights: [], text: "No fundraiser running right now." };

  if (viewer.isStaff) {
    const totals = getCampaignTotals(db, campaign.id);
    const weekAgo = new Date(Date.now() - WEEK);
    const recent = donationsSince({ campaignId: campaign.id }, weekAgo);
    return {
      highlights: [
        { label: recent === 1 ? "donation this week" : "donations this week", count: recent, tone: "success" },
        ...(live.length > 1 ? [{ label: "live campaigns", count: live.length, tone: "accent" as const }] : []),
      ],
      text: `${campaign.name}: ${formatMoney(totals.raisedCents, { whole: true })} raised of ${formatMoney(campaign.goalCents, { whole: true })}`,
    };
  }

  const mine = participationsFor(
    viewer.students.map((s) => s.id),
    viewer.schoolId,
  ).filter((p) => p.campaign.id === campaign.id);
  if (!mine.length) return { highlights: [], text: `${campaign.name} is on now!` };

  const board = getScoreboard(db, campaign.id);
  const raised = mine.map((m) => {
    const score = board?.participants.find((p) => p.participantId === m.participant.id);
    const student = viewer.students.find((s) => s.id === m.participant.studentId);
    return `${student ? firstNameOf(student) : "Your child"} ${formatMoney(score?.raisedCents ?? 0, { whole: true })}`;
  });
  const fresh = donationsSince({ participantIds: mine.map((m) => m.participant.id) }, new Date(Date.now() - WEEK));
  return {
    highlights: fresh ? [{ label: fresh === 1 ? "new supporter this week" : "new supporters this week", count: fresh, tone: "success" }] : [],
    text: `${campaign.name} — raised so far: ${raised.join(" · ")}`,
  };
};
