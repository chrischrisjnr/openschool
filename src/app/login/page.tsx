import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { demoModeEnabled } from "@/lib/demo";
import { LoginView } from "./LoginView";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

/** Accounts created by `npm run db:seed`, offered as one-click logins. */
const DEMO_ACCOUNTS = [
  { email: "principal@demo.openschools.au", blurb: "Run the school: post notices, set up payments, see everything." },
  { email: "teacher@demo.openschools.au", blurb: "Mark the roll, message families, moderate your class space." },
  { email: "parent@demo.openschools.au", blurb: "Two kids at the school. Read notices, pay, give consent, chat." },
  { email: "student@demo.openschools.au", blurb: "A Year 6 student fundraising for the Colour Run." },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  const demo = demoModeEnabled()
    ? db
        .select({ email: users.email, name: users.name, role: users.role, title: users.title })
        .from(users)
        .where(inArray(users.email, DEMO_ACCOUNTS.map((a) => a.email)))
        .all()
        .map((u) => ({ ...u, blurb: DEMO_ACCOUNTS.find((a) => a.email === u.email)?.blurb ?? "" }))
        .sort((a, b) => DEMO_ACCOUNTS.findIndex((x) => x.email === a.email) - DEMO_ACCOUNTS.findIndex((x) => x.email === b.email))
    : [];
  return <LoginView next={next} demoAccounts={demo} />;
}
