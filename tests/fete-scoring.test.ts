import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { openDatabase, type DB } from "../src/db/connection";
import {
  classes,
  feteCampaigns,
  feteDonations,
  feteParticipants,
  fetePointAwards,
  houses,
  schools,
  students,
} from "../src/db/schema";
import { getCampaignTotals, getScoreboard, pointsForCents, rankBy, rankOf } from "../src/lib/fete/scoring";
import { percentOf, tierProgress } from "../src/lib/fete/tiers";
import { publicStudentName } from "../src/lib/fete/privacy";
import { daysLeft, endOfDay, startOfDay } from "../src/lib/fete/dates";

let db: DB;
let n = 0;
const id = (p: string) => `${p}${++n}`;

/** Builds a tiny school: 2 classes (3A, 4A), 2 houses, 4 students, 1 campaign. */
function setup(pointsPerDollar = 1) {
  db = openDatabase(":memory:");
  db.insert(schools).values({ id: "s1", name: "Test PS", shortName: "Test", slug: "test" }).run();
  db.insert(classes).values([
    { id: "c3", schoolId: "s1", name: "3A", yearLevel: 3 },
    { id: "c4", schoolId: "s1", name: "4A", yearLevel: 4 },
  ]).run();
  db.insert(houses).values([
    { id: "hRed", schoolId: "s1", name: "Red", color: "red" },
    { id: "hBlue", schoolId: "s1", name: "Blue", color: "blue" },
  ]).run();
  const kids = [
    ["ann", "Ann", "c3", 3, "hRed"],
    ["ben", "Ben", "c3", 3, "hBlue"],
    ["cat", "Cat", "c4", 4, "hRed"],
    ["dan", "Dan", "c4", 4, "hBlue"],
  ] as const;
  for (const [sid, first, classId, yearLevel, houseId] of kids) {
    db.insert(students).values({ id: sid, schoolId: "s1", firstName: first, lastName: "Test", classId, yearLevel, houseId }).run();
  }
  db.insert(feteCampaigns).values({
    id: "camp", schoolId: "s1", slug: "run", name: "Run", startsAt: new Date(), endsAt: new Date(), goalCents: 100_000,
    pointsPerDollar, status: "live",
  }).run();
  for (const [sid] of kids) {
    db.insert(feteParticipants).values({ id: `p_${sid}`, campaignId: "camp", studentId: sid, code: `code_${sid}`, goalCents: 5_000 }).run();
  }
}

function donate(participantId: string | null, amountCents: number, opts: Partial<typeof feteDonations.$inferInsert> = {}) {
  db.insert(feteDonations).values({
    id: id("d"), campaignId: "camp", participantId, amountCents, donorName: opts.donorName ?? "Gran", status: "succeeded", ...opts,
  }).run();
}

function award(targetType: "student" | "class" | "year" | "house", targetId: string, points: number) {
  db.insert(fetePointAwards).values({ id: id("a"), campaignId: "camp", targetType, targetId, points, reason: "Test" }).run();
}

describe("pointsForCents", () => {
  test("only whole dollars earn points", () => {
    assert.equal(pointsForCents(0, 1), 0);
    assert.equal(pointsForCents(99, 1), 0);
    assert.equal(pointsForCents(100, 1), 1);
    assert.equal(pointsForCents(2599, 2), 50);
    assert.equal(pointsForCents(-500, 1), 0);
  });
});

describe("getScoreboard", () => {
  beforeEach(() => setup());

  test("returns null for an unknown campaign", () => {
    assert.equal(getScoreboard(db, "nope"), null);
  });

  test("only succeeded donations count", () => {
    donate("p_ann", 2_000);
    donate("p_ann", 5_000, { status: "pending" });
    donate("p_ann", 7_000, { status: "failed" });
    const board = getScoreboard(db, "camp")!;
    const ann = board.participants.find((p) => p.studentId === "ann")!;
    assert.equal(ann.raisedCents, 2_000);
    assert.equal(ann.donationCount, 1);
    assert.equal(ann.points, 20);
    assert.equal(board.totals.raisedCents, 2_000);
    assert.equal(board.totals.donationCount, 1);
  });

  test("points floor the participant's total, then multiply by points per dollar", () => {
    setup(3);
    donate("p_ben", 150); // $1.50
    donate("p_ben", 175); // $1.75 → $3.25 total → 3 whole dollars → 9 points
    const ben = getScoreboard(db, "camp")!.participants.find((p) => p.studentId === "ben")!;
    assert.equal(ben.raisedCents, 325);
    assert.equal(ben.points, 9);
  });

  test("student bonus awards add to the participant and their groups", () => {
    donate("p_cat", 1_000);
    award("student", "p_cat", 25);
    award("student", "p_cat", -5);
    const board = getScoreboard(db, "camp")!;
    const cat = board.participants.find((p) => p.studentId === "cat")!;
    assert.equal(cat.bonusPoints, 20);
    assert.equal(cat.points, 30);
    assert.equal(board.classes.find((c) => c.id === "c4")!.points, 30);
    assert.equal(board.years.find((y) => y.id === "4")!.points, 30);
    assert.equal(board.houses.find((h) => h.id === "hRed")!.points, 30);
  });

  test("class, year and house totals sum participants plus their own awards", () => {
    donate("p_ann", 1_000); // 3A, Red
    donate("p_ben", 2_000); // 3A, Blue
    donate("p_cat", 4_000); // 4A, Red
    award("class", "c3", 50);
    award("year", "4", 7);
    award("house", "hBlue", 100);
    const board = getScoreboard(db, "camp")!;
    const c3 = board.classes.find((c) => c.id === "c3")!;
    assert.equal(c3.raisedCents, 3_000);
    assert.equal(c3.participantCount, 2);
    assert.equal(c3.bonusPoints, 50);
    assert.equal(c3.points, 30 + 50);
    const y4 = board.years.find((y) => y.id === "4")!;
    assert.equal(y4.name, "Year 4");
    assert.equal(y4.points, 40 + 7);
    const red = board.houses.find((h) => h.id === "hRed")!;
    const blue = board.houses.find((h) => h.id === "hBlue")!;
    assert.equal(red.raisedCents, 5_000);
    assert.equal(red.points, 50);
    assert.equal(blue.raisedCents, 2_000);
    assert.equal(blue.points, 20 + 100);
    // Class awards don't leak into houses or years.
    assert.equal(board.years.find((y) => y.id === "3")!.points, 30);
  });

  test("general donations count to the campaign total but no group", () => {
    donate(null, 10_000, { donorName: "Local bakery" });
    donate("p_dan", 1_000);
    const board = getScoreboard(db, "camp")!;
    assert.equal(board.totals.raisedCents, 11_000);
    assert.equal(board.totals.generalCents, 10_000);
    const groupRaised = board.houses.reduce((s, h) => s + h.raisedCents, 0);
    assert.equal(groupRaised, 1_000);
  });

  test("totals: donor count, average, cash vs online, active participants", () => {
    donate("p_ann", 1_000, { donorName: "Gran", donorEmail: "gran@example.com" });
    donate("p_ben", 3_000, { donorName: "Granny", donorEmail: "GRAN@example.com" });
    donate("p_ben", 2_000, { donorName: "Uncle", method: "cash" });
    const t = getScoreboard(db, "camp")!.totals;
    assert.equal(t.donationCount, 3);
    assert.equal(t.donorCount, 2);
    assert.equal(t.averageCents, 2_000);
    assert.equal(t.cashCents, 2_000);
    assert.equal(t.onlineCents, 4_000);
    assert.equal(t.participantCount, 4);
    assert.equal(t.activeParticipantCount, 2);
    assert.deepEqual(getCampaignTotals(db, "camp").raisedCents, 6_000);
  });

  test("every class and house is listed, even with nothing raised", () => {
    const board = getScoreboard(db, "camp")!;
    assert.equal(board.classes.length, 2);
    assert.equal(board.houses.length, 2);
    assert.ok(board.houses.every((h) => h.raisedCents === 0 && h.points === 0));
  });
});

describe("ranking", () => {
  const rows = [
    { name: "B", raisedCents: 500, points: 10 },
    { name: "A", raisedCents: 500, points: 30 },
    { name: "C", raisedCents: 900, points: 5 },
    { name: "D", raisedCents: 0, points: 0 },
  ];

  test("rankBy sorts highest first with shared ranks for ties", () => {
    const ranked = rankBy(rows, "raised");
    assert.deepEqual(ranked.map((r) => [r.name, r.rank]), [["C", 1], ["A", 2], ["B", 2], ["D", 4]]);
    assert.deepEqual(rankBy(rows, "points").map((r) => r.name), ["A", "B", "C", "D"]);
  });

  test("rankOf finds an item's place", () => {
    assert.deepEqual(rankOf(rows, "points", (r) => r.name === "C"), { rank: 3, of: 4 });
    assert.equal(rankOf(rows, "points", (r) => r.name === "Z"), null);
  });
});

describe("tiers, privacy and dates", () => {
  const tiers = [
    { id: "2", name: "Cap", emoji: "🧢", thresholdCents: 10_000, description: null },
    { id: "1", name: "Crew", emoji: "🎨", thresholdCents: 2_000, description: null },
  ];

  test("tierProgress reports unlocked and next tiers", () => {
    const p = tierProgress(2_500, tiers);
    assert.deepEqual(p.unlocked.map((t) => t.name), ["Crew"]);
    assert.equal(p.current?.name, "Crew");
    assert.equal(p.next?.name, "Cap");
    assert.equal(p.toNextCents, 7_500);
    const all = tierProgress(10_000, tiers);
    assert.equal(all.next, null);
    assert.equal(all.toNextCents, 0);
  });

  test("percentOf caps at 100", () => {
    assert.equal(percentOf(5_000, 10_000), 50);
    assert.equal(percentOf(20_000, 10_000), 100);
    assert.equal(percentOf(1, 0), 100);
  });

  test("public names show first name and last initial only", () => {
    assert.equal(publicStudentName({ firstName: "Mia", lastName: "Nguyen-Walker" }), "Mia N.");
    assert.equal(publicStudentName({ firstName: "Alexander", preferredName: "Xander", lastName: "smith" }), "Xander S.");
  });

  test("day boundaries use the school's timezone", () => {
    assert.equal(startOfDay("2026-12-04").toISOString(), "2026-12-03T13:00:00.000Z"); // AEDT +11
    assert.equal(startOfDay("2026-07-01").toISOString(), "2026-06-30T14:00:00.000Z"); // AEST +10
    assert.equal(endOfDay("2026-12-04").toISOString(), "2026-12-04T12:59:59.999Z");
    const end = endOfDay("2026-12-04");
    assert.equal(daysLeft(end, new Date("2026-11-22T01:00:00Z")), 12);
    assert.equal(daysLeft(end, new Date("2026-12-04T05:00:00Z")), 0);
    assert.equal(daysLeft(end, new Date("2026-12-05T05:00:00Z")), null);
  });
});
