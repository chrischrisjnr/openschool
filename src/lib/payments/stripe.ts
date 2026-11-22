import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal Stripe client using the REST API directly (no SDK dependency).
 * Docs: https://docs.stripe.com/api/checkout/sessions
 */

const API = "https://api.stripe.com/v1";

function key(): string {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("STRIPE_SECRET_KEY is not set");
  return k;
}

async function call<T>(method: "GET" | "POST", path: string, body?: Record<string, string>): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) throw new Error(`Stripe: ${json.error?.message ?? res.statusText}`);
  return json;
}

export type CheckoutSession = {
  id: string;
  url: string;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  metadata: Record<string, string>;
};

export function createCheckoutSession(input: {
  paymentId: string;
  description: string;
  amountCents: number;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSession> {
  const body: Record<string, string> = {
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.paymentId,
    "metadata[paymentId]": input.paymentId,
    "payment_intent_data[metadata][paymentId]": input.paymentId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "aud",
    "line_items[0][price_data][unit_amount]": String(input.amountCents),
    "line_items[0][price_data][product_data][name]": input.description.slice(0, 250),
  };
  if (input.customerEmail) body.customer_email = input.customerEmail;
  return call<CheckoutSession>("POST", "/checkout/sessions", body);
}

export function retrieveCheckoutSession(id: string): Promise<CheckoutSession> {
  return call<CheckoutSession>("GET", `/checkout/sessions/${encodeURIComponent(id)}`);
}

/**
 * Verifies a Stripe webhook signature header ("t=...,v1=...").
 * https://docs.stripe.com/webhooks#verify-manually
 */
export function verifyWebhook(payload: string, header: string | null, toleranceSec = 300): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=", 2) as [string, string]),
  );
  const timestamp = Number(parts.t);
  const signatures = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return signatures.some((sig) => {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
