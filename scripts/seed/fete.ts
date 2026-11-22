/**
 * Demo data for Fete: a live Colour Run with ~300 donations spread
 * realistically across the school, and last year's (closed) Readathon.
 */
import { eq } from "drizzle-orm";
import type { DB } from "../../src/db/connection";
import { newId, shortCode } from "../../src/db/ids";
import {
  feteCampaigns,
  feteDonations,
  feteParticipants,
  fetePointAwards,
  fetePrizeTiers,
  payments,
  type Student,
} from "../../src/db/schema";
import { rng, type SeedContext } from "./core";

const DAY = 24 * 60 * 60 * 1000;

const SUPPORTERS = [
  "Grandma Jo", "Grandpa Bill", "Nonna Rosa", "Nonno Sal", "Yiayia Eleni", "Bà Ngoại", "Nana Pat", "Pop",
  "Aunty Kim", "Uncle Pete", "Aunty Sharon", "Uncle Raj", "Aunty Mei", "Uncle Dave", "Cousin Tash",
  "The Patel family", "The O'Briens", "The Chen family", "The Kellys next door", "Mum's work friends",
  "Dad's footy team", "Jess & Tom", "Liz from netball", "The Rossi family", "Mrs Henderson (neighbour)",
  "Coach Mick", "Sophie's mum", "Ahmed & Leila", "Granny Sue", "Big brother Josh",
];
const MESSAGES = [
  "Go go go! Have the best time 🌈",
  "So proud of you! Run like the wind 💨",
  "Can't wait to see the photos covered in colour!",
  "Good luck at the Colour Run!",
  "Every little bit helps — love you heaps ❤️",
  "Shade sails for everyone! ☀️",
  "Smash it!",
  "Have fun and don't forget the sunscreen 😎",
  "Proud of you mate!",
  "Hope you win the Superstar prize 🦄",
];
const AMOUNTS = [10, 10, 15, 20, 20, 20, 25, 25, 30, 50, 50, 50, 100];

type Rng = ReturnType<typeof rng>;

function uniqueCodes() {
  const used = new Set<string>();
  return () => {
    let c = shortCode();
    while (used.has(c)) c = shortCode();
    used.add(c);
    return c;
  };
}

/** A time between `from` and `to`, weighted towards the recent end. */
function recentBetween(r: Rng, from: number, to: number) {
  return new Date(from + (to - from) * r.next() ** 0.6);
}

/** Supporters with the same name but sponsoring different students are different people. */
const emailFor = (name: string, salt: string | null) =>
  `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}.${(salt ?? "school").slice(0, 4)}@example.com`;

function insertDonation(
  db: DB,
  ctx: SeedContext,
  d: {
    campaignId: string;
    participantId: string | null;
    amountCents: number;
    donorName: string;
    message?: string | null;
    anonymous?: boolean;
    method?: "online" | "cash";
    at: Date;
    description: string;
  },
) {
  const method = d.method ?? "online";
  let paymentId: string | null = null;
  if (method === "online") {
    paymentId = newId();
    db.insert(payments)
      .values({
        id: paymentId,
        schoolId: ctx.school.id,
        provider: "demo",
        purpose: "donation",
        description: d.description,
        amountCents: d.amountCents,
        status: "succeeded",
        payerName: d.donorName,
        payerEmail: emailFor(d.donorName, d.participantId),
        returnPath: "/",
        createdAt: d.at,
        completedAt: d.at,
      })
      .run();
  }
  db.insert(feteDonations)
    .values({
      id: newId(),
      campaignId: d.campaignId,
      participantId: d.participantId,
      amountCents: d.amountCents,
      donorName: d.donorName,
      donorEmail: method === "online" ? emailFor(d.donorName, d.participantId) : null,
      message: d.message ?? null,
      anonymous: d.anonymous ?? false,
      method,
      status: "succeeded",
      paymentId,
      recordedBy: method === "cash" ? ctx.office.id : null,
      createdAt: d.at,
    })
    .run();
}

function enrol(db: DB, campaignId: string, list: Student[], goalCents: number, nextCode: () => string, at: Date) {
  const map = new Map<string, string>();
  for (const s of list) {
    const id = newId();
    db.insert(feteParticipants).values({ id, campaignId, studentId: s.id, code: nextCode(), goalCents, createdAt: at }).run();
    map.set(s.id, id);
  }
  return map;
}

export async function seedFete(db: DB, ctx: SeedContext): Promise<void> {
  const r = rng(4242);
  const now = Date.now();
  const nextCode = uniqueCodes();
  const [mia, leo] = ctx.demoChildren as [Student, Student];
  const cls = (name: string) => ctx.classes.find((c) => c.name === name)!;
  const house = (name: string) => ctx.houses.find((h) => h.name === name)!;

  /* ---------------- Colour Run 2026 (live) ---------------- */
  const colourRun = newId();
  const startsAt = new Date(now - 20 * DAY);
  db.insert(feteCampaigns)
    .values({
      id: colourRun,
      schoolId: ctx.school.id,
      slug: "colour-run-2026",
      name: "Colour Run 2026",
      tagline: "Run, walk or dance through a rainbow — and help build our new outdoor spaces!",
      description:
        "On Friday 4 December every student at Wattle Creek will run, walk or dance a lap of the oval while being showered in (safe, washable) colour.\n\nAsk family and friends to sponsor your run. Every dollar earns your class and house points, and you'll unlock prizes along the way!",
      cause: "New shade sails and nature play area",
      eventDate: "2026-12-04",
      startsAt,
      endsAt: new Date(now + 19 * DAY),
      goalCents: 2_500_000,
      defaultStudentGoalCents: 15_000,
      pointsPerDollar: 1,
      status: "live",
      createdBy: ctx.principal.id,
      createdAt: new Date(now - 24 * DAY),
    })
    .run();
  db.insert(fetePrizeTiers)
    .values([
      { id: newId(), campaignId: colourRun, emoji: "🎨", name: "Colour Crew", thresholdCents: 2_000, description: "Colour Run sweatband" },
      { id: newId(), campaignId: colourRun, emoji: "🕶️", name: "Shades", thresholdCents: 5_000, description: "Rainbow sunnies" },
      { id: newId(), campaignId: colourRun, emoji: "🧢", name: "Cap", thresholdCents: 10_000, description: "Wattle Creek Colour Run cap" },
      { id: newId(), campaignId: colourRun, emoji: "🏆", name: "Legend", thresholdCents: 25_000, description: "Colour cannon at the finish line" },
      { id: newId(), campaignId: colourRun, emoji: "🦄", name: "Superstar", thresholdCents: 50_000, description: "Lunch with the principal + a unicorn medal" },
    ])
    .run();

  const participants = enrol(db, colourRun, ctx.students, 15_000, nextCode, startsAt);
  const pid = (s: Student) => participants.get(s.id)!;

  db.update(feteParticipants)
    .set({ pitch: "Hi everyone! I'm running in the Colour Run to help get shade sails and a nature play area for our school. Last year I got covered in purple — this year I'm aiming for every colour! 🌈", goalCents: 25_000 })
    .where(eq(feteParticipants.id, pid(mia)))
    .run();
  db.update(feteParticipants)
    .set({ pitch: "I'm going to run super fast! Please sponsor me 🏃‍♂️💨" })
    .where(eq(feteParticipants.id, pid(leo)))
    .run();

  // Mia & Leo: friendly, specific supporters.
  const family: [Student, number, string, string | null, number][] = [
    [mia, 5_000, "Grandma Jo", "So proud of you Mia! Save me some purple 💜", 18],
    [mia, 2_000, "Aunty Kim", "Go Mia! You've got this 🌈", 15],
    [mia, 5_000, "Nonna Rosa", "Bellissima! Run like the wind!", 11],
    [mia, 2_500, "The Patel family", "Good luck from next door!", 7],
    [mia, 3_000, "Uncle Pete", null, 4],
    [mia, 2_000, "Coach Mick", "Fast feet Mia! 👟", 2],
    [mia, 1_500, "Jess & Tom", "Have the BEST time!", 0.3],
    [leo, 2_000, "Grandma Jo", "Zoom zoom Leo! 🚀", 18],
    [leo, 1_500, "Nana Pat", "Love you Leo, have fun!", 9],
    [leo, 2_000, "Mum's work friends", "Go Leo go!", 5],
    [leo, 1_000, "Uncle Pete", null, 1],
  ];
  for (const [s, amountCents, donorName, message, daysAgo] of family) {
    insertDonation(db, ctx, {
      campaignId: colourRun,
      participantId: pid(s),
      amountCents,
      donorName,
      message,
      at: new Date(now - daysAgo * DAY),
      description: `Colour Run 2026 — sponsoring ${s.firstName} ${s.lastName[0]}.`,
    });
  }

  // Everyone else. Roughly: 15% raise nothing yet, most get 1–4 gifts and a
  // handful of superstars get lots.
  const others = ctx.students.filter((s) => s.id !== mia.id && s.id !== leo.id);
  for (const s of others) {
    const roll = r.next();
    const gifts = roll < 0.18 ? 0 : roll < 0.94 ? r.int(1, 4) : r.int(7, 12);
    for (let g = 0; g < gifts; g++) {
      let dollars = r.pick(AMOUNTS);
      if (gifts > 6 && r.chance(0.25)) dollars = r.pick([100, 150, 200]);
      insertDonation(db, ctx, {
        campaignId: colourRun,
        participantId: pid(s),
        amountCents: dollars * 100,
        donorName: r.pick(SUPPORTERS),
        message: r.chance(0.45) ? r.pick(MESSAGES) : null,
        anonymous: r.chance(0.1),
        at: recentBetween(r, startsAt.getTime(), now - 30 * 60 * 1000),
        description: `Colour Run 2026 — sponsoring ${s.firstName} ${s.lastName[0]}.`,
      });
    }
  }
  // General donations to the school page.
  for (const [dollars, name, message] of [
    [250, "Brunswick Bakehouse", "Proud local supporters of Wattle Creek PS 🥐"],
    [100, "A Wattle Creek alum", "Loved this school — enjoy the shade!"],
    [500, "Sparrow & Co Real Estate", "Go Wattle Creek!"],
  ] as const) {
    insertDonation(db, ctx, {
      campaignId: colourRun,
      participantId: null,
      amountCents: dollars * 100,
      donorName: name,
      message,
      at: recentBetween(r, startsAt.getTime(), now),
      description: "Colour Run 2026 — donation to Wattle Creek Primary School",
    });
  }
  // Cash brought in to the office.
  for (const [s, dollars, name] of [
    [r.pick(others), 40, "Cash in envelope"],
    [r.pick(others), 25, "Cash — Grandpa Bill"],
  ] as const) {
    insertDonation(db, ctx, {
      campaignId: colourRun,
      participantId: pid(s),
      amountCents: dollars * 100,
      donorName: name,
      method: "cash",
      at: new Date(now - r.int(1, 6) * DAY),
      description: "Cash",
    });
  }

  // Bonus points.
  db.insert(fetePointAwards)
    .values([
      { id: newId(), campaignId: colourRun, targetType: "class", targetId: cls("3B").id, points: 50, reason: "Best costume parade 🎭", awardedBy: ctx.principal.id, createdAt: new Date(now - 6 * DAY) },
      { id: newId(), campaignId: colourRun, targetType: "house", targetId: house("Waratah").id, points: 100, reason: "Loudest house chant at assembly 📣", awardedBy: ctx.principal.id, createdAt: new Date(now - 4 * DAY) },
      { id: newId(), campaignId: colourRun, targetType: "year", targetId: "4", points: 30, reason: "Every Year 4 sponsor form returned", awardedBy: ctx.teacher.id, createdAt: new Date(now - 3 * DAY) },
      { id: newId(), campaignId: colourRun, targetType: "student", targetId: pid(r.pick(others)), points: 20, reason: "Helped set up the colour stations", awardedBy: ctx.teacher.id, createdAt: new Date(now - 1 * DAY) },
    ])
    .run();

  /* ---------------- Readathon 2025 (closed) ---------------- */
  const readathon = newId();
  const rStart = new Date("2025-08-04T00:00:00+10:00");
  const rEnd = new Date("2025-08-29T23:59:59+10:00");
  db.insert(feteCampaigns)
    .values({
      id: readathon,
      schoolId: ctx.school.id,
      slug: "readathon-2025",
      name: "Readathon 2025",
      tagline: "Read up a storm for our library!",
      description: "Students collected sponsorships for every book read during August.",
      cause: "New books and beanbags for the library",
      eventDate: "2025-08-29",
      startsAt: rStart,
      endsAt: rEnd,
      goalCents: 1_000_000,
      defaultStudentGoalCents: 8_000,
      pointsPerDollar: 1,
      status: "closed",
      createdBy: ctx.principal.id,
      createdAt: new Date(rStart.getTime() - 7 * DAY),
    })
    .run();
  db.insert(fetePrizeTiers)
    .values([
      { id: newId(), campaignId: readathon, emoji: "🔖", name: "Bookmark", thresholdCents: 1_500, description: "Holographic bookmark" },
      { id: newId(), campaignId: readathon, emoji: "📚", name: "Bookworm", thresholdCents: 4_000, description: "Choose a new book" },
      { id: newId(), campaignId: readathon, emoji: "🦉", name: "Wise Owl", thresholdCents: 10_000, description: "Library helper badge" },
    ])
    .run();
  // Last year's Foundation students hadn't started yet.
  const readers = ctx.students.filter((s) => s.yearLevel > 0);
  const rParticipants = enrol(db, readathon, readers, 8_000, nextCode, rStart);
  for (const s of readers) {
    const gifts = r.chance(0.2) ? 0 : r.int(1, 3);
    for (let g = 0; g < gifts; g++) {
      insertDonation(db, ctx, {
        campaignId: readathon,
        participantId: rParticipants.get(s.id)!,
        amountCents: r.pick([5, 10, 10, 20, 20, 25, 30, 50]) * 100,
        donorName: r.pick(SUPPORTERS),
        message: r.chance(0.3) ? r.pick(["Happy reading!", "Keep those pages turning 📖", "So proud of you!"]) : null,
        anonymous: r.chance(0.1),
        at: new Date(rStart.getTime() + r.next() * (rEnd.getTime() - rStart.getTime())),
        description: `Readathon 2025 — sponsoring ${s.firstName} ${s.lastName[0]}.`,
      });
    }
  }
  db.insert(fetePointAwards)
    .values({ id: newId(), campaignId: readathon, targetType: "class", targetId: cls("5A").id, points: 40, reason: "Most books read 📚", awardedBy: ctx.principal.id, createdAt: rEnd })
    .run();

}

