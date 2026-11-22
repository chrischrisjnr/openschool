"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { newId } from "@/db/ids";
import { noticeReads, notices } from "@/db/schema";
import { NOTICE_CATEGORY_KEYS } from "@/lib/assemble/constants";
import { isDayKey, zonedTime } from "@/lib/assemble/dates";
import { getNotice } from "@/lib/assemble/notices";
import { parseAudience } from "@/lib/audience";
import { zodToFormState, type FormState } from "@/lib/form";
import { getViewer } from "@/lib/viewer";

const noticeSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, "Give the notice a short title.").max(140, "Keep the title under 140 characters."),
  body: z.string().trim().min(10, "Write a little more in the notice.").max(10_000, "That notice is too long."),
  category: z.enum(NOTICE_CATEGORY_KEYS as [string, ...string[]], { error: "Choose a category." }),
  audience: z.string(),
  pinned: z.boolean(),
  requiresAck: z.boolean(),
  expiresOn: z
    .string()
    .optional()
    .refine((v) => !v || isDayKey(v), "Choose a valid date."),
});

export async function saveNotice(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.isStaff) return { error: "Only staff can post notices." };

  const parsed = noticeSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    body: formData.get("body"),
    category: formData.get("category"),
    audience: formData.get("audience"),
    pinned: formData.get("pinned") === "on",
    requiresAck: formData.get("requiresAck") === "on",
    expiresOn: formData.get("expiresOn") || undefined,
  });
  if (!parsed.success) return zodToFormState(parsed.error);
  const v = parsed.data;
  const audience = parseAudience(v.audience);
  if (!audience) return { error: "Choose who the notice is for.", fieldErrors: { audience: "Choose who the notice is for." } };

  const tz = viewer.school.timezone;
  const expiresAt = v.expiresOn ? zonedTime(v.expiresOn, "23:59", tz) : null;
  if (expiresAt && expiresAt <= new Date()) {
    return { error: "The expiry date needs to be in the future.", fieldErrors: { expiresOn: "Choose a future date." } };
  }
  const values = {
    title: v.title,
    body: v.body,
    category: v.category,
    audienceType: audience.audienceType,
    audienceId: audience.audienceId,
    pinned: v.pinned,
    requiresAck: v.requiresAck,
    expiresAt,
  };

  let id = v.id;
  if (id) {
    const existing = db
      .select({ id: notices.id })
      .from(notices)
      .where(and(eq(notices.id, id), eq(notices.schoolId, viewer.schoolId)))
      .get();
    if (!existing) return { error: "That notice no longer exists." };
    db.update(notices).set(values).where(eq(notices.id, id)).run();
  } else {
    id = newId();
    const now = new Date();
    db.insert(notices)
      .values({ id, schoolId: viewer.schoolId, authorId: viewer.id, publishedAt: now, ...values })
      .run();
    // The author has obviously read their own notice.
    db.insert(noticeReads)
      .values({ noticeId: id, userId: viewer.id, readAt: now, acknowledgedAt: v.requiresAck ? now : null })
      .run();
  }
  revalidatePath("/assemble", "layout");
  redirect(`/assemble/notices/${id}`);
}

export async function deleteNotice(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!viewer.isStaff) redirect("/assemble/notices");
  const id = String(formData.get("id") ?? "");
  db.delete(notices).where(and(eq(notices.id, id), eq(notices.schoolId, viewer.schoolId))).run();
  revalidatePath("/assemble", "layout");
  redirect("/assemble/notices?deleted=1");
}

export async function acknowledgeNotice(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = String(formData.get("id") ?? "");
  const found = getNotice(viewer, id);
  if (!found || !found.notice.requiresAck) return;
  const now = new Date();
  db.insert(noticeReads)
    .values({ noticeId: id, userId: viewer.id, readAt: now, acknowledgedAt: now })
    .onConflictDoUpdate({ target: [noticeReads.noticeId, noticeReads.userId], set: { acknowledgedAt: now } })
    .run();
  revalidatePath("/assemble", "layout");
}
