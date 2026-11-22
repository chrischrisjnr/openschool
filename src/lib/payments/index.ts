import "server-only";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { newId } from "@/db/ids";
import {
  feteDonations,
  payments,
  studentCharges,
  type Payment,
  type PaymentPurpose,
} from "@/db/schema";
import * as stripe from "./stripe";

/**
 * Payments for the whole suite.
 *
 * Two providers are supported:
 * - "demo"   — the default. A simulated checkout page; no money moves. Great
 *              for trying Open Schools out, training staff, or schools that
 *              take payments elsewhere.
 * - "stripe" — real card / Apple Pay / Google Pay payments via Stripe
 *              Checkout. Enabled by setting STRIPE_SECRET_KEY (and
 *              STRIPE_WEBHOOK_SECRET for the webhook).
 *
 * Usage (inside a server action):
 *
 *   const { url } = await startCheckout({
 *     schoolId, purpose: "charges", amountCents, description: "Zoo excursion",
 *     payer: { userId, name, email }, returnPath: "/assemble/payments",
 *     attach: (paymentId) => { ...link your rows to paymentId... },
 *   });
 *   redirect(url);
 *
 * When the payment succeeds, completePayment() marks linked rows as paid:
 *   purpose "charges"  → student_charges.payment_id = id → status "paid"
 *   purpose "donation" → fete_donations.payment_id = id  → status "succeeded"
 */

export type PaymentProvider = "demo" | "stripe";

export function activeProvider(): PaymentProvider {
  return process.env.STRIPE_SECRET_KEY ? "stripe" : "demo";
}

/** Absolute base URL of this deployment, e.g. "https://school.example.org". */
export async function appBaseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type StartCheckoutInput = {
  schoolId: string;
  purpose: PaymentPurpose;
  description: string;
  amountCents: number;
  payer: { userId?: string | null; name?: string | null; email?: string | null };
  /** Relative path to return to afterwards. `?payment=<id>` is appended. */
  returnPath: string;
  /** Link your own rows to the new payment id. Runs in the same transaction. */
  attach: (paymentId: string) => void;
};

export async function startCheckout(
  input: StartCheckoutInput,
): Promise<{ paymentId: string; url: string }> {
  if (!Number.isInteger(input.amountCents) || input.amountCents < 50) {
    throw new Error("Payments must be at least $0.50");
  }
  if (!input.returnPath.startsWith("/")) throw new Error("returnPath must be relative");

  const provider = activeProvider();
  const paymentId = newId();
  db.transaction((tx) => {
    tx.insert(payments)
      .values({
        id: paymentId,
        schoolId: input.schoolId,
        provider,
        purpose: input.purpose,
        description: input.description,
        amountCents: input.amountCents,
        payerUserId: input.payer.userId ?? null,
        payerName: input.payer.name ?? null,
        payerEmail: input.payer.email ?? null,
        returnPath: input.returnPath,
      })
      .run();
    input.attach(paymentId);
  });

  if (provider === "demo") return { paymentId, url: `/pay/${paymentId}` };

  const base = await appBaseUrl();
  const session = await stripe.createCheckoutSession({
    paymentId,
    description: input.description,
    amountCents: input.amountCents,
    customerEmail: input.payer.email ?? undefined,
    successUrl: `${base}/api/payments/return?payment=${paymentId}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}/api/payments/return?payment=${paymentId}&cancelled=1`,
  });
  db.update(payments).set({ providerRef: session.id }).where(eq(payments.id, paymentId)).run();
  return { paymentId, url: session.url };
}

export function getPayment(id: string): Payment | undefined {
  return db.select().from(payments).where(eq(payments.id, id)).get();
}

/**
 * Marks a payment as succeeded and fulfils whatever it paid for.
 * Idempotent: safe to call from both the redirect and the webhook.
 */
export function completePayment(paymentId: string): boolean {
  return db.transaction((tx) => {
    const updated = tx
      .update(payments)
      .set({ status: "succeeded", completedAt: new Date() })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")))
      .returning({ purpose: payments.purpose })
      .get();
    if (!updated) return false;
    if (updated.purpose === "charges") {
      tx.update(studentCharges)
        .set({ status: "paid", paidAt: new Date() })
        .where(and(eq(studentCharges.paymentId, paymentId), eq(studentCharges.status, "unpaid")))
        .run();
    } else {
      tx.update(feteDonations)
        .set({ status: "succeeded" })
        .where(and(eq(feteDonations.paymentId, paymentId), eq(feteDonations.status, "pending")))
        .run();
    }
    return true;
  });
}

/** Marks a pending payment as cancelled/failed and releases linked rows. */
export function abandonPayment(paymentId: string, status: "cancelled" | "failed" = "cancelled") {
  db.transaction((tx) => {
    const updated = tx
      .update(payments)
      .set({ status, completedAt: new Date() })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")))
      .returning({ purpose: payments.purpose })
      .get();
    if (!updated) return;
    if (updated.purpose === "charges") {
      tx.update(studentCharges)
        .set({ paymentId: null })
        .where(and(eq(studentCharges.paymentId, paymentId), eq(studentCharges.status, "unpaid")))
        .run();
    } else {
      tx.update(feteDonations)
        .set({ status: "failed" })
        .where(and(eq(feteDonations.paymentId, paymentId), eq(feteDonations.status, "pending")))
        .run();
    }
  });
}

/** Appends ?payment=<id>&status=<s> to a payment's return path. */
export function returnUrlFor(payment: Pick<Payment, "id" | "returnPath">, status: string): string {
  const sep = payment.returnPath.includes("?") ? "&" : "?";
  return `${payment.returnPath}${sep}payment=${payment.id}&status=${status}`;
}
