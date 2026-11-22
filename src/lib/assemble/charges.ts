import "server-only";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  paymentItems,
  payments,
  studentCharges,
  students,
  users,
  type ChargeStatus,
  type ConsentStatus,
} from "@/db/schema";
import type { Viewer } from "@/lib/viewer";
import { audienceLabeler } from "./audience";

export type FamilyCharge = {
  id: string;
  itemId: string;
  studentId: string;
  title: string;
  description: string | null;
  category: string;
  amountCents: number;
  dueAt: Date | null;
  requiresConsent: boolean;
  consent: ConsentStatus | null;
  status: ChargeStatus;
  paidAt: Date | null;
  closed: boolean;
  eventId: string | null;
  /** Unpaid, open, costs money and (if consent is needed) consent is granted. */
  payable: boolean;
  /** Something the family still has to do. */
  needsAction: boolean;
};

export function toFamilyCharge(row: {
  charge: typeof studentCharges.$inferSelect;
  item: typeof paymentItems.$inferSelect;
}): FamilyCharge {
  const { charge: c, item: i } = row;
  const open = !i.closed;
  const unpaid = c.status === "unpaid" && c.amountCents > 0;
  const consentPending = i.requiresConsent && c.consent === "pending";
  const declined = i.requiresConsent && c.consent === "declined";
  return {
    id: c.id,
    itemId: i.id,
    studentId: c.studentId,
    title: i.title,
    description: i.description,
    category: i.category,
    amountCents: c.amountCents,
    dueAt: i.dueAt,
    requiresConsent: i.requiresConsent,
    consent: c.consent,
    status: c.status,
    paidAt: c.paidAt,
    closed: i.closed,
    eventId: i.eventId,
    payable: open && unpaid && !declined && !consentPending,
    needsAction: open && (consentPending || (unpaid && !declined)),
  };
}

/** Charges for the viewer's own children (parents and students). */
export function familyCharges(viewer: Viewer, opts: { itemId?: string } = {}): FamilyCharge[] {
  const ids = viewer.students.map((s) => s.id);
  if (!ids.length) return [];
  return db
    .select({ charge: studentCharges, item: paymentItems })
    .from(studentCharges)
    .innerJoin(paymentItems, eq(paymentItems.id, studentCharges.itemId))
    .where(
      and(
        inArray(studentCharges.studentId, ids),
        eq(paymentItems.schoolId, viewer.schoolId),
        opts.itemId ? eq(paymentItems.id, opts.itemId) : undefined,
      ),
    )
    .orderBy(sql`${paymentItems.dueAt} is null`, asc(paymentItems.dueAt), asc(paymentItems.title))
    .all()
    .map(toFamilyCharge);
}

/** Counts for badges: things families still need to do. */
export function familyActionCount(viewer: Viewer): number {
  return familyCharges(viewer).filter((c) => c.needsAction).length;
}

export type HistoryEntry = {
  id: string;
  /** Payment id when paid online or recorded at the office with a receipt. */
  paymentId: string | null;
  date: Date;
  description: string;
  amountCents: number;
  method: string;
  lines: { student: string; title: string; amountCents: number; status: ChargeStatus }[];
};

const METHOD: Record<string, string> = { demo: "Card (demo)", stripe: "Card", cash: "Cash at office", other: "Paid at office" };
export const paymentMethodLabel = (provider: string) => METHOD[provider] ?? provider;

/** Completed payments covering the viewer's children (either parent may have paid). */
export function paymentHistory(viewer: Viewer): HistoryEntry[] {
  const ids = viewer.students.map((s) => s.id);
  if (!ids.length) return [];
  const rows = db
    .select({
      payment: payments,
      chargeAmount: studentCharges.amountCents,
      chargeStatus: studentCharges.status,
      title: paymentItems.title,
      first: students.firstName,
      preferred: students.preferredName,
    })
    .from(payments)
    .innerJoin(studentCharges, eq(studentCharges.paymentId, payments.id))
    .innerJoin(paymentItems, eq(paymentItems.id, studentCharges.itemId))
    .innerJoin(students, eq(students.id, studentCharges.studentId))
    .where(
      and(
        eq(payments.schoolId, viewer.schoolId),
        eq(payments.status, "succeeded"),
        or(inArray(studentCharges.studentId, ids), eq(payments.payerUserId, viewer.id)),
      ),
    )
    .orderBy(desc(payments.completedAt))
    .all();
  const byPayment = new Map<string, HistoryEntry>();
  for (const r of rows) {
    const p = r.payment;
    const entry =
      byPayment.get(p.id) ??
      ({
        id: p.id,
        paymentId: p.id,
        date: p.completedAt ?? p.createdAt,
        description: p.description,
        amountCents: p.amountCents,
        method: paymentMethodLabel(p.provider),
        lines: [],
      } satisfies HistoryEntry);
    entry.lines.push({ student: r.preferred ?? r.first, title: r.title, amountCents: r.chargeAmount, status: r.chargeStatus });
    byPayment.set(p.id, entry);
  }
  return [...byPayment.values()];
}

export type Receipt = {
  id: string;
  number: string;
  date: Date;
  payerName: string;
  payerEmail: string | null;
  method: string;
  amountCents: number;
  lines: { student: string; className: string | null; title: string; amountCents: number }[];
};

/** A receipt the viewer may see: their own family's, or any for admins. */
export function getReceipt(viewer: Viewer, paymentId: string): Receipt | null {
  const p = db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.schoolId, viewer.schoolId), eq(payments.purpose, "charges")))
    .get();
  if (!p || p.status !== "succeeded") return null;
  const lines = db
    .select({
      studentId: students.id,
      first: students.firstName,
      preferred: students.preferredName,
      last: students.lastName,
      className: classes.name,
      title: paymentItems.title,
      amountCents: studentCharges.amountCents,
    })
    .from(studentCharges)
    .innerJoin(paymentItems, eq(paymentItems.id, studentCharges.itemId))
    .innerJoin(students, eq(students.id, studentCharges.studentId))
    .leftJoin(classes, eq(classes.id, students.classId))
    .where(eq(studentCharges.paymentId, p.id))
    .orderBy(asc(students.firstName), asc(paymentItems.title))
    .all();
  const mine = lines.some((l) => viewer.students.some((s) => s.id === l.studentId)) || p.payerUserId === viewer.id;
  if (!mine && !viewer.isStaff) return null;
  return {
    id: p.id,
    number: p.id.slice(0, 8).toUpperCase(),
    date: p.completedAt ?? p.createdAt,
    payerName: p.payerName ?? "School family",
    payerEmail: p.payerEmail,
    method: paymentMethodLabel(p.provider),
    amountCents: p.amountCents,
    lines: lines.map((l) => ({
      student: `${l.preferred ?? l.first} ${l.last}`,
      className: l.className,
      title: l.title,
      amountCents: l.amountCents,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Staff                                                               */
/* ------------------------------------------------------------------ */

export type ItemSummary = {
  id: string;
  title: string;
  category: string;
  amountCents: number;
  requiresConsent: boolean;
  dueAt: Date | null;
  closed: boolean;
  audience: string;
  createdById: string | null;
  students: number;
  paid: number;
  waived: number;
  unpaid: number;
  consentGranted: number;
  consentDeclined: number;
  consentPending: number;
  collectedCents: number;
  outstandingCents: number;
};

const count = (cond: ReturnType<typeof sql>) => sql<number>`coalesce(sum(case when ${cond} then 1 else 0 end), 0)`;

function itemSummaries(schoolId: string, state: string, itemId?: string): ItemSummary[] {
  const label = audienceLabeler(schoolId, state);
  const rows = db
    .select({
      item: paymentItems,
      students: sql<number>`count(${studentCharges.id})`,
      paid: count(sql`${studentCharges.status} = 'paid'`),
      waived: count(sql`${studentCharges.status} = 'waived'`),
      unpaid: count(sql`${studentCharges.status} = 'unpaid' and ${studentCharges.amountCents} > 0 and coalesce(${studentCharges.consent}, '') <> 'declined'`),
      consentGranted: count(sql`${studentCharges.consent} = 'granted'`),
      consentDeclined: count(sql`${studentCharges.consent} = 'declined'`),
      consentPending: count(sql`${studentCharges.consent} = 'pending'`),
      collectedCents: sql<number>`coalesce(sum(case when ${studentCharges.status} = 'paid' then ${studentCharges.amountCents} else 0 end), 0)`,
      outstandingCents: sql<number>`coalesce(sum(case when ${studentCharges.status} = 'unpaid' and coalesce(${studentCharges.consent}, '') <> 'declined' then ${studentCharges.amountCents} else 0 end), 0)`,
    })
    .from(paymentItems)
    .leftJoin(studentCharges, eq(studentCharges.itemId, paymentItems.id))
    .where(and(eq(paymentItems.schoolId, schoolId), itemId ? eq(paymentItems.id, itemId) : undefined))
    .groupBy(paymentItems.id)
    .orderBy(asc(paymentItems.closed), sql`${paymentItems.dueAt} is null`, asc(paymentItems.dueAt))
    .all();
  return rows.map(({ item: i, ...n }) => ({
    id: i.id,
    title: i.title,
    category: i.category,
    amountCents: i.amountCents,
    requiresConsent: i.requiresConsent,
    dueAt: i.dueAt,
    closed: i.closed,
    audience: label(i.audienceType, i.audienceId),
    createdById: i.createdBy,
    ...n,
  }));
}

export const listItems = (viewer: Viewer) => itemSummaries(viewer.schoolId, viewer.school.state);

export type ItemRow = {
  chargeId: string;
  studentId: string;
  studentName: string;
  className: string | null;
  yearLevel: number;
  amountCents: number;
  status: ChargeStatus;
  consent: ConsentStatus | null;
  consentByName: string | null;
  consentAt: Date | null;
  paidAt: Date | null;
  paymentId: string | null;
  method: string | null;
};

export function itemDetail(viewer: Viewer, itemId: string) {
  const item = db
    .select()
    .from(paymentItems)
    .where(and(eq(paymentItems.id, itemId), eq(paymentItems.schoolId, viewer.schoolId)))
    .get();
  if (!item) return null;
  const summary = itemSummaries(viewer.schoolId, viewer.school.state, itemId)[0]!;
  const rows: ItemRow[] = db
    .select({
      chargeId: studentCharges.id,
      studentId: students.id,
      first: students.firstName,
      preferred: students.preferredName,
      last: students.lastName,
      className: classes.name,
      yearLevel: students.yearLevel,
      amountCents: studentCharges.amountCents,
      status: studentCharges.status,
      consent: studentCharges.consent,
      consentByName: users.name,
      consentAt: studentCharges.consentAt,
      paidAt: studentCharges.paidAt,
      paymentId: studentCharges.paymentId,
      paymentStatus: payments.status,
      provider: payments.provider,
    })
    .from(studentCharges)
    .innerJoin(students, eq(students.id, studentCharges.studentId))
    .leftJoin(classes, eq(classes.id, students.classId))
    .leftJoin(users, eq(users.id, studentCharges.consentBy))
    .leftJoin(payments, eq(payments.id, studentCharges.paymentId))
    .where(eq(studentCharges.itemId, itemId))
    .orderBy(asc(classes.name), asc(students.lastName), asc(students.firstName))
    .all()
    .map((r) => ({
      chargeId: r.chargeId,
      studentId: r.studentId,
      studentName: `${r.preferred ?? r.first} ${r.last}`,
      className: r.className,
      yearLevel: r.yearLevel,
      amountCents: r.amountCents,
      status: r.status,
      consent: r.consent,
      consentByName: r.consentByName,
      consentAt: r.consentAt,
      paidAt: r.paidAt,
      paymentId: r.paymentStatus === "succeeded" ? r.paymentId : null,
      method: r.status === "paid" && r.provider ? paymentMethodLabel(r.provider) : null,
    }));
  return { item, summary, rows };
}

/** Money owed and collected across the whole school (admins only). */
export function schoolMoneyTotals(schoolId: string) {
  const row = db
    .select({
      outstanding: sql<number>`coalesce(sum(case when ${studentCharges.status} = 'unpaid' and coalesce(${studentCharges.consent}, '') <> 'declined' then ${studentCharges.amountCents} else 0 end), 0)`,
      collected: sql<number>`coalesce(sum(case when ${studentCharges.status} = 'paid' then ${studentCharges.amountCents} else 0 end), 0)`,
      families: sql<number>`count(distinct case when ${studentCharges.status} = 'unpaid' and ${studentCharges.amountCents} > 0 and coalesce(${studentCharges.consent}, '') <> 'declined' then ${studentCharges.studentId} end)`,
    })
    .from(studentCharges)
    .innerJoin(paymentItems, eq(paymentItems.id, studentCharges.itemId))
    .where(and(eq(paymentItems.schoolId, schoolId), eq(paymentItems.closed, false)))
    .get();
  return { outstandingCents: row?.outstanding ?? 0, collectedCents: row?.collected ?? 0, studentsOwing: row?.families ?? 0 };
}

/** Can this staff member record payments / waive / close this item? */
export function canManageItem(viewer: Viewer, item: { createdBy: string | null }) {
  return viewer.isAdmin || (viewer.isStaff && item.createdBy === viewer.id);
}
