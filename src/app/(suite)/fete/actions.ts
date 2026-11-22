"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { newId, shortCode } from "@/db/ids";
import {
  classes,
  feteCampaigns,
  feteDonations,
  feteParticipants,
  fetePointAwards,
  fetePrizeTiers,
  houses,
} from "@/db/schema";
import { zodToFormState, type FormState } from "@/lib/form";
import { formatMoney } from "@/lib/format";
import { canEditParticipation, requireFeteStaff, requireStaffCampaign } from "@/lib/fete/access";
import { endOfDay, startOfDay } from "@/lib/fete/dates";
import { codeTaken, getCampaign, slugTaken, unenrolledStudents } from "@/lib/fete/queries";
import {
  awardSchema,
  campaignSchema,
  cashSchema,
  enrolSchema,
  participationSchema,
  statusSchema,
} from "@/lib/fete/validation";
import { getViewer } from "@/lib/viewer";

const refresh = () => {
  revalidatePath("/fete", "layout");
  revalidatePath("/give", "layout");
  revalidatePath("/");
};

function uniqueCode(): string {
  for (let i = 0; i < 20; i++) {
    const code = shortCode();
    if (!codeTaken(code)) return code;
  }
  return shortCode(10);
}

/* ---------------- Campaigns ---------------- */

function campaignValues(formData: FormData) {
  return campaignSchema.safeParse({
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    tagline: formData.get("tagline") ?? undefined,
    description: formData.get("description") ?? undefined,
    cause: formData.get("cause") ?? undefined,
    eventDate: formData.get("eventDate") ?? undefined,
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
    goal: formData.get("goal") ?? "",
    studentGoal: formData.get("studentGoal") ?? "",
    pointsPerDollar: formData.get("pointsPerDollar") ?? "1",
    tiers: formData.get("tiers") ?? "[]",
  });
}

export async function createCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireFeteStaff();
  const parsed = campaignValues(formData);
  if (!parsed.success) return zodToFormState(parsed.error);
  const v = parsed.data;
  if (slugTaken(v.slug)) return { error: "That web address is already used by another campaign.", fieldErrors: { slug: "Already in use — try adding the year" } };

  const tz = viewer.school.timezone;
  const id = newId();
  db.transaction((tx) => {
    tx.insert(feteCampaigns)
      .values({
        id,
        schoolId: viewer.schoolId,
        slug: v.slug,
        name: v.name,
        tagline: v.tagline,
        description: v.description,
        cause: v.cause,
        eventDate: v.eventDate,
        startsAt: startOfDay(v.startDate, tz),
        endsAt: endOfDay(v.endDate, tz),
        goalCents: v.goal,
        defaultStudentGoalCents: v.studentGoal,
        pointsPerDollar: v.pointsPerDollar,
        status: "draft",
        createdBy: viewer.id,
      })
      .run();
    if (v.tiers.length) {
      tx.insert(fetePrizeTiers)
        .values(v.tiers.map((t) => ({ id: newId(), campaignId: id, emoji: t.emoji, name: t.name, thresholdCents: t.threshold * 100, description: t.description })))
        .run();
    }
  });
  refresh();
  redirect(`/fete/campaigns/${id}/participants?created=1`);
}

export async function updateCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  const { viewer, campaign } = await requireStaffCampaign(String(formData.get("campaignId") ?? ""));
  const parsed = campaignValues(formData);
  if (!parsed.success) return zodToFormState(parsed.error);
  const v = parsed.data;
  if (slugTaken(v.slug, campaign.id)) return { error: "That web address is already used by another campaign.", fieldErrors: { slug: "Already in use" } };

  const tz = viewer.school.timezone;
  db.transaction((tx) => {
    tx.update(feteCampaigns)
      .set({
        slug: v.slug,
        name: v.name,
        tagline: v.tagline,
        description: v.description,
        cause: v.cause,
        eventDate: v.eventDate,
        startsAt: startOfDay(v.startDate, tz),
        endsAt: endOfDay(v.endDate, tz),
        goalCents: v.goal,
        defaultStudentGoalCents: v.studentGoal,
        pointsPerDollar: v.pointsPerDollar,
      })
      .where(eq(feteCampaigns.id, campaign.id))
      .run();
    // Students still on the old default goal move to the new one.
    if (v.studentGoal !== campaign.defaultStudentGoalCents) {
      tx.update(feteParticipants)
        .set({ goalCents: v.studentGoal })
        .where(and(eq(feteParticipants.campaignId, campaign.id), eq(feteParticipants.goalCents, campaign.defaultStudentGoalCents)))
        .run();
    }
    tx.delete(fetePrizeTiers).where(eq(fetePrizeTiers.campaignId, campaign.id)).run();
    if (v.tiers.length) {
      tx.insert(fetePrizeTiers)
        .values(v.tiers.map((t) => ({ id: newId(), campaignId: campaign.id, emoji: t.emoji, name: t.name, thresholdCents: t.threshold * 100, description: t.description })))
        .run();
    }
  });
  refresh();
  return { ok: true, message: "Campaign saved." };
}

export async function setCampaignStatus(formData: FormData): Promise<void> {
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { campaign } = await requireStaffCampaign(parsed.data.campaignId);
  db.update(feteCampaigns).set({ status: parsed.data.status }).where(eq(feteCampaigns.id, campaign.id)).run();
  refresh();
}

/* ---------------- Participants ---------------- */

export async function enrolParticipants(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = enrolSchema.safeParse({
    campaignId: formData.get("campaignId"),
    scope: formData.get("scope"),
    years: formData.getAll("years"),
  });
  if (!parsed.success) return zodToFormState(parsed.error);
  const { campaign } = await requireStaffCampaign(parsed.data.campaignId);
  if (campaign.status === "closed") return { error: "This campaign has finished — reopen it to enrol more students." };
  if (parsed.data.scope === "years" && !parsed.data.years.length) return { error: "Choose at least one year level." };

  const toAdd = unenrolledStudents(campaign.id, campaign.schoolId, parsed.data.scope === "years" ? parsed.data.years : undefined);
  if (!toAdd.length) return { ok: true, message: "Everyone in that group is already enrolled." };
  db.transaction((tx) => {
    for (const s of toAdd) {
      tx.insert(feteParticipants)
        .values({ id: newId(), campaignId: campaign.id, studentId: s.id, code: uniqueCode(), goalCents: campaign.defaultStudentGoalCents })
        .run();
    }
  });
  refresh();
  return { ok: true, message: `Enrolled ${toAdd.length} ${toAdd.length === 1 ? "student" : "students"}. Each one now has their own page and QR code.` };
}

/* ---------------- Donations ---------------- */

export async function recordCashDonation(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = cashSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToFormState(parsed.error);
  const { viewer, campaign } = await requireStaffCampaign(parsed.data.campaignId);
  const { participantId, amount, donorName, message } = parsed.data;
  if (participantId) {
    const p = db.select({ id: feteParticipants.id }).from(feteParticipants)
      .where(and(eq(feteParticipants.id, participantId), eq(feteParticipants.campaignId, campaign.id))).get();
    if (!p) return { error: "That student isn't in this campaign." };
  }
  db.insert(feteDonations)
    .values({
      id: newId(),
      campaignId: campaign.id,
      participantId,
      amountCents: amount,
      donorName,
      message,
      method: "cash",
      status: "succeeded",
      recordedBy: viewer.id,
    })
    .run();
  refresh();
  return { ok: true, message: `Recorded ${formatMoney(amount)} cash. Thank you!` };
}

/* ---------------- Points ---------------- */

export async function awardPoints(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = awardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToFormState(parsed.error);
  const { viewer, campaign } = await requireStaffCampaign(parsed.data.campaignId);
  const { targetType, targetId, points, reason } = parsed.data;

  // The target must belong to this campaign / school.
  const valid =
    targetType === "student"
      ? !!db.select({ id: feteParticipants.id }).from(feteParticipants)
          .where(and(eq(feteParticipants.id, targetId), eq(feteParticipants.campaignId, campaign.id))).get()
      : targetType === "class"
        ? !!db.select({ id: classes.id }).from(classes).where(and(eq(classes.id, targetId), eq(classes.schoolId, campaign.schoolId))).get()
        : targetType === "house"
          ? !!db.select({ id: houses.id }).from(houses).where(and(eq(houses.id, targetId), eq(houses.schoolId, campaign.schoolId))).get()
          : /^(\d|1[0-2])$/.test(targetId);
  if (!valid) return { error: "Choose who should get the points.", fieldErrors: { targetId: "Choose who gets the points" } };

  db.insert(fetePointAwards)
    .values({ id: newId(), campaignId: campaign.id, targetType, targetId, points, reason, awardedBy: viewer.id })
    .run();
  refresh();
  return { ok: true, message: `${points > 0 ? "+" : ""}${points} points awarded — “${reason}”` };
}

export async function deleteAward(formData: FormData): Promise<void> {
  const award = db.select().from(fetePointAwards).where(eq(fetePointAwards.id, String(formData.get("awardId") ?? ""))).get();
  if (!award) return;
  await requireStaffCampaign(award.campaignId);
  db.delete(fetePointAwards).where(eq(fetePointAwards.id, award.id)).run();
  refresh();
}

/* ---------------- Families ---------------- */

export async function updateParticipation(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  const parsed = participationSchema.safeParse({
    participantId: formData.get("participantId") ?? "",
    pitch: formData.get("pitch") ?? undefined,
    goal: formData.get("goal") ?? "",
  });
  if (!parsed.success) return zodToFormState(parsed.error);
  const found = await canEditParticipation(viewer, parsed.data.participantId);
  if (!found) return { error: "You can only edit your own child's page." };
  if (viewer.role === "student") return { error: "Ask a grown-up to edit your page." };
  const campaign = getCampaign(found.campaign.id);
  if (!campaign || campaign.status === "closed") return { error: "This fundraiser has finished, so the page can't be changed." };

  db.update(feteParticipants)
    .set({ pitch: parsed.data.pitch, goalCents: parsed.data.goal })
    .where(eq(feteParticipants.id, found.participant.id))
    .run();
  refresh();
  return { ok: true, message: "Saved! Your page is updated." };
}
