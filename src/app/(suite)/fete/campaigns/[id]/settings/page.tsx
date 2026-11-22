import type { Metadata } from "next";
import { dayKey } from "@/lib/format";
import { requireStaffCampaign } from "@/lib/fete/access";
import { getTiers, publicUrls } from "@/lib/fete/queries";
import { displayUrl } from "@/lib/fete/share";
import { updateCampaign } from "../../../actions";
import { CampaignForm } from "../../../_components/CampaignForm";

export const metadata: Metadata = { title: "Campaign settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { viewer, campaign } = await requireStaffCampaign(id);
  const tz = viewer.school.timezone;
  const { base } = await publicUrls(campaign.slug);
  const dollars = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));

  return (
    <CampaignForm
      action={updateCampaign}
      submitLabel="Save changes"
      publicBase={`${displayUrl(base)}/give/`}
      initial={{
        campaignId: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        tagline: campaign.tagline ?? "",
        description: campaign.description ?? "",
        cause: campaign.cause ?? "",
        eventDate: campaign.eventDate ?? "",
        startDate: dayKey(campaign.startsAt, tz),
        endDate: dayKey(campaign.endsAt, tz),
        goal: dollars(campaign.goalCents),
        studentGoal: dollars(campaign.defaultStudentGoalCents),
        pointsPerDollar: String(campaign.pointsPerDollar),
        tiers: getTiers(campaign.id).map((t) => ({
          emoji: t.emoji,
          name: t.name,
          threshold: dollars(t.thresholdCents),
          description: t.description ?? "",
        })),
      }}
    />
  );
}
