import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { getPayment, returnUrlFor } from "@/lib/payments";
import { DemoCheckout } from "./DemoCheckout";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Simulated checkout used when Stripe isn't configured ("demo" provider).
 * Payment ids are unguessable, so this page is safe to show without login
 * (donors to FETE pages usually aren't signed in).
 */
export default async function DemoCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payment = getPayment(id);
  if (!payment || payment.provider !== "demo") notFound();
  if (payment.status === "succeeded") redirect(returnUrlFor(payment, "success"));
  if (payment.status !== "pending") redirect(returnUrlFor(payment, "cancelled"));
  const school = db.select().from(schools).where(eq(schools.id, payment.schoolId)).get();
  return (
    <DemoCheckout
      paymentId={payment.id}
      description={payment.description}
      amountCents={payment.amountCents}
      schoolName={school?.name ?? "School"}
      payerEmail={payment.payerEmail ?? ""}
    />
  );
}
