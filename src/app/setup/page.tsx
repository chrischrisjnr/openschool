import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { SetupView } from "./SetupView";

export const metadata: Metadata = { title: "Set up your school" };
export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (db.select().from(schools).get()) redirect("/login");
  return <SetupView />;
}
