import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { dayKey } from "@/lib/format";
import { requireFeteStaff } from "@/lib/fete/access";
import { publicUrls } from "@/lib/fete/queries";
import { displayUrl } from "@/lib/fete/share";
import { createCampaign } from "../../actions";
import { CampaignForm } from "../../_components/CampaignForm";

export const metadata: Metadata = { title: "New campaign" };

const STARTER_TIERS = [
  { emoji: "🎨", name: "Colour Crew", threshold: "20", description: "Sweatband" },
  { emoji: "🕶️", name: "Shades", threshold: "50", description: "Rainbow sunnies" },
  { emoji: "🧢", name: "Cap", threshold: "100", description: "School cap" },
  { emoji: "🏆", name: "Legend", threshold: "250", description: "Colour cannon at the finish" },
];

export default async function NewCampaignPage() {
  const viewer = await requireFeteStaff();
  const tz = viewer.school.timezone;
  const today = new Date();
  const inDays = (n: number) => dayKey(new Date(today.getTime() + n * 86_400_000), tz);
  const { base } = await publicUrls("x");
  return (
    <>
      <PageTitle
        back={{ href: "/fete", label: "All campaigns" }}
        title="New campaign"
        description="Set it up as a draft — nothing is public until you press Go live."
      />
      <CampaignForm
        action={createCampaign}
        submitLabel="Create campaign"
        publicBase={`${displayUrl(base)}/give/`}
        initial={{
          name: "",
          slug: "",
          tagline: "",
          description: "",
          cause: "",
          eventDate: inDays(28),
          startDate: inDays(0),
          endDate: inDays(35),
          goal: "10000",
          studentGoal: "100",
          pointsPerDollar: "1",
          tiers: STARTER_TIERS,
        }}
      />
    </>
  );
}
