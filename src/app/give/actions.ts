"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { newId } from "@/db/ids";
import { feteDonations } from "@/db/schema";
import { zodToFormState, type FormState } from "@/lib/form";
import { publicStudentName } from "@/lib/fete/privacy";
import { getCampaignBySlug, getParticipantByCode } from "@/lib/fete/queries";
import { clientKey, rateLimited } from "@/lib/fete/rateLimit";
import { campaignPath, studentPath } from "@/lib/fete/share";
import { donationSchema } from "@/lib/fete/validation";
import { startCheckout } from "@/lib/payments";

/**
 * Public donation form (no login). Creates a pending donation, then sends the
 * donor to checkout. The donation only counts once the payment succeeds
 * (completePayment marks it "succeeded").
 */
export async function donate(_prev: FormState, formData: FormData): Promise<FormState> {
  const slug = String(formData.get("campaign") ?? "");
  const code = String(formData.get("code") ?? "");

  const parsed = donationSchema.safeParse({
    amount: String(formData.get("amount") ?? ""),
    donorName: String(formData.get("donorName") ?? ""),
    donorEmail: String(formData.get("donorEmail") ?? ""),
    message: String(formData.get("message") ?? "") || undefined,
    anonymous: String(formData.get("anonymous") ?? ""),
    website: String(formData.get("website") ?? ""),
  });
  if (!parsed.success) {
    // The honeypot is invisible to people; don't tell bots what tripped them.
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return { error: "Sorry, something went wrong. Please try again." };
    return zodToFormState(parsed.error);
  }

  if (rateLimited(`donate:${await clientKey()}`)) {
    return { error: "That's a lot of donations in a short time! Please wait a few minutes and try again." };
  }

  let campaign;
  let participantId: string | null = null;
  let description: string;
  let returnPath: string;
  if (code) {
    const found = getParticipantByCode(slug, code);
    if (!found) return { error: "We couldn't find that student's page." };
    campaign = found.campaign;
    participantId = found.participant.id;
    description = `${campaign.name} — sponsoring ${publicStudentName(found.student)} (${found.school.shortName})`;
    returnPath = studentPath(campaign.slug, code);
  } else {
    const found = getCampaignBySlug(slug);
    if (!found) return { error: "We couldn't find that fundraiser." };
    campaign = found.campaign;
    description = `${campaign.name} — donation to ${found.school.name}`;
    returnPath = campaignPath(campaign.slug);
  }
  if (campaign.status !== "live") return { error: "This fundraiser isn't taking donations right now." };

  const { amount, donorName, donorEmail, message, anonymous } = parsed.data;
  const { url } = await startCheckout({
    schoolId: campaign.schoolId,
    purpose: "donation",
    description,
    amountCents: amount,
    payer: { name: donorName, email: donorEmail },
    returnPath,
    attach: (paymentId) => {
      db.insert(feteDonations)
        .values({
          id: newId(),
          campaignId: campaign.id,
          participantId,
          amountCents: amount,
          donorName,
          donorEmail,
          message,
          anonymous,
          method: "online",
          status: "pending",
          paymentId,
        })
        .run();
    },
  });
  redirect(url);
}
