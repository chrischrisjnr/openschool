/**
 * Fete scoring and leaderboards — the single source of truth for "how much
 * has been raised" and "how many points does everyone have".
 *
 * Rules
 * - Only donations with status "succeeded" count (online once paid, cash as
 *   soon as staff record it). Pending and failed donations never count.
 * - A participant's points = floor(dollars raised) × campaign.pointsPerDollar
 *   + any bonus awards targeting that participant.
 * - A class / year level / house scores the sum of its participants' points
 *   plus any bonus awards targeting the class / year / house itself.
 * - Donations to the school's general page (no participant) count towards
 *   the campaign total but not to any student, class, year or house.
 *
 * Every function takes the database as an argument (no `server-only`), so
 * this module is unit-tested against an in-memory database.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import type { DB } from "@/db/connection";
import {
  classes,
  feteCampaigns,
  feteDonations,
  feteParticipants,
  fetePointAwards,
  houses,
  schools,
  students,
} from "@/db/schema";
import { yearLabel } from "@/lib/format";
import { pointsForCents } from "./ranking";

export { pointsForCents, rankBy, rankOf, type Metric, type Ranked } from "./ranking";

export type GroupType = "class" | "year" | "house";
export type AwardTargetType = "student" | GroupType;

export type ParticipantScore = {
  participantId: string;
  studentId: string;
  code: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  yearLevel: number;
  classId: string | null;
  className: string | null;
  houseId: string | null;
  houseName: string | null;
  houseColor: string | null;
  goalCents: number;
  pitch: string | null;
  raisedCents: number;
  donationCount: number;
  bonusPoints: number;
  points: number;
};

export type GroupScore = {
  type: GroupType;
  /** class id, year number as text, or house id */
  id: string;
  name: string;
  /** House colour (Primer label colour name), if any. */
  color: string | null;
  participantCount: number;
  raisedCents: number;
  donationCount: number;
  bonusPoints: number;
  points: number;
};

export type CampaignTotals = {
  raisedCents: number;
  donationCount: number;
  donorCount: number;
  averageCents: number;
  onlineCents: number;
  cashCents: number;
  /** Raised through the school's general page rather than a student. */
  generalCents: number;
  participantCount: number;
  /** Participants with at least one succeeded donation. */
  activeParticipantCount: number;
};

export type Scoreboard = {
  campaignId: string;
  pointsPerDollar: number;
  participants: ParticipantScore[];
  classes: GroupScore[];
  years: GroupScore[];
  houses: GroupScore[];
  totals: CampaignTotals;
};

const succeeded = (campaignId: string) =>
  and(eq(feteDonations.campaignId, campaignId), eq(feteDonations.status, "succeeded"));

/** Headline totals for a campaign (succeeded donations only). */
export function getCampaignTotals(db: DB, campaignId: string): Omit<CampaignTotals, "participantCount" | "activeParticipantCount"> {
  const row = db
    .select({
      raised: sql<number>`coalesce(sum(${feteDonations.amountCents}), 0)`,
      count: sql<number>`count(*)`,
      donors: sql<number>`count(distinct lower(trim(coalesce(nullif(${feteDonations.donorEmail}, ''), ${feteDonations.donorName}))))`,
      online: sql<number>`coalesce(sum(case when ${feteDonations.method} = 'online' then ${feteDonations.amountCents} else 0 end), 0)`,
      cash: sql<number>`coalesce(sum(case when ${feteDonations.method} = 'cash' then ${feteDonations.amountCents} else 0 end), 0)`,
      general: sql<number>`coalesce(sum(case when ${feteDonations.participantId} is null then ${feteDonations.amountCents} else 0 end), 0)`,
    })
    .from(feteDonations)
    .where(succeeded(campaignId))
    .get();
  const raisedCents = Number(row?.raised ?? 0);
  const donationCount = Number(row?.count ?? 0);
  return {
    raisedCents,
    donationCount,
    donorCount: Number(row?.donors ?? 0),
    averageCents: donationCount ? Math.round(raisedCents / donationCount) : 0,
    onlineCents: Number(row?.online ?? 0),
    cashCents: Number(row?.cash ?? 0),
    generalCents: Number(row?.general ?? 0),
  };
}

/** Raised totals for many campaigns at once: campaignId → cents. */
export function getRaisedByCampaign(db: DB, schoolId: string): Map<string, number> {
  const rows = db
    .select({ id: feteDonations.campaignId, raised: sql<number>`sum(${feteDonations.amountCents})` })
    .from(feteDonations)
    .innerJoin(feteCampaigns, eq(feteCampaigns.id, feteDonations.campaignId))
    .where(and(eq(feteCampaigns.schoolId, schoolId), eq(feteDonations.status, "succeeded")))
    .groupBy(feteDonations.campaignId)
    .all();
  return new Map(rows.map((r) => [r.id, Number(r.raised)]));
}

/**
 * Everything needed for dashboards and leaderboards in one pass: every
 * participant's raised amount and points, plus class, year and house totals.
 * Returns null if the campaign doesn't exist.
 */
export function getScoreboard(db: DB, campaignId: string): Scoreboard | null {
  const campaign = db
    .select({
      id: feteCampaigns.id,
      schoolId: feteCampaigns.schoolId,
      pointsPerDollar: feteCampaigns.pointsPerDollar,
      state: schools.state,
    })
    .from(feteCampaigns)
    .innerJoin(schools, eq(schools.id, feteCampaigns.schoolId))
    .where(eq(feteCampaigns.id, campaignId))
    .get();
  if (!campaign) return null;
  const ppd = campaign.pointsPerDollar;

  // Raised per participant.
  const raisedRows = db
    .select({
      participantId: feteDonations.participantId,
      raised: sql<number>`sum(${feteDonations.amountCents})`,
      count: sql<number>`count(*)`,
    })
    .from(feteDonations)
    .where(and(succeeded(campaignId), sql`${feteDonations.participantId} is not null`))
    .groupBy(feteDonations.participantId)
    .all();
  const raisedBy = new Map(raisedRows.map((r) => [r.participantId!, { raised: Number(r.raised), count: Number(r.count) }]));

  // Bonus awards, summed per target.
  const awardRows = db
    .select({
      targetType: fetePointAwards.targetType,
      targetId: fetePointAwards.targetId,
      points: sql<number>`sum(${fetePointAwards.points})`,
    })
    .from(fetePointAwards)
    .where(eq(fetePointAwards.campaignId, campaignId))
    .groupBy(fetePointAwards.targetType, fetePointAwards.targetId)
    .all();
  const bonus = new Map(awardRows.map((a) => [`${a.targetType}:${a.targetId}`, Number(a.points)]));
  const bonusFor = (type: AwardTargetType, id: string) => bonus.get(`${type}:${id}`) ?? 0;

  const participantRows = db
    .select({
      participantId: feteParticipants.id,
      studentId: students.id,
      code: feteParticipants.code,
      firstName: students.firstName,
      lastName: students.lastName,
      preferredName: students.preferredName,
      yearLevel: students.yearLevel,
      classId: students.classId,
      className: classes.name,
      houseId: students.houseId,
      houseName: houses.name,
      houseColor: houses.color,
      goalCents: feteParticipants.goalCents,
      pitch: feteParticipants.pitch,
    })
    .from(feteParticipants)
    .innerJoin(students, eq(students.id, feteParticipants.studentId))
    .leftJoin(classes, eq(classes.id, students.classId))
    .leftJoin(houses, eq(houses.id, students.houseId))
    .where(eq(feteParticipants.campaignId, campaignId))
    .orderBy(asc(students.firstName), asc(students.lastName))
    .all();

  const participants: ParticipantScore[] = participantRows.map((p) => {
    const r = raisedBy.get(p.participantId);
    const raisedCents = r?.raised ?? 0;
    const bonusPoints = bonusFor("student", p.participantId);
    return {
      ...p,
      raisedCents,
      donationCount: r?.count ?? 0,
      bonusPoints,
      points: pointsForCents(raisedCents, ppd) + bonusPoints,
    };
  });

  // Groups: every class, year level and house in the school appears, even
  // with nobody enrolled, so leaderboards are stable and complete.
  const schoolClasses = db
    .select({ id: classes.id, name: classes.name, yearLevel: classes.yearLevel })
    .from(classes)
    .where(eq(classes.schoolId, campaign.schoolId))
    .orderBy(asc(classes.yearLevel), asc(classes.name))
    .all();
  const schoolHouses = db
    .select({ id: houses.id, name: houses.name, color: houses.color })
    .from(houses)
    .where(eq(houses.schoolId, campaign.schoolId))
    .orderBy(asc(houses.name))
    .all();

  const emptyGroup = (type: GroupType, id: string, name: string, color: string | null = null): GroupScore => ({
    type,
    id,
    name,
    color,
    participantCount: 0,
    raisedCents: 0,
    donationCount: 0,
    bonusPoints: 0,
    points: 0,
  });
  const classMap = new Map(schoolClasses.map((c) => [c.id, emptyGroup("class", c.id, c.name)]));
  const yearMap = new Map<string, GroupScore>();
  for (const year of [...new Set(schoolClasses.map((c) => c.yearLevel))]) {
    yearMap.set(String(year), emptyGroup("year", String(year), yearLabel(year, campaign.state)));
  }
  const houseMap = new Map(schoolHouses.map((h) => [h.id, emptyGroup("house", h.id, h.name, h.color)]));

  const addTo = (g: GroupScore | undefined, p: ParticipantScore) => {
    if (!g) return;
    g.participantCount += 1;
    g.raisedCents += p.raisedCents;
    g.donationCount += p.donationCount;
    g.points += p.points;
  };
  for (const p of participants) {
    if (p.classId) addTo(classMap.get(p.classId), p);
    const yk = String(p.yearLevel);
    if (!yearMap.has(yk)) yearMap.set(yk, emptyGroup("year", yk, yearLabel(p.yearLevel, campaign.state)));
    addTo(yearMap.get(yk), p);
    if (p.houseId) addTo(houseMap.get(p.houseId), p);
  }
  for (const g of [...classMap.values(), ...yearMap.values(), ...houseMap.values()]) {
    g.bonusPoints = bonusFor(g.type, g.id);
    g.points += g.bonusPoints;
  }

  const totals = getCampaignTotals(db, campaignId);
  return {
    campaignId,
    pointsPerDollar: ppd,
    participants,
    classes: [...classMap.values()],
    years: [...yearMap.values()].sort((a, b) => Number(a.id) - Number(b.id)),
    houses: [...houseMap.values()],
    totals: {
      ...totals,
      participantCount: participants.length,
      activeParticipantCount: participants.filter((p) => p.raisedCents > 0).length,
    },
  };
}

