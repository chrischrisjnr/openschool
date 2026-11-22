import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db";
import {
  classes,
  feteCampaigns,
  feteDonations,
  feteParticipants,
  fetePointAwards,
  fetePrizeTiers,
  houses,
  schools,
  students,
  users,
} from "@/db/schema";
import { yearLabel } from "@/lib/format";
import { appBaseUrl } from "@/lib/payments";
import { getRaisedByCampaign, getScoreboard } from "./scoring";
import { campaignPath, studentPath } from "./share";
import type { PrizeTier } from "./tiers";

export type Campaign = typeof feteCampaigns.$inferSelect;
export type CampaignStatus = Campaign["status"];

/* ---------- Campaigns ---------- */

export function getCampaign(id: string): Campaign | undefined {
  return db.select().from(feteCampaigns).where(eq(feteCampaigns.id, id)).get();
}

export function getCampaignBySlug(slug: string) {
  return db
    .select({ campaign: feteCampaigns, school: schools })
    .from(feteCampaigns)
    .innerJoin(schools, eq(schools.id, feteCampaigns.schoolId))
    .where(eq(feteCampaigns.slug, slug))
    .get();
}

export function slugTaken(slug: string, exceptId?: string): boolean {
  return !!db
    .select({ id: feteCampaigns.id })
    .from(feteCampaigns)
    .where(and(eq(feteCampaigns.slug, slug), exceptId ? ne(feteCampaigns.id, exceptId) : undefined))
    .get();
}

const STATUS_ORDER: Record<CampaignStatus, number> = { live: 0, draft: 1, closed: 2 };

/** All campaigns for a school with their raised totals, live first. */
export function listCampaigns(schoolId: string) {
  const raised = getRaisedByCampaign(db, schoolId);
  const counts = new Map(
    db
      .select({ id: feteParticipants.campaignId, n: sql<number>`count(*)` })
      .from(feteParticipants)
      .innerJoin(feteCampaigns, eq(feteCampaigns.id, feteParticipants.campaignId))
      .where(eq(feteCampaigns.schoolId, schoolId))
      .groupBy(feteParticipants.campaignId)
      .all()
      .map((r) => [r.id, Number(r.n)]),
  );
  return db
    .select()
    .from(feteCampaigns)
    .where(eq(feteCampaigns.schoolId, schoolId))
    .orderBy(desc(feteCampaigns.startsAt))
    .all()
    .map((c) => ({ ...c, raisedCents: raised.get(c.id) ?? 0, participantCount: counts.get(c.id) ?? 0 }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

export function liveCampaigns(schoolId: string): Campaign[] {
  return db
    .select()
    .from(feteCampaigns)
    .where(and(eq(feteCampaigns.schoolId, schoolId), eq(feteCampaigns.status, "live")))
    .orderBy(asc(feteCampaigns.endsAt))
    .all();
}

export function getTiers(campaignId: string): PrizeTier[] {
  return db
    .select({
      id: fetePrizeTiers.id,
      name: fetePrizeTiers.name,
      emoji: fetePrizeTiers.emoji,
      thresholdCents: fetePrizeTiers.thresholdCents,
      description: fetePrizeTiers.description,
    })
    .from(fetePrizeTiers)
    .where(eq(fetePrizeTiers.campaignId, campaignId))
    .orderBy(asc(fetePrizeTiers.thresholdCents))
    .all();
}

export function scoreboard(campaignId: string) {
  const board = getScoreboard(db, campaignId);
  if (!board) throw new Error(`Campaign ${campaignId} not found`);
  return board;
}

/* ---------- Participants ---------- */

/** A participant by public code, with campaign, school, student and class. */
export function getParticipantByCode(slug: string, code: string) {
  return db
    .select({
      participant: feteParticipants,
      campaign: feteCampaigns,
      school: schools,
      student: {
        id: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        preferredName: students.preferredName,
        yearLevel: students.yearLevel,
        classId: students.classId,
        houseId: students.houseId,
      },
      className: classes.name,
      houseName: houses.name,
      houseColor: houses.color,
    })
    .from(feteParticipants)
    .innerJoin(feteCampaigns, eq(feteCampaigns.id, feteParticipants.campaignId))
    .innerJoin(schools, eq(schools.id, feteCampaigns.schoolId))
    .innerJoin(students, eq(students.id, feteParticipants.studentId))
    .leftJoin(classes, eq(classes.id, students.classId))
    .leftJoin(houses, eq(houses.id, students.houseId))
    .where(and(eq(feteParticipants.code, code), eq(feteCampaigns.slug, slug)))
    .get();
}

export function getParticipant(id: string) {
  return db
    .select({ participant: feteParticipants, campaign: feteCampaigns })
    .from(feteParticipants)
    .innerJoin(feteCampaigns, eq(feteCampaigns.id, feteParticipants.campaignId))
    .where(eq(feteParticipants.id, id))
    .get();
}

/** Every campaign participation for these students (newest campaign first). */
export function participationsFor(studentIds: string[], schoolId: string) {
  if (!studentIds.length) return [];
  return db
    .select({ participant: feteParticipants, campaign: feteCampaigns })
    .from(feteParticipants)
    .innerJoin(feteCampaigns, eq(feteCampaigns.id, feteParticipants.campaignId))
    .where(
      and(
        inArray(feteParticipants.studentId, studentIds),
        eq(feteCampaigns.schoolId, schoolId),
        ne(feteCampaigns.status, "draft"),
      ),
    )
    .orderBy(desc(feteCampaigns.startsAt))
    .all();
}

/* ---------- Donations ---------- */

export type DonationRow = {
  id: string;
  amountCents: number;
  donorName: string;
  donorEmail: string | null;
  message: string | null;
  anonymous: boolean;
  method: "online" | "cash";
  status: "pending" | "succeeded" | "failed";
  createdAt: Date;
  participantId: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentPreferredName: string | null;
  className: string | null;
};

const donationFields = {
  id: feteDonations.id,
  amountCents: feteDonations.amountCents,
  donorName: feteDonations.donorName,
  donorEmail: feteDonations.donorEmail,
  message: feteDonations.message,
  anonymous: feteDonations.anonymous,
  method: feteDonations.method,
  status: feteDonations.status,
  createdAt: feteDonations.createdAt,
  participantId: feteDonations.participantId,
  studentFirstName: students.firstName,
  studentLastName: students.lastName,
  studentPreferredName: students.preferredName,
  className: classes.name,
};

/** Succeeded donations, newest first. Optionally for one participant. */
export function listDonations(
  campaignId: string,
  opts: { participantId?: string; limit?: number; includeAll?: boolean } = {},
): DonationRow[] {
  const q = db
    .select(donationFields)
    .from(feteDonations)
    .leftJoin(feteParticipants, eq(feteParticipants.id, feteDonations.participantId))
    .leftJoin(students, eq(students.id, feteParticipants.studentId))
    .leftJoin(classes, eq(classes.id, students.classId))
    .where(
      and(
        eq(feteDonations.campaignId, campaignId),
        opts.includeAll ? undefined : eq(feteDonations.status, "succeeded"),
        opts.participantId ? eq(feteDonations.participantId, opts.participantId) : undefined,
      ),
    )
    .orderBy(desc(feteDonations.createdAt));
  return opts.limit ? q.limit(opts.limit).all() : q.all();
}

export function getDonationByPayment(paymentId: string) {
  return db.select().from(feteDonations).where(eq(feteDonations.paymentId, paymentId)).get();
}

/** Count of succeeded donations since a moment, for a campaign or some participants. */
export function donationsSince(scope: { campaignId: string } | { participantIds: string[] }, since: Date): number {
  if ("participantIds" in scope && !scope.participantIds.length) return 0;
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(feteDonations)
    .where(
      and(
        "campaignId" in scope
          ? eq(feteDonations.campaignId, scope.campaignId)
          : inArray(feteDonations.participantId, scope.participantIds),
        eq(feteDonations.status, "succeeded"),
        sql`${feteDonations.createdAt} >= ${since.getTime()}`,
      ),
    )
    .get();
  return Number(row?.n ?? 0);
}

/* ---------- Point awards ---------- */

export type AwardRow = {
  id: string;
  targetType: "student" | "class" | "year" | "house";
  targetId: string;
  targetLabel: string;
  points: number;
  reason: string;
  awardedByName: string | null;
  createdAt: Date;
};

export function listAwards(campaignId: string, state = "VIC"): AwardRow[] {
  const rows = db
    .select({
      id: fetePointAwards.id,
      targetType: fetePointAwards.targetType,
      targetId: fetePointAwards.targetId,
      points: fetePointAwards.points,
      reason: fetePointAwards.reason,
      awardedByName: users.name,
      createdAt: fetePointAwards.createdAt,
    })
    .from(fetePointAwards)
    .leftJoin(users, eq(users.id, fetePointAwards.awardedBy))
    .where(eq(fetePointAwards.campaignId, campaignId))
    .orderBy(desc(fetePointAwards.createdAt))
    .all();

  const ids = (t: AwardRow["targetType"]) => rows.filter((r) => r.targetType === t).map((r) => r.targetId);
  const label = new Map<string, string>();
  const pIds = ids("student");
  if (pIds.length) {
    for (const p of db
      .select({ id: feteParticipants.id, first: students.firstName, last: students.lastName, pref: students.preferredName, cls: classes.name })
      .from(feteParticipants)
      .innerJoin(students, eq(students.id, feteParticipants.studentId))
      .leftJoin(classes, eq(classes.id, students.classId))
      .where(inArray(feteParticipants.id, pIds))
      .all()) {
      label.set(`student:${p.id}`, `${p.pref ?? p.first} ${p.last}${p.cls ? ` (${p.cls})` : ""}`);
    }
  }
  const cIds = ids("class");
  if (cIds.length) {
    for (const c of db.select({ id: classes.id, name: classes.name }).from(classes).where(inArray(classes.id, cIds)).all()) {
      label.set(`class:${c.id}`, `Class ${c.name}`);
    }
  }
  const hIds = ids("house");
  if (hIds.length) {
    for (const h of db.select({ id: houses.id, name: houses.name }).from(houses).where(inArray(houses.id, hIds)).all()) {
      label.set(`house:${h.id}`, `${h.name} house`);
    }
  }
  return rows.map((r) => ({
    ...r,
    targetLabel:
      r.targetType === "year"
        ? yearLabel(Number(r.targetId), state)
        : (label.get(`${r.targetType}:${r.targetId}`) ?? "Unknown"),
  }));
}

/* ---------- School structure (for forms) ---------- */

export function schoolStructure(schoolId: string) {
  const cls = db
    .select({ id: classes.id, name: classes.name, yearLevel: classes.yearLevel })
    .from(classes)
    .where(eq(classes.schoolId, schoolId))
    .orderBy(asc(classes.yearLevel), asc(classes.name))
    .all();
  const hs = db
    .select({ id: houses.id, name: houses.name, color: houses.color })
    .from(houses)
    .where(eq(houses.schoolId, schoolId))
    .orderBy(asc(houses.name))
    .all();
  const yearCounts = db
    .select({ yearLevel: students.yearLevel, n: sql<number>`count(*)` })
    .from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.active, true)))
    .groupBy(students.yearLevel)
    .orderBy(asc(students.yearLevel))
    .all()
    .map((r) => ({ yearLevel: r.yearLevel, count: Number(r.n) }));
  return { classes: cls, houses: hs, years: yearCounts };
}

/** Active students not yet enrolled, optionally limited to year levels. */
export function unenrolledStudents(campaignId: string, schoolId: string, years?: number[]) {
  const enrolled = db
    .select({ id: feteParticipants.studentId })
    .from(feteParticipants)
    .where(eq(feteParticipants.campaignId, campaignId));
  return db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.schoolId, schoolId),
        eq(students.active, true),
        years ? inArray(students.yearLevel, years) : undefined,
        sql`${students.id} not in ${enrolled}`,
      ),
    )
    .all();
}

export function codeTaken(code: string): boolean {
  return !!db.select({ id: feteParticipants.id }).from(feteParticipants).where(eq(feteParticipants.code, code)).get();
}

/* ---------- Public URLs & QR codes ---------- */

export async function publicUrls(slug: string, code?: string) {
  const base = await appBaseUrl();
  return {
    base,
    campaignUrl: `${base}${campaignPath(slug)}`,
    studentUrl: code ? `${base}${studentPath(slug, code)}` : null,
  };
}

/** An SVG QR code (markup string) for a URL. Rendered server-side. */
export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}
