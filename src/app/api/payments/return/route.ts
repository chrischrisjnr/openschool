import { NextResponse, type NextRequest } from "next/server";
import { abandonPayment, completePayment, getPayment, returnUrlFor } from "@/lib/payments";
import { retrieveCheckoutSession } from "@/lib/payments/stripe";

/**
 * Stripe Checkout sends the payer back here. We double-check the session with
 * Stripe (never trust the URL alone) and then forward to the app's page.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const payment = getPayment(url.searchParams.get("payment") ?? "");
  if (!payment) return NextResponse.redirect(new URL("/", url));

  if (url.searchParams.get("cancelled")) {
    abandonPayment(payment.id, "cancelled");
    return NextResponse.redirect(new URL(returnUrlFor(payment, "cancelled"), url));
  }

  const sessionId = url.searchParams.get("session_id");
  if (payment.provider === "stripe" && sessionId && sessionId === payment.providerRef) {
    try {
      const session = await retrieveCheckoutSession(sessionId);
      if (session.payment_status === "paid" && session.metadata.paymentId === payment.id) {
        completePayment(payment.id);
        return NextResponse.redirect(new URL(returnUrlFor(payment, "success"), url));
      }
    } catch (err) {
      console.error("Stripe session lookup failed", err);
    }
  }
  // Payment may still be processing — the webhook will complete it.
  return NextResponse.redirect(new URL(returnUrlFor(payment, "processing"), url));
}
