"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { requireUser } from "@/lib/auth";
import { demoModeEnabled } from "@/lib/demo";

import type { FormState } from "@/lib/form";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

/** Only allow redirects to local paths (prevents open-redirects). */
function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { email, password, next } = parsed.data;
  const user = db.select().from(users).where(eq(users.email, email)).get();
  // Always run a hash comparison to keep response times similar.
  const ok = await verifyPassword(password, user?.passwordHash ?? "scrypt$AAAA$AAAA");
  if (!user || !ok || user.disabled) return { error: "That email and password don't match." };
  await createSession(user.id);
  redirect(safeNext(next));
}

/** One-click sign-in for the seeded demo accounts. Disabled unless DEMO_MODE is on. */
export async function signInAsDemo(formData: FormData): Promise<void> {
  if (!demoModeEnabled()) redirect("/login");
  const email = String(formData.get("email") ?? "").toLowerCase();
  const user = db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.disabled, false)))
    .get();
  if (!user || !email.endsWith("@demo.openschools.au")) redirect("/login");
  await createSession(user.id);
  redirect("/");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z.string().min(10, "Use at least 10 characters"),
  })
  .strict();

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const row = db.select().from(users).where(eq(users.id, me.id)).get();
  if (!row || !(await verifyPassword(parsed.data.current, row.passwordHash))) {
    return { error: "Your current password is incorrect." };
  }
  db.update(users)
    .set({ passwordHash: await hashPassword(parsed.data.next) })
    .where(eq(users.id, me.id))
    .run();
  return { ok: true, message: "Password updated." };
}
