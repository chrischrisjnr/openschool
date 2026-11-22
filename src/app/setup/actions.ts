"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { newId } from "@/db/ids";
import { schools, users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { zodToFormState, type FormState } from "@/lib/form";
import { hashPassword } from "@/lib/password";

const TIMEZONES = {
  VIC: "Australia/Melbourne",
  NSW: "Australia/Sydney",
  ACT: "Australia/Sydney",
  QLD: "Australia/Brisbane",
  WA: "Australia/Perth",
  SA: "Australia/Adelaide",
  TAS: "Australia/Hobart",
  NT: "Australia/Darwin",
} as const;

const schema = z.object({
  schoolName: z.string().trim().min(3, "Enter your school's name").max(120),
  suburb: z.string().trim().max(80).optional(),
  state: z.enum(Object.keys(TIMEZONES) as [keyof typeof TIMEZONES, ...(keyof typeof TIMEZONES)[]]),
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters for your password"),
});

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "school";

/** First-run: creates the school and its first admin. Only works on an empty database. */
export async function setupSchool(_prev: FormState, formData: FormData): Promise<FormState> {
  if (db.select().from(schools).get()) redirect("/login");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToFormState(parsed.error);
  const d = parsed.data;
  const schoolId = newId();
  const userId = newId();
  const passwordHash = await hashPassword(d.password);
  db.transaction((tx) => {
    tx.insert(schools)
      .values({
        id: schoolId,
        name: d.schoolName,
        shortName: d.schoolName.replace(/\bPrimary School\b/i, "PS").replace(/\bSecondary College\b/i, "SC"),
        slug: slugify(d.schoolName),
        suburb: d.suburb || null,
        state: d.state,
        timezone: TIMEZONES[d.state],
      })
      .run();
    tx.insert(users)
      .values({ id: userId, schoolId, email: d.email, name: d.name, role: "admin", title: "Administrator", passwordHash })
      .run();
  });
  await createSession(userId);
  redirect("/admin/import");
}
