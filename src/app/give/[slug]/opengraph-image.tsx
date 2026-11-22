import { getCampaignBySlug, scoreboard } from "@/lib/fete/queries";
import { OG_SIZE, ogCard } from "../_components/ogImage";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "School fundraiser";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = getCampaignBySlug(slug);
  if (!found || found.campaign.status === "draft") {
    return ogCard({ eyebrow: "Open Schools", title: "School fundraiser", subtitle: "Support your local school.", raisedCents: 0, goalCents: 1 });
  }
  const { campaign, school } = found;
  return ogCard({
    eyebrow: school.name,
    title: campaign.name,
    subtitle: campaign.cause ? `Raising money for ${campaign.cause.toLowerCase()}` : (campaign.tagline ?? "Every dollar helps!"),
    raisedCents: scoreboard(campaign.id).totals.raisedCents,
    goalCents: campaign.goalCents,
  });
}
