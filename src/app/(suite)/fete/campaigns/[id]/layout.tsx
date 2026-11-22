import type { ReactNode } from "react";
import { formatDate } from "@/lib/format";
import { requireStaffCampaign } from "@/lib/fete/access";
import { daysLeftLabel } from "@/lib/fete/dates";
import { CampaignHeader } from "./CampaignHeader";

export default async function CampaignLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { viewer, campaign } = await requireStaffCampaign(id);
  const tz = viewer.school.timezone;
  return (
    <>
      <CampaignHeader
        id={campaign.id}
        name={campaign.name}
        slug={campaign.slug}
        status={campaign.status}
        dates={`${formatDate(campaign.startsAt, tz)} – ${formatDate(campaign.endsAt, tz)}`}
        timeLabel={campaign.status === "live" ? daysLeftLabel(campaign.endsAt, new Date(), tz) : null}
      />
      {children}
    </>
  );
}
