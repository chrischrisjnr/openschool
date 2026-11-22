"use server";

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { newId } from "@/db/ids";
import { events, guardians, paymentItems, payments, studentCharges, students, users } from "@/db/schema";
import { ownsStudent } from "@/lib/assemble/access";
import { canManageItem, toFamilyCharge } from "@/lib/assemble/charges";
import { ITEM_CATEGORY_KEYS } from "@/lib/assemble/constants";
import { isDayKey, zonedTime } from "@/lib/assemble/dates";
import { parseAudience, studentIdsInAudience } from "@/lib/audience";
import { zodToFormState, type FormState } from "@/lib/form";
import { formatMoney, parseMoneyToCents } from "@/lib/format";
import { abandonPayment, startCheckout } from "@/lib/payments";
import { getViewer } from "@/lib/viewer";

const revalidate = () => revalidatePath("/assemble", "layout");

/* ---------- Staff: create an item ---------- */

const itemSchema = z.object({
  title: z.string().trim().min(3, "Give it a short title.").max(140, "Keep the title under 140 characters."),
  description: z.string().trim().max(5000, "That description is too long.").optional(),
  category: z.enum(ITEM_CATEGORY_KEYS as [string, ...string[]], { error: "Choose a category." }),
  amount: z.string().trim().optional(),
  requiresConsent: z.boolean(),
  dueOn: z.string().optional().refine((v) => !v || isDayKey(v), "Choose a valid date."),
  audience: z.string(),
  eventId: z.string().optional(),
});

export async function createItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.isStaff) return { error: "Only staff can create forms and payments." };
  const parsed = itemSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    category: formData.get("category"),
    amount: formData.get("amount") || undefined,
    requiresConsent: formData.get("requiresConsent") === "on",
    dueOn: formData.get("dueOn") || undefined,
    audience: formData.get("audience"),
    eventId: formData.get("eventId") || undefined,
  });
  if (!parsed.success) return zodToFormState(parsed.error);
  const v = parsed.data;

  const amountCents = v.amount ? parseMoneyToCents(v.amount) : 0;
  if (amountCents === null) return { error: "Enter the amount in dollars, e.g. 28 or 28.50.", fieldErrors: { amount: "Enter an amount like 28.50" } };
  if (amountCents > 0 && amountCents < 50) return { error: "Amounts need to be at least $0.50.", fieldErrors: { amount: "At least $0.50" } };
  if (amountCents > 500_000) return { error: "That amount looks too large.", fieldErrors: { amount: "Check the amount" } };
  if (amountCents === 0 && !v.requiresConsent) {
    return { error: "Add an amount, or ask families for consent (or both).", fieldErrors: { amount: "Add an amount or tick consent" } };
  }
  const audience = parseAudience(v.audience);
  if (!audience || audience.audienceType === "staff") {
    return { error: "Choose which students this is for.", fieldErrors: { audience: "Choose which students this is for." } };
  }
  let eventId: string | null = null;
  if (v.eventId) {
    const e = db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, v.eventId), eq(events.schoolId, viewer.schoolId)))
      .get();
    eventId = e?.id ?? null;
  }
  const studentIds = studentIdsInAudience(viewer.schoolId, audience.audienceType, audience.audienceId);
  if (!studentIds.length) return { error: "There are no students in that group yet." };

  const id = newId();
  db.transaction((tx) => {
    tx.insert(paymentItems)
      .values({
        id,
        schoolId: viewer.schoolId,
        title: v.title,
        description: v.description ?? null,
        category: v.category,
        amountCents,
        requiresConsent: v.requiresConsent,
        dueAt: v.dueOn ? zonedTime(v.dueOn, "23:59", viewer.school.timezone) : null,
        eventId,
        audienceType: audience.audienceType,
        audienceId: audience.audienceId,
        createdBy: viewer.id,
      })
      .run();
    tx.insert(studentCharges)
      .values(
        studentIds.map((studentId) => ({
          id: newId(),
          itemId: id,
          studentId,
          amountCents,
          consent: v.requiresConsent ? ("pending" as const) : null,
        })),
      )
      .run();
  });
  revalidate();
  redirect(`/assemble/payments/${id}?created=1`);
}

/* ---------- Families: consent ---------- */

/** Loads a charge the viewer (a parent) may act on, with its item. */
function familyCharge(viewer: Awaited<ReturnType<typeof getViewer>>, chargeId: string) {
  const row = db
    .select({ charge: studentCharges, item: paymentItems })
    .from(studentCharges)
    .innerJoin(paymentItems, eq(paymentItems.id, studentCharges.itemId))
    .where(and(eq(studentCharges.id, chargeId), eq(paymentItems.schoolId, viewer.schoolId)))
    .get();
  if (!row || viewer.role !== "parent" || !ownsStudent(viewer, row.charge.studentId)) return null;
  return row;
}

export async function setConsent(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const decision = z.enum(["granted", "declined"]).safeParse(formData.get("decision"));
  const row = familyCharge(viewer, String(formData.get("chargeId") ?? ""));
  if (!decision.success || !row || row.item.closed || !row.item.requiresConsent) return;
  // Once paid, consent can't be withdrawn online (the office will sort out a refund).
  if (decision.data === "declined" && row.charge.status === "paid") return;
  db.update(studentCharges)
    .set({ consent: decision.data, consentBy: viewer.id, consentAt: new Date() })
    .where(eq(studentCharges.id, row.charge.id))
    .run();
  revalidate();
}

/* ---------- Families: pay several items at once ---------- */

export async function payCharges(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (viewer.role !== "parent") return { error: "Only parents and carers can make payments." };
  const ids = [...new Set(formData.getAll("chargeId").map(String))].slice(0, 50);
  if (!ids.length) return { error: "Tick at least one item to pay." };

  const rows = ids.map((id) => familyCharge(viewer, id));
  if (rows.some((r) => !r)) return { error: "Some of those items can't be paid. Please refresh and try again." };
  const charges = rows.map((r) => ({ ...toFamilyCharge(r!), paymentId: r!.charge.paymentId }));
  const notPayable = charges.find((c) => !c.payable);
  if (notPayable) {
    return {
      error:
        notPayable.requiresConsent && notPayable.consent !== "granted"
          ? `Please give consent for “${notPayable.title}” before paying.`
          : `“${notPayable.title}” has already been paid or is closed.`,
    };
  }
  const total = charges.reduce((sum, c) => sum + c.amountCents, 0);

  // Release any earlier checkout that was started but never finished.
  for (const pid of new Set(charges.map((c) => c.paymentId).filter((p): p is string => !!p))) abandonPayment(pid);

  const names = new Map(viewer.students.map((s) => [s.id, s.preferredName ?? s.firstName]));
  const description =
    charges.length === 1
      ? `${charges[0]!.title} — ${names.get(charges[0]!.studentId)}`
      : `${charges.length} items: ${charges.map((c) => `${c.title} (${names.get(c.studentId)})`).join(", ")}`;

  let url: string;
  try {
    ({ url } = await startCheckout({
      schoolId: viewer.schoolId,
      purpose: "charges",
      description: description.length > 200 ? `${description.slice(0, 197)}…` : description,
      amountCents: total,
      payer: { userId: viewer.id, name: viewer.name, email: viewer.email },
      returnPath: "/assemble/payments",
      attach: (paymentId) => {
        db.update(studentCharges)
          .set({ paymentId })
          .where(and(inArray(studentCharges.id, ids), eq(studentCharges.status, "unpaid")))
          .run();
      },
    }));
  } catch (err) {
    console.error("Checkout failed", err);
    return { error: `We couldn't start the payment of ${formatMoney(total)}. Please try again in a moment.` };
  }
  redirect(url);
}

/* ---------- Staff: record payments, waive, close ---------- */

function managedCharge(viewer: Awaited<ReturnType<typeof getViewer>>, chargeId: string) {
  const row = db
    .select({ charge: studentCharges, item: paymentItems })
    .from(studentCharges)
    .innerJoin(paymentItems, eq(paymentItems.id, studentCharges.itemId))
    .where(and(eq(studentCharges.id, chargeId), eq(paymentItems.schoolId, viewer.schoolId)))
    .get();
  if (!row || !canManageItem(viewer, row.item)) return null;
  return row;
}

export async function markPaid(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const method = z.enum(["cash", "other"]).catch("cash").parse(formData.get("method"));
  const row = managedCharge(viewer, String(formData.get("chargeId") ?? ""));
  if (!row || row.charge.status !== "unpaid" || row.charge.amountCents <= 0) return;

  const payer = db
    .select({ name: users.name, email: users.email })
    .from(guardians)
    .innerJoin(users, eq(users.id, guardians.userId))
    .where(eq(guardians.studentId, row.charge.studentId))
    .orderBy(guardians.isPrimary)
    .all()
    .at(-1);
  const student = db.select().from(students).where(eq(students.id, row.charge.studentId)).get();
  const now = new Date();
  db.transaction((tx) => {
    if (row.charge.paymentId) {
      tx.update(payments)
        .set({ status: "cancelled", completedAt: now })
        .where(and(eq(payments.id, row.charge.paymentId), eq(payments.status, "pending")))
        .run();
    }
    const paymentId = newId();
    tx.insert(payments)
      .values({
        id: paymentId,
        schoolId: viewer.schoolId,
        provider: method,
        purpose: "charges",
        description: `${row.item.title} — ${student ? `${student.preferredName ?? student.firstName} ${student.lastName}` : "student"}`,
        amountCents: row.charge.amountCents,
        status: "succeeded",
        payerName: payer?.name ?? null,
        payerEmail: payer?.email ?? null,
        returnPath: "/assemble/payments",
        completedAt: now,
      })
      .run();
    tx.update(studentCharges).set({ status: "paid", paidAt: now, paymentId }).where(eq(studentCharges.id, row.charge.id)).run();
  });
  revalidate();
}

export async function setWaived(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const waive = formData.get("waive") === "1";
  const row = managedCharge(viewer, String(formData.get("chargeId") ?? ""));
  if (!row || row.charge.status === "paid") return;
  if (row.charge.paymentId) abandonPayment(row.charge.paymentId);
  db.update(studentCharges)
    .set({ status: waive ? "waived" : "unpaid", paymentId: null })
    .where(eq(studentCharges.id, row.charge.id))
    .run();
  revalidate();
}

export async function setItemClosed(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const itemId = String(formData.get("itemId") ?? "");
  const item = db
    .select()
    .from(paymentItems)
    .where(and(eq(paymentItems.id, itemId), eq(paymentItems.schoolId, viewer.schoolId)))
    .get();
  if (!item || !canManageItem(viewer, item)) return;
  const closed = formData.get("closed") === "1";
  db.update(paymentItems).set({ closed }).where(eq(paymentItems.id, item.id)).run();
  if (closed) {
    // Abandon checkouts still in progress for this item.
    const pending = db
      .selectDistinct({ id: studentCharges.paymentId })
      .from(studentCharges)
      .where(and(eq(studentCharges.itemId, item.id), eq(studentCharges.status, "unpaid"), isNotNull(studentCharges.paymentId)))
      .all();
    for (const p of pending) if (p.id) abandonPayment(p.id);
  }
  revalidate();
}
