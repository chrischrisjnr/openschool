"use server";

import { redirect } from "next/navigation";
import { abandonPayment, completePayment, getPayment, returnUrlFor } from "@/lib/payments";

export async function confirmDemoPayment(formData: FormData): Promise<void> {
  const payment = getPayment(String(formData.get("paymentId")));
  if (!payment || payment.provider !== "demo") redirect("/");
  completePayment(payment.id);
  redirect(returnUrlFor(payment, "success"));
}

export async function cancelDemoPayment(formData: FormData): Promise<void> {
  const payment = getPayment(String(formData.get("paymentId")));
  if (!payment || payment.provider !== "demo") redirect("/");
  abandonPayment(payment.id, "cancelled");
  redirect(returnUrlFor(payment, "cancelled"));
}
