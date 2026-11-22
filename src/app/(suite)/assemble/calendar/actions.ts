"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { newId } from "@/db/ids";
import { events } from "@/db/schema";
import { EVENT_CATEGORY_KEYS } from "@/lib/assemble/constants";
import { addDays, daysBetween, isDayKey, zonedTime } from "@/lib/assemble/dates";
import { parseAudience } from "@/lib/audience";
import { zodToFormState, type FormState } from "@/lib/form";
import { getViewer } from "@/lib/viewer";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time.");

const eventSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(3, "Give the event a title.").max(140, "Keep the title under 140 characters."),
    description: z.string().trim().max(5000, "That description is too long.").optional(),
    location: z.string().trim().max(200, "Keep the location short.").optional(),
    category: z.enum(EVENT_CATEGORY_KEYS as [string, ...string[]], { error: "Choose a category." }),
    audience: z.string(),
    date: z.string().refine(isDayKey, "Choose a date."),
    endDate: z.string().optional().refine((v) => !v || isDayKey(v), "Choose a valid end date."),
    allDay: z.boolean(),
    startTime: time.optional(),
    endTime: time.optional(),
  })
  .superRefine((v, ctx) => {
    const end = v.endDate || v.date;
    if (end < v.date) ctx.addIssue({ code: "custom", path: ["endDate"], message: "The end date is before the start date." });
    if (daysBetween(v.date, end) > 60) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Events can run for up to 60 days." });
    if (!v.allDay) {
      if (!v.startTime) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Choose a start time." });
      if (!v.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Choose a finish time." });
      if (v.startTime && v.endTime && end === v.date && v.endTime <= v.startTime) {
        ctx.addIssue({ code: "custom", path: ["endTime"], message: "The finish time is before the start time." });
      }
    }
  });

export async function saveEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.isStaff) return { error: "Only staff can add calendar events." };

  const allDay = formData.get("allDay") === "on";
  const parsed = eventSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    location: formData.get("location") || undefined,
    category: formData.get("category"),
    audience: formData.get("audience"),
    date: formData.get("date"),
    endDate: formData.get("endDate") || undefined,
    allDay,
    startTime: allDay ? undefined : formData.get("startTime") || undefined,
    endTime: allDay ? undefined : formData.get("endTime") || undefined,
  });
  if (!parsed.success) return zodToFormState(parsed.error);
  const v = parsed.data;
  const audience = parseAudience(v.audience);
  if (!audience) return { error: "Choose who the event is for." };

  const tz = viewer.school.timezone;
  const end = v.endDate || v.date;
  const values = {
    title: v.title,
    description: v.description ?? null,
    location: v.location ?? null,
    category: v.category as (typeof EVENT_CATEGORY_KEYS)[number],
    audienceType: audience.audienceType,
    audienceId: audience.audienceId,
    allDay: v.allDay,
    startsAt: zonedTime(v.date, v.allDay ? "00:00" : v.startTime, tz),
    endsAt: v.allDay ? zonedTime(addDays(end, 1), "00:00", tz) : zonedTime(end, v.endTime, tz),
  };

  let id = v.id;
  if (id) {
    const existing = db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, id), eq(events.schoolId, viewer.schoolId)))
      .get();
    if (!existing) return { error: "That event no longer exists." };
    db.update(events).set(values).where(eq(events.id, id)).run();
  } else {
    id = newId();
    db.insert(events).values({ id, schoolId: viewer.schoolId, createdBy: viewer.id, ...values }).run();
  }
  revalidatePath("/assemble", "layout");
  redirect(`/assemble/calendar/${id}`);
}

export async function deleteEvent(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!viewer.isStaff) redirect("/assemble/calendar");
  const id = String(formData.get("id") ?? "");
  db.delete(events).where(and(eq(events.id, id), eq(events.schoolId, viewer.schoolId))).run();
  revalidatePath("/assemble", "layout");
  redirect("/assemble/calendar?deleted=1");
}
