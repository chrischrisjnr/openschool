import { NextResponse, type NextRequest } from "next/server";
import { abandonPayment, completePayment } from "@/lib/payments";
import { verifyWebhook } from "@/lib/payments/stripe";

/**
 * Stripe webhook. In the Stripe dashboard add an endpoint pointing at
 *   https://<your-domain>/api/payments/stripe/webhook
 * for the events checkout.session.completed,
 * checkout.session.async_payment_succeeded, checkout.session.async_payment_failed
 * and checkout.session.expired, then set STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const payload = await req.text();
  if (!verifyWebhook(payload, req.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(payload) as {
    type: string;
    data: { object: { payment_status?: string; metadata?: Record<string, string> } };
  };
  const obj = event.data.object;
  const paymentId = obj.metadata?.paymentId;
  if (paymentId) {
    switch (event.type) {
      case "checkout.session.completed":
        if (obj.payment_status === "paid") completePayment(paymentId);
        break;
      case "checkout.session.async_payment_succeeded":
        completePayment(paymentId);
        break;
      case "checkout.session.async_payment_failed":
        abandonPayment(paymentId, "failed");
        break;
      case "checkout.session.expired":
        abandonPayment(paymentId, "cancelled");
        break;
    }
  }
  return NextResponse.json({ received: true });
}
