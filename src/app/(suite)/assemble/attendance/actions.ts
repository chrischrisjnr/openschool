"use server";

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { newId } from "@/db/ids";
import { absenceNotes, attendance, classes, students, type AttendanceStatus } from "@/db/schema";
import { ownsStudent } from "@/lib/assemble/access";
import { ABSENCE_REASON_KEYS } from "@/lib/assemble/constants";
import { daysBetween, isDayKey, isWeekend, todayKey } from "@/lib/assemble/dates";
import { zodToFormState, type FormState } from "@/lib/form";
import { getViewer } from "@/lib/viewer";

const revalidate = () => revalidatePath("/assemble", "layout");

/* ---------- Families: report an absence ---------- */

const absenceSchema = z
  .object({
    studentId: z.string().min(1, "Choose your child."),
    fromDate: z.string().refine(isDayKey, "Choose the first day away."),
    toDate: z.string().optional().refine((v) => !v || isDayKey(v), "Choose the last day away."),
    reason: z.enum(ABSENCE_REASON_KEYS as [string, ...string[]], { error: "Choose a reason." }),
    note: z.string().trim().max(1000, "Keep the note under 1,000 characters.").optional(),
  })
  .superRefine((v, ctx) => {
    const to = v.toDate || v.fromDate;
    if (to < v.fromDate) ctx.addIssue({ code: "custom", path: ["toDate"], message: "The last day is before the first day." });
    if (daysBetween(v.fromDate, to) > 60) ctx.addIssue({ code: "custom", path: ["toDate"], message: "Absences can be up to 60 days. For longer, please contact the office." });
  });

export async function reportAbsence(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (viewer.role !== "parent") return { error: "Only parents and carers can report absences." };
  const parsed = absenceSchema.safeParse({
    studentId: formData.get("studentId"),
    fromDate: formData.get("fromDate"),
    toDate: formData.get("toDate") || undefined,
    reason: formData.get("reason"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return zodToFormState(parsed.error);
  const v = parsed.data;
  if (!ownsStudent(viewer, v.studentId)) return { error: "You can only report absences for your own children." };
  const today = todayKey(viewer.school.timezone);
  if (daysBetween(v.fromDate, today) > 90) {
    return { error: "That's more than 90 days ago — please contact the office.", fieldErrors: { fromDate: "Too far in the past" } };
  }
  if (daysBetween(today, v.fromDate) > 180) {
    return { error: "That's a long way ahead — please choose a date in the next six months.", fieldErrors: { fromDate: "Too far ahead" } };
  }

  db.insert(absenceNotes)
    .values({
      id: newId(),
      studentId: v.studentId,
      submittedBy: viewer.id,
      fromDate: v.fromDate,
      toDate: v.toDate || v.fromDate,
      reason: v.reason as (typeof ABSENCE_REASON_KEYS)[number],
      note: v.note ?? null,
    })
    .run();
  revalidate();
  redirect("/assemble/attendance?reported=1");
}

/* ---------- Staff: mark the roll ---------- */

const STATUSES = ["present", "absent", "late", "excused"] as const;

export async function saveRoll(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.isStaff) return { error: "Only staff can mark the roll." };
  const classId = String(formData.get("classId") ?? "");
  const date = String(formData.get("date") ?? "");
  if (!isDayKey(date)) return { error: "Choose a date." };
  if (isWeekend(date)) return { error: "That's a weekend — choose a school day." };
  if (date > todayKey(viewer.school.timezone)) return { error: "You can't mark a roll for a future day." };
  const cls = db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.schoolId, viewer.schoolId)))
    .get();
  if (!cls) return { error: "That class wasn't found." };

  const roster = new Set(
    db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.classId, cls.id), eq(students.active, true)))
      .all()
      .map((s) => s.id),
  );
  const marks: { studentId: string; status: AttendanceStatus; note: string | null }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status:")) continue;
    const studentId = key.slice(7);
    const status = STATUSES.find((s) => s === value);
    if (!roster.has(studentId) || !status) continue;
    const note = String(formData.get(`note:${studentId}`) ?? "").trim().slice(0, 200) || null;
    marks.push({ studentId, status, note });
  }
  if (!marks.length) return { error: "Mark at least one student." };

  const now = new Date();
  db.transaction((tx) => {
    for (const m of marks) {
      tx.insert(attendance)
        .values({ id: newId(), studentId: m.studentId, date, status: m.status, note: m.note, recordedBy: viewer.id, recordedAt: now })
        .onConflictDoUpdate({
          target: [attendance.studentId, attendance.date],
          set: { status: m.status, note: m.note, recordedBy: viewer.id, recordedAt: now },
        })
        .run();
    }
  });
  revalidate();
  const missing = roster.size - marks.length;
  return {
    ok: true,
    message: missing > 0 ? `Roll saved. ${missing} student${missing === 1 ? " is" : "s are"} still unmarked.` : `Roll saved for ${cls.name}. Thank you!`,
  };
}

/* ---------- Staff: approve absence notes ---------- */

export async function approveNote(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!viewer.isStaff) return;
  const id = String(formData.get("noteId") ?? "");
  const note = db
    .select({ note: absenceNotes })
    .from(absenceNotes)
    .innerJoin(students, eq(students.id, absenceNotes.studentId))
    .where(and(eq(absenceNotes.id, id), eq(students.schoolId, viewer.schoolId)))
    .get()?.note;
  if (!note || note.status === "approved") return;
  db.transaction((tx) => {
    tx.update(absenceNotes).set({ status: "approved", reviewedBy: viewer.id }).where(eq(absenceNotes.id, note.id)).run();
    // Absences already on the roll for those days become explained.
    tx.update(attendance)
      .set({ status: "excused" })
      .where(
        and(
          eq(attendance.studentId, note.studentId),
          gte(attendance.date, note.fromDate),
          lte(attendance.date, note.toDate),
          inArray(attendance.status, ["absent"]),
        ),
      )
      .run();
  });
  revalidate();
}
