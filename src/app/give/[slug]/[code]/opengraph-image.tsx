import { firstNameOf } from "@/lib/fete/privacy";
import { getParticipantByCode, scoreboard } from "@/lib/fete/queries";
import { OG_SIZE, ogCard } from "../../_components/ogImage";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Sponsor a student";

export default async function Image({ params }: { params: Promise<{ slug: string; code: string }> }) {
  const { slug, code } = await params;
  const found = getParticipantByCode(slug, code);
  if (!found || found.campaign.status === "draft") {
    return ogCard({ eyebrow: "Open Schools", title: "School fundraiser", subtitle: "Support your local school.", raisedCents: 0, goalCents: 1 });
  }
  const first = firstNameOf(found.student);
  const me = scoreboard(found.campaign.id).participants.find((p) => p.participantId === found.participant.id);
  return ogCard({
    eyebrow: `${found.school.shortName} · ${found.campaign.name}`,
    title: `Sponsor ${first}!`,
    subtitle: found.campaign.cause ? `Help ${first} raise money for ${found.campaign.cause.toLowerCase()}` : "Every dollar helps!",
    raisedCents: me?.raisedCents ?? 0,
    goalCents: found.participant.goalCents,
  });
}
