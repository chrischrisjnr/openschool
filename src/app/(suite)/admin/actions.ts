"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { newId } from "@/db/ids";
import { classes, houses, schools, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  createStudentWithGuardians,
  findOrCreateUser,
  type CreatedAccount,
} from "@/lib/admin/people";
import { parseCsvObjects } from "@/lib/csv";
import { zodToFormState, type FormState } from "@/lib/form";

const requireAdmin = () => requireUser(["admin"]);

const STATES = ["VIC", "NSW", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;
const TIMEZONES: Record<(typeof STATES)[number], string> = {
  VIC: "Australia/Melbourne",
  NSW: "Australia/Sydney",
  ACT: "Australia/Sydney",
  QLD: "Australia/Brisbane",
  WA: "Australia/Perth",
  SA: "Australia/Adelaide",
  TAS: "Australia/Hobart",
  NT: "Australia/Darwin",
};

const optional = z
  .string()
  .trim()
  .max(200)
  .transform((v) => v || null);

const schoolSchema = z.object({
  name: z.string().trim().min(3, "Enter the school's name").max(120),
  shortName: z.string().trim().min(2, "Enter a short name").max(40),
  suburb: optional,
  state: z.enum(STATES),
  phone: optional,
  email: optional,
  abn: optional,
});

export async function updateSchool(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const parsed = schoolSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToFormState(parsed.error);
  db.update(schools)
    .set({ ...parsed.data, timezone: TIMEZONES[parsed.data.state] })
    .where(eq(schools.id, me.schoolId))
    .run();
  revalidatePath("/", "layout");
  return { ok: true, message: "School details saved." };
}

export type AccountsState = (FormState & { accounts?: CreatedAccount[]; summary?: string }) | undefined;

const staffSchema = z.object({
  name: z.string().trim().min(2, "Enter their name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  title: optional,
  role: z.enum(["staff", "admin"]),
});

export async function addStaff(_prev: AccountsState, formData: FormData): Promise<AccountsState> {
  const me = await requireAdmin();
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToFormState(parsed.error);
  const res = await findOrCreateUser(me.schoolId, parsed.data);
  if (res.error) return { error: res.error };
  if (!res.created) return { error: "Someone with that email already has an account." };
  revalidatePath("/admin/people");
  return { ok: true, message: `${parsed.data.name} has been added.`, accounts: [res.created] };
}

const studentSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name").max(60),
  lastName: z.string().trim().min(1, "Enter a last name").max(60),
  className: z.string().trim().min(1, "Choose a class"),
  houseName: z.string().trim().max(40).optional(),
  guardianName: z.string().trim().min(2, "Enter a parent or carer's name").max(80),
  guardianEmail: z.string().trim().toLowerCase().email("Enter a valid email for the parent or carer"),
  relationship: z.string().trim().max(30).optional(),
  guardian2Name: z.string().trim().max(80).optional(),
  guardian2Email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Second carer's email isn't valid")]).optional(),
});

export async function addStudent(_prev: AccountsState, formData: FormData): Promise<AccountsState> {
  const me = await requireAdmin();
  const parsed = studentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToFormState(parsed.error);
  const d = parsed.data;
  const guardianList = [{ name: d.guardianName, email: d.guardianEmail, relationship: d.relationship }];
  if (d.guardian2Name && d.guardian2Email) guardianList.push({ name: d.guardian2Name, email: d.guardian2Email, relationship: "Parent" });
  const res = await createStudentWithGuardians(me.schoolId, {
    firstName: d.firstName,
    lastName: d.lastName,
    className: d.className,
    houseName: d.houseName || undefined,
    guardians: guardianList,
  });
  if (res.error) return { error: res.error };
  revalidatePath("/admin/people");
  return { ok: true, message: `${d.firstName} ${d.lastName} has been enrolled.`, accounts: res.created };
}

/**
 * CSV columns (header names are flexible about case/spaces):
 *   first_name, last_name, class, house (optional),
 *   guardian_name, guardian_email, guardian_relationship (optional),
 *   guardian2_name, guardian2_email (optional)
 */
export async function importStudents(_prev: AccountsState, formData: FormData): Promise<AccountsState> {
  const me = await requireAdmin();
  const file = formData.get("file");
  const text = file instanceof File && file.size > 0 ? await file.text() : String(formData.get("csv") ?? "");
  if (!text.trim()) return { error: "Choose a CSV file or paste CSV text." };
  if (text.length > 2_000_000) return { error: "That file is too large (2 MB max). Split it into smaller files." };
  const rows = parseCsvObjects(text);
  if (!rows.length) return { error: "No rows found. Check the file has a header row." };

  const pick = (r: Record<string, string>, ...keys: string[]) => keys.map((k) => r[k]).find((v) => v) ?? "";
  const accounts: CreatedAccount[] = [];
  const problems: string[] = [];
  let enrolled = 0;
  for (const [i, r] of rows.entries()) {
    const line = i + 2;
    const firstName = pick(r, "first_name", "firstname", "given_name");
    const lastName = pick(r, "last_name", "lastname", "surname", "family_name");
    const className = pick(r, "class", "class_name", "homeroom", "roll_class");
    const gName = pick(r, "guardian_name", "parent_name", "guardian1_name", "parent1_name");
    const gEmail = pick(r, "guardian_email", "parent_email", "guardian1_email", "parent1_email");
    if (!firstName || !lastName || !className || !gName || !z.string().email().safeParse(gEmail).success) {
      problems.push(`Row ${line}: needs first name, last name, class, and a parent name + valid email.`);
      continue;
    }
    const guardianList = [{ name: gName, email: gEmail, relationship: pick(r, "guardian_relationship", "relationship") }];
    const g2Name = pick(r, "guardian2_name", "parent2_name");
    const g2Email = pick(r, "guardian2_email", "parent2_email");
    if (g2Name && z.string().email().safeParse(g2Email).success) guardianList.push({ name: g2Name, email: g2Email, relationship: "" });
    const res = await createStudentWithGuardians(me.schoolId, {
      firstName,
      lastName,
      className,
      houseName: pick(r, "house") || undefined,
      guardians: guardianList,
    });
    if (res.error) problems.push(`Row ${line}: ${res.error}`);
    else {
      enrolled++;
      accounts.push(...res.created);
    }
  }
  revalidatePath("/admin", "layout");
  return {
    ok: enrolled > 0,
    error: problems.length ? problems.slice(0, 20).join("\n") + (problems.length > 20 ? `\n…and ${problems.length - 20} more` : "") : undefined,
    summary: `Enrolled ${enrolled} of ${rows.length} students and created ${accounts.length} new family accounts.`,
    accounts,
  };
}

export async function setUserDisabled(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const userId = String(formData.get("userId"));
  if (userId === me.id) return; // never lock yourself out
  db.update(users)
    .set({ disabled: formData.get("disabled") === "true" })
    .where(and(eq(users.id, userId), eq(users.schoolId, me.schoolId)))
    .run();
  revalidatePath("/admin/people");
}

const classSchema = z.object({
  name: z.string().trim().min(1, "Enter a class name").max(30),
  yearLevel: z.coerce.number().int().min(0).max(12),
  teacherId: z.string().optional(),
  room: optional,
});

export async function addClass(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const parsed = classSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToFormState(parsed.error);
  const teacherId = await validTeacher(me.schoolId, parsed.data.teacherId);
  db.insert(classes)
    .values({ id: newId(), schoolId: me.schoolId, name: parsed.data.name, yearLevel: parsed.data.yearLevel, teacherId, room: parsed.data.room })
    .run();
  revalidatePath("/admin/classes");
  return { ok: true, message: `Class ${parsed.data.name} added.` };
}

export async function setClassTeacher(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const teacherId = await validTeacher(me.schoolId, String(formData.get("teacherId") ?? ""));
  db.update(classes)
    .set({ teacherId })
    .where(and(eq(classes.id, String(formData.get("classId"))), eq(classes.schoolId, me.schoolId)))
    .run();
  revalidatePath("/admin/classes");
}

async function validTeacher(schoolId: string, id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const t = db.select().from(users).where(and(eq(users.id, id), eq(users.schoolId, schoolId))).get();
  return t && (t.role === "staff" || t.role === "admin") ? t.id : null;
}

const houseSchema = z.object({
  name: z.string().trim().min(1, "Enter a house name").max(30),
  color: z.enum(["blue", "green", "red", "yellow", "purple", "orange", "pink"]),
});

export async function addHouse(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const parsed = houseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToFormState(parsed.error);
  db.insert(houses).values({ id: newId(), schoolId: me.schoolId, ...parsed.data }).run();
  revalidatePath("/admin/classes");
  return { ok: true, message: `${parsed.data.name} house added.` };
}
