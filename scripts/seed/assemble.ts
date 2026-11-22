/**
 * Demo data for Assemble: notices, a Term 4 calendar, permission & payment
 * items, four weeks of attendance and some absence notes.
 *
 * Everything is written relative to Sunday 22 November 2026 (late Term 4 in
 * Victoria). When the demo is seeded on a later date the whole story moves
 * forward by whole weeks, so weekdays still line up and it always looks fresh.
 */
import type { DB } from "../../src/db/connection";
import { newId } from "../../src/db/ids";
import {
  absenceNotes,
  attendance,
  events,
  noticeReads,
  notices,
  paymentItems,
  payments,
  studentCharges,
  type AbsenceReason,
  type AttendanceStatus,
  type AudienceType,
  type EventCategory,
  type Student,
  type User,
} from "../../src/db/schema";
import { addDays, daysBetween, isWeekend, zonedTime } from "../../src/lib/assemble/dates";
import { dayKey } from "../../src/lib/format";
import { rng, type SeedContext } from "./core";

const ANCHOR = "2026-11-22";

export async function seedAssemble(db: DB, ctx: SeedContext): Promise<void> {
  const r = rng(1122);
  const tz = ctx.school.timezone;
  const realToday = dayKey(new Date(), tz);
  const shiftWeeks = Math.max(0, Math.floor(daysBetween(ANCHOR, realToday) / 7));
  const base = addDays(ANCHOR, shiftWeeks * 7);

  /** Day key `n` days from the (shifted) anchor Sunday. */
  const day = (n: number) => addDays(base, n);
  const at = (n: number, time: string) => zonedTime(day(n), time, tz);
  const now = new Date();

  const cls = (name: string) => ctx.classes.find((c) => c.name === name)!;
  const house = (name: string) => ctx.houses.find((h) => h.name === name)!;
  const staffNamed = (name: string) => ctx.staff.find((s) => s.name.includes(name))!;
  const coach = staffNamed("Ben Walsh");
  const year2Teacher = staffNamed("Lucy Nguyen");
  const [mia, leo] = ctx.demoChildren as [Student, Student];

  type Audience = { type: AudienceType; id: string | null };
  const school: Audience = { type: "school", id: null };
  const staffOnly: Audience = { type: "staff", id: null };
  const year = (y: number): Audience => ({ type: "year", id: String(y) });
  const klass = (name: string): Audience => ({ type: "class", id: cls(name).id });

  const studentsIn = (a: Audience): Student[] =>
    ctx.students.filter((s) => {
      if (!s.active) return false;
      switch (a.type) {
        case "school":
          return true;
        case "staff":
          return false;
        case "year":
          return s.yearLevel === Number(a.id);
        case "class":
          return s.classId === a.id;
        case "house":
          return s.houseId === a.id;
      }
    });

  /* ---------------------------------------------------------------- */
  /* Calendar                                                          */
  /* ---------------------------------------------------------------- */

  type EventSpec = {
    title: string;
    category: EventCategory;
    audience?: Audience;
    /** [startDay, endDay] for all-day events, or [day, "HH:MM", "HH:MM"]. */
    when: [number, number] | [number, string, string];
    location?: string;
    description?: string;
    by?: User;
  };

  const eventSpecs: EventSpec[] = [
    {
      title: "Melbourne Cup Day — public holiday",
      category: "holiday",
      when: [-19, -19],
      description: "No school today. Enjoy the long weekend!",
    },
    {
      title: "Swimming program",
      category: "sport",
      audience: year(2),
      when: [-13, -9],
      location: "Brunswick Baths",
      description:
        "Five mornings of water-safety and swimming lessons with qualified instructors. Students walk to the baths with their teachers. Please pack bathers, a towel, goggles and a plastic bag for wet things.",
      by: coach,
    },
    {
      title: "Whole school assembly",
      category: "event",
      when: [-9, "14:30", "15:10"],
      location: "School hall",
      description: "Families are always welcome. This week 3A are hosting.",
    },
    {
      title: "School Council meeting",
      category: "meeting",
      when: [-5, "19:00", "20:30"],
      location: "Staff room",
      description: "Open to all families. Minutes are shared in Notices after each meeting.",
    },
    {
      title: "2027 Foundation transition — session 1",
      category: "event",
      when: [2, "09:15", "10:30"],
      location: "Foundation building",
      description:
        "Our 2027 Foundation children visit their new classrooms. Current families: please expect a little extra activity around the Foundation gate.",
    },
    {
      title: "Staff meeting — 2027 class planning",
      category: "meeting",
      audience: staffOnly,
      when: [3, "15:45", "17:00"],
      location: "Library",
    },
    {
      title: "District athletics carnival (Years 3–6)",
      category: "sport",
      when: [4, "09:00", "14:30"],
      location: "Princes Park athletics track",
      description: "Students selected for the district team will bring home a permission note. Wear your house colours!",
      by: coach,
    },
    {
      title: "Whole school assembly",
      category: "event",
      when: [5, "14:30", "15:10"],
      location: "School hall",
      description: "Families are always welcome. This week 6A are hosting.",
    },
    {
      title: "Curriculum Day — student free day",
      category: "holiday",
      when: [8, 8],
      description:
        "Staff professional learning and 2027 planning. There are no classes today. OSHC is running a full-day program — book through the OSHC app.",
    },
    {
      title: "6A Science expo",
      category: "event",
      audience: klass("6A"),
      when: [10, "14:00", "15:00"],
      location: "Room 14",
      description: "6A students present their science investigations. Families are warmly invited to drop in.",
      by: ctx.teacher,
    },
    {
      title: "Year 2 excursion — Melbourne Zoo",
      category: "excursion",
      audience: year(2),
      when: [11, "09:00", "14:45"],
      location: "Melbourne Zoo, Parkville",
      description:
        "Year 2 are visiting the zoo as part of their Living Things unit. We travel by bus and return before the end of the day. Please pack a nut-free lunch, water bottle, hat and sunscreen.",
      by: year2Teacher,
    },
    {
      title: "School Council meeting",
      category: "meeting",
      when: [16, "19:00", "20:30"],
      location: "Staff room",
    },
    {
      title: "Christmas concert",
      category: "event",
      when: [18, "18:00", "19:30"],
      location: "School hall",
      description:
        "Every class performs! Doors open at 5:30 pm. Bring a picnic rug — the P&C sausage sizzle starts at 5 pm.",
    },
    {
      title: "Whole school assembly",
      category: "event",
      when: [19, "14:30", "15:10"],
      location: "School hall",
    },
    {
      title: "Step-up day — meet your 2027 teacher",
      category: "event",
      when: [23, 23],
      description: "Students spend the morning in their 2027 classroom with their new teacher.",
    },
    {
      title: "Year 6 Graduation",
      category: "event",
      audience: year(6),
      when: [24, "18:00", "20:30"],
      location: "School hall",
      description:
        "A celebration of our Year 6 students as they finish primary school, followed by a graduation dinner. Each graduate may bring up to four guests.",
      by: ctx.teacher,
    },
    {
      title: "Final assembly",
      category: "event",
      when: [26, "13:30", "14:15"],
      location: "School hall",
    },
    {
      title: "Last day of Term 4 — 2:30 pm finish",
      category: "term",
      when: [26, 26],
      description: "School finishes at 2:30 pm. Have a safe and happy holiday!",
    },
    { title: "Christmas Day — public holiday", category: "holiday", when: [33, 33] },
    { title: "Boxing Day — public holiday", category: "holiday", when: [36, 36] },
    { title: "New Year's Day — public holiday", category: "holiday", when: [40, 40] },
    { title: "Australia Day — public holiday", category: "holiday", when: [65, 65] },
    {
      title: "Term 1 2027 begins",
      category: "term",
      when: [67, 67],
      description: "Students in Years 1–6 start today. Foundation students start on Friday.",
    },
    {
      title: "Year 5 camp — Phillip Island",
      category: "excursion",
      audience: year(5),
      when: [94, 96],
      location: "Phillip Island Adventure Resort",
      description: "Three days of surfing, bike riding, the Penguin Parade and lots of fun with friends.",
    },
  ];

  const eventIds = new Map<string, string>();
  for (const e of eventSpecs) {
    const id = newId();
    const a = e.audience ?? school;
    const [d, t1, t2] = e.when;
    const allDay = typeof t1 === "number";
    db.insert(events)
      .values({
        id,
        schoolId: ctx.school.id,
        title: e.title,
        description: e.description ?? null,
        location: e.location ?? null,
        startsAt: allDay ? at(d, "00:00") : at(d, t1),
        endsAt: allDay ? at(t1 + 1, "00:00") : at(d, t2 as string),
        allDay,
        category: e.category,
        audienceType: a.type,
        audienceId: a.id,
        createdBy: (e.by ?? ctx.principal).id,
        createdAt: at(Math.min(d, 0) - 21, "09:00"),
      })
      .run();
    if (!eventIds.has(e.title)) eventIds.set(e.title, id);
  }

  /* ---------------------------------------------------------------- */
  /* Notices                                                           */
  /* ---------------------------------------------------------------- */

  type NoticeSpec = {
    title: string;
    body: string;
    category: string;
    audience?: Audience;
    author?: User;
    daysAgo: number;
    pinned?: boolean;
    requiresAck?: boolean;
    expiresIn?: number;
    /** Whether the demo parent has read / acknowledged it. */
    demo?: "unread" | "read" | "acked";
    readRate?: number;
  };

  const noticeSpecs: NoticeSpec[] = [
    {
      title: "Sun smart: hats from 1 September",
      category: "health",
      pinned: true,
      daysAgo: 82,
      demo: "read",
      readRate: 0.9,
      body: `As the UV index climbs, our SunSmart policy is back in force. From 1 September until the end of April, all students need a broad-brimmed or legionnaire hat to play outside.

No hat means playing in the shaded area under the big peppercorn tree — so please check bags each morning.

Hats are available from the uniform shop for $15, and spare sunscreen is in every classroom. Thank you for helping keep everyone safe in the sun.`,
    },
    {
      title: "Curriculum Day — student free day",
      category: "learning",
      pinned: true,
      requiresAck: true,
      daysAgo: 10,
      demo: "unread",
      readRate: 0.75,
      body: `Monday 30 November is a Curriculum Day. Staff will be working on 2027 planning and there are no classes for students.

OSHC is running a full-day holiday-style program for families who need care. Please book through the OSHC app by Wednesday so they can staff the day.

Please tap "I've read this" so we know every family has seen this notice.`,
    },
    {
      title: "Year 6 Graduation — Wednesday 16 December",
      category: "events",
      audience: year(6),
      author: ctx.teacher,
      requiresAck: true,
      daysAgo: 6,
      demo: "unread",
      readRate: 0.7,
      body: `We are so proud of our Year 6 students and can't wait to celebrate with you.

The graduation ceremony starts at 6:00 pm in the school hall, followed by dinner. Graduates should arrive by 5:30 pm in school uniform — formal additions (a flower, a bow tie) are welcome.

Dinner costs $45 per graduate and can be paid in Forms & payments. Each graduate may bring up to four guests to the ceremony.

Please acknowledge this notice so we can finalise numbers.`,
    },
    {
      title: "School Council update — November",
      category: "community",
      author: ctx.principal,
      daysAgo: 4,
      demo: "unread",
      readRate: 0.45,
      body: `Thank you to everyone who came along to Tuesday's School Council meeting. Highlights:

• The new shade sail over the Junior playground will be installed in the January holidays.
• The 2027 curriculum levy stays at $150 per student. Families experiencing hardship can talk to Karen in the office in confidence — no child misses out.
• The P&C raised $4,820 at the Spring Fair. Thank you!

Our final meeting for the year is on Tuesday 8 December at 7 pm in the staff room. All families welcome.`,
    },
    {
      title: "Year 2 Melbourne Zoo excursion",
      category: "events",
      audience: year(2),
      author: year2Teacher,
      daysAgo: 8,
      demo: "read",
      readRate: 0.8,
      body: `Year 2 are heading to Melbourne Zoo on Thursday 3 December as part of our Living Things unit.

The excursion costs $28, which covers the bus and entry. Please give permission and pay in Forms & payments by Friday 27 November.

Pack a nut-free lunch, a water bottle, a hat and sunscreen. Students should wear school uniform and comfortable shoes.`,
    },
    {
      title: "Head lice in 3B",
      category: "health",
      audience: klass("3B"),
      author: ctx.principal,
      requiresAck: true,
      daysAgo: 3,
      readRate: 0.65,
      body: `Head lice have been found in 3B. Please check your child's hair tonight and treat if needed — children can return to school the day after treatment starts.

Tying back long hair really helps. The office has fact sheets if you'd like one.`,
    },
    {
      title: "Christmas concert — costumes & rehearsals",
      category: "events",
      daysAgo: 1,
      demo: "unread",
      readRate: 0.3,
      body: `Our Christmas concert is on Thursday 10 December at 6 pm. Every class is performing!

Costumes are simple — your child's teacher will send home a note about colours. Please don't buy anything special; we have plenty in the costume cupboard.

Rehearsals happen during school hours, so there's nothing extra to attend.`,
    },
    {
      title: "6A: Science expo next week",
      category: "learning",
      audience: klass("6A"),
      author: ctx.teacher,
      daysAgo: 2,
      demo: "read",
      readRate: 0.6,
      body: `6A have been working hard on their science investigations — from paper-plane aerodynamics to which mulch keeps soil wettest.

Families are warmly invited to our expo on Wednesday 2 December from 2 pm in Room 14. Students will present for about five minutes each.`,
    },
    {
      title: "Kurrajong house captains for 2027",
      category: "community",
      audience: { type: "house", id: house("Kurrajong").id },
      author: coach,
      daysAgo: 7,
      readRate: 0.5,
      body: `Year 5 Kurrajong students who'd like to be house captain in 2027 can give a one-minute speech at lunchtime on Friday in the gym. Go green!`,
    },
    {
      title: "Lost property clear-out",
      category: "general",
      author: ctx.office,
      daysAgo: 12,
      expiresIn: 5,
      demo: "read",
      readRate: 0.55,
      body: `The lost property trolley is overflowing! Anything not collected by Friday 27 November will be washed and donated to the second-hand uniform stall.

Tip: a name in every jumper means it comes straight back to you.`,
    },
    {
      title: "Staff: 2027 class lists — first draft",
      category: "general",
      audience: staffOnly,
      author: ctx.principal,
      requiresAck: true,
      daysAgo: 5,
      readRate: 0.6,
      body: `The first draft of the 2027 class lists is in the shared drive. Please review your current class's placements and add any concerns to the comments by Friday.

We'll discuss at Wednesday's staff meeting.`,
    },
    {
      title: "Book Week parade photos",
      category: "community",
      daysAgo: 70,
      expiresIn: -40,
      readRate: 0.7,
      body: `Thank you for the amazing costumes at our Book Week parade! Photos are now on the school website (password in the newsletter).`,
    },
  ];

  const staffUsers = ctx.staff;
  for (const n of noticeSpecs) {
    const id = newId();
    const a = n.audience ?? school;
    const publishedAt = new Date(at(-n.daysAgo, "08:30").getTime() + r.int(0, 300) * 60_000);
    db.insert(notices)
      .values({
        id,
        schoolId: ctx.school.id,
        authorId: (n.author ?? ctx.principal).id,
        title: n.title,
        body: n.body,
        category: n.category,
        audienceType: a.type,
        audienceId: a.id,
        pinned: n.pinned ?? false,
        requiresAck: n.requiresAck ?? false,
        publishedAt,
        expiresAt: n.expiresIn !== undefined ? at(n.expiresIn, "23:59") : null,
        createdAt: publishedAt,
      })
      .run();

    // Who read it: families (any guardian) or staff.
    const readers = new Map<string, { ack: boolean }>();
    const rate = n.readRate ?? 0.6;
    if (a.type === "staff") {
      for (const s of staffUsers) if (r.chance(rate)) readers.set(s.id, { ack: !!n.requiresAck && r.chance(0.85) });
    } else {
      const seen = new Set<string>();
      for (const s of studentsIn(a)) {
        const gs = ctx.guardiansByStudent.get(s.id) ?? [];
        if (gs.some((g) => seen.has(g))) continue;
        gs.forEach((g) => seen.add(g));
        if (gs.includes(ctx.parent.id)) continue; // demo family handled below
        if (gs.length && r.chance(rate)) readers.set(r.pick(gs), { ack: !!n.requiresAck && r.chance(0.85) });
      }
      // A few staff open community notices too.
      for (const s of staffUsers) if (r.chance(0.3)) readers.set(s.id, { ack: false });
    }
    if (n.demo === "read" || n.demo === "acked") readers.set(ctx.parent.id, { ack: n.demo === "acked" });
    if (n.author) readers.set(n.author.id, { ack: !!n.requiresAck });
    for (const [userId, { ack }] of readers) {
      const readAt = new Date(Math.min(now.getTime(), publishedAt.getTime() + r.int(10, 60 * 60) * 60_000));
      db.insert(noticeReads)
        .values({ noticeId: id, userId, readAt, acknowledgedAt: ack ? readAt : null })
        .onConflictDoNothing()
        .run();
    }
  }

  /* ---------------------------------------------------------------- */
  /* Forms & payments                                                  */
  /* ---------------------------------------------------------------- */

  type ItemSpec = {
    title: string;
    description: string;
    category: string;
    amountCents: number;
    requiresConsent: boolean;
    dueIn: number;
    audience: Audience;
    event?: string;
    createdDaysAgo: number;
    by: User;
    paidRate: number;
    consentRate?: number;
    closed?: boolean;
    /** Fixed outcomes for the demo family: studentId → state. */
    demo?: Map<string, { paidDaysAgo?: number; consent?: "pending" | "granted" | "declined" }>;
  };

  const itemSpecs: ItemSpec[] = [
    {
      title: "Year 2 excursion — Melbourne Zoo",
      description:
        "Bus travel and entry for our Living Things excursion on Thursday 3 December. Please give permission and pay by the due date.",
      category: "excursion",
      amountCents: 2800,
      requiresConsent: true,
      dueIn: 5,
      audience: year(2),
      event: "Year 2 excursion — Melbourne Zoo",
      createdDaysAgo: 8,
      by: year2Teacher,
      paidRate: 0.55,
      consentRate: 0.7,
      demo: new Map([[leo.id, { consent: "pending" }]]),
    },
    {
      title: "Year 6 Graduation dinner",
      description: "Dinner for each graduate following the ceremony on Wednesday 16 December. Guests are free.",
      category: "event",
      amountCents: 4500,
      requiresConsent: false,
      dueIn: 12,
      audience: year(6),
      event: "Year 6 Graduation",
      createdDaysAgo: 6,
      by: ctx.teacher,
      paidRate: 0.5,
      demo: new Map([[mia.id, {}]]),
    },
    {
      title: "Swimming program",
      description: "Five lessons at Brunswick Baths with qualified instructors, including transport.",
      category: "sport",
      amountCents: 6500,
      requiresConsent: true,
      dueIn: -23,
      audience: year(2),
      event: "Swimming program",
      createdDaysAgo: 45,
      by: coach,
      paidRate: 0.92,
      consentRate: 0.97,
      closed: true,
      demo: new Map([[leo.id, { consent: "granted", paidDaysAgo: 27 }]]),
    },
    {
      title: "2027 Curriculum levy",
      description:
        "Covers books, stationery, digital subscriptions and art materials for the whole of 2027. Families experiencing hardship, please contact the office in confidence.",
      category: "levy",
      amountCents: 15000,
      requiresConsent: false,
      dueIn: 82,
      audience: school,
      createdDaysAgo: 40,
      by: ctx.office,
      paidRate: 0.35,
      demo: new Map([
        [mia.id, { paidDaysAgo: 30 }],
        [leo.id, { paidDaysAgo: 30 }],
      ]),
    },
    {
      title: "Photo & media consent",
      description:
        "May we include your child in photos and videos for the newsletter, school website and social media? You can change your answer at any time.",
      category: "consent",
      amountCents: 0,
      requiresConsent: true,
      dueIn: 19,
      audience: school,
      createdDaysAgo: 20,
      by: ctx.office,
      paidRate: 0,
      consentRate: 0.72,
      demo: new Map([
        [mia.id, { consent: "granted" }],
        [leo.id, { consent: "pending" }],
      ]),
    },
    {
      title: "Year 5 camp deposit — Phillip Island",
      description:
        "A deposit to secure your child's place at camp (24–26 February 2027). The balance will be due in Term 1. CSEF-eligible families can contact the office.",
      category: "camp",
      amountCents: 12000,
      requiresConsent: true,
      dueIn: 12,
      audience: year(5),
      event: "Year 5 camp — Phillip Island",
      createdDaysAgo: 14,
      by: ctx.principal,
      paidRate: 0.45,
      consentRate: 0.8,
    },
  ];

  const descriptionFor = (title: string, s: Student) => `${title} — ${s.preferredName ?? s.firstName} ${s.lastName}`;

  // Demo family's levy is paid in one payment for both children.
  const familyPayments = new Map<string, string>();

  for (const spec of itemSpecs) {
    const itemId = newId();
    const createdAt = at(-spec.createdDaysAgo, "10:00");
    db.insert(paymentItems)
      .values({
        id: itemId,
        schoolId: ctx.school.id,
        title: spec.title,
        description: spec.description,
        category: spec.category,
        amountCents: spec.amountCents,
        requiresConsent: spec.requiresConsent,
        dueAt: at(spec.dueIn, "23:59"),
        eventId: spec.event ? (eventIds.get(spec.event) ?? null) : null,
        audienceType: spec.audience.type,
        audienceId: spec.audience.id,
        closed: spec.closed ?? false,
        createdBy: spec.by.id,
        createdAt,
      })
      .run();

    for (const s of studentsIn(spec.audience)) {
      const guardians = ctx.guardiansByStudent.get(s.id) ?? [];
      const payer = ctx.parents.find((p) => p.id === guardians[0]);
      const fixed = spec.demo?.get(s.id);
      const isDemoFamily = guardians.includes(ctx.parent.id);

      let consent: "pending" | "granted" | "declined" | null = null;
      if (spec.requiresConsent) {
        if (fixed?.consent) consent = fixed.consent;
        else if (isDemoFamily) consent = "granted";
        else consent = r.chance(spec.consentRate ?? 0.8) ? "granted" : r.chance(0.12) ? "declined" : "pending";
      }
      let paidDaysAgo: number | undefined;
      if (spec.amountCents > 0 && consent !== "declined" && consent !== "pending") {
        if (fixed) paidDaysAgo = fixed.paidDaysAgo;
        else if (!isDemoFamily && r.chance(spec.paidRate)) paidDaysAgo = r.int(0, Math.max(0, spec.createdDaysAgo - 1));
      }
      const consentAt = consent && consent !== "pending" ? at(-r.int(0, spec.createdDaysAgo - 1), `${r.int(7, 21)}:${r.int(10, 59)}`) : null;
      const waived = !fixed && !isDemoFamily && spec.amountCents >= 10000 && paidDaysAgo === undefined && r.chance(0.04);

      let paymentId: string | null = null;
      let paidAt: Date | null = null;
      if (paidDaysAgo !== undefined && payer) {
        paidAt = new Date(Math.min(now.getTime(), at(-paidDaysAgo, `${r.int(7, 21)}:${r.int(10, 59)}`).getTime()));
        const familyKey = isDemoFamily ? `${spec.title}:demo` : "";
        paymentId = (familyKey && familyPayments.get(familyKey)) || null;
        if (!paymentId) {
          paymentId = newId();
          const demoLevy = isDemoFamily && spec.category === "levy";
          const amount = demoLevy ? spec.amountCents * 2 : spec.amountCents;
          const cash = !isDemoFamily && r.chance(0.12);
          db.insert(payments)
            .values({
              id: paymentId,
              schoolId: ctx.school.id,
              provider: cash ? "cash" : "demo",
              purpose: "charges",
              description: demoLevy ? `${spec.title} — Mia & Leo Nguyen-Walker` : descriptionFor(spec.title, s),
              amountCents: amount,
              status: "succeeded",
              payerUserId: cash ? null : payer.id,
              payerName: payer.name,
              payerEmail: payer.email,
              returnPath: "/assemble/payments",
              createdAt: paidAt,
              completedAt: paidAt,
            })
            .run();
          if (familyKey) familyPayments.set(familyKey, paymentId);
        }
      }

      db.insert(studentCharges)
        .values({
          id: newId(),
          itemId,
          studentId: s.id,
          amountCents: spec.amountCents,
          status: paymentId ? "paid" : waived ? "waived" : "unpaid",
          consent,
          consentBy: consent && consent !== "pending" ? (guardians[0] ?? null) : null,
          consentAt,
          paymentId,
          paidAt,
          createdAt,
        })
        .run();
    }
  }

  /* ---------------------------------------------------------------- */
  /* Attendance & absence notes                                        */
  /* ---------------------------------------------------------------- */

  const publicHolidays = new Set([day(-19)]);
  const schoolDays: string[] = [];
  for (let n = -27; ; n++) {
    const k = day(n);
    if (k >= realToday) break;
    if (!isWeekend(k) && !publicHolidays.has(k)) schoolDays.push(k);
  }

  const teacherOf = new Map(ctx.classes.map((c) => [c.id, c.teacherId]));
  const reasons: AbsenceReason[] = ["illness", "illness", "illness", "medical", "family", "other"];
  const noteText: Record<AbsenceReason, string[]> = {
    illness: ["Temperature overnight, keeping home to rest.", "Tummy bug — back tomorrow hopefully.", "Bad cold."],
    medical: ["Dentist appointment in the morning.", "Specialist appointment at the Royal Children's."],
    family: ["Grandma's 80th birthday in Bendigo.", "Family funeral."],
    holiday: ["Family trip to Queensland."],
    other: ["Running late after a car breakdown, then stayed home."],
  };

  // Fixed story for the demo family and 6A.
  const story = new Map<string, Map<string, AttendanceStatus>>([
    [mia.id, new Map([[day(-6), "excused" as AttendanceStatus]])],
    [leo.id, new Map<string, AttendanceStatus>([[day(-3), "absent"], [day(-11), "late"]])],
  ]);
  const sixA = ctx.students.filter((s) => s.classId === cls("6A").id && s.id !== mia.id);
  const pendingPast = sixA[0];
  const pendingFuture = sixA[1];
  const lastSchoolDay = schoolDays.at(-1);
  if (pendingPast && lastSchoolDay) story.set(pendingPast.id, new Map([[lastSchoolDay, "absent" as AttendanceStatus]]));

  const rows: (typeof attendance.$inferInsert)[] = [];
  const notes: (typeof absenceNotes.$inferInsert)[] = [];
  for (const s of ctx.students) {
    const fixed = story.get(s.id);
    const recordedBy = (s.classId && teacherOf.get(s.classId)) || ctx.teacher.id;
    let streak = 0;
    for (const k of schoolDays) {
      let status: AttendanceStatus;
      if (fixed) status = fixed.get(k) ?? "present";
      else if (streak > 0) {
        status = "absent";
        streak--;
      } else {
        const roll = r.next();
        status = roll < 0.935 ? "present" : roll < 0.965 ? "late" : "absent";
        if (status === "absent" && r.chance(0.3)) streak = r.int(1, 2);
      }
      rows.push({
        id: newId(),
        studentId: s.id,
        date: k,
        status,
        note: status === "late" ? r.pick(["Arrived 9:20", "Arrived 9:35", "Doctor's appointment", null]) : null,
        recordedBy,
        recordedAt: zonedTime(k, status === "late" ? "09:40" : "09:05", tz),
      });
    }
  }
  // Explain about half of the random absences with an approved note (→ excused).
  const absentByStudent = new Map<string, string[]>();
  for (const row of rows) {
    if (row.status === "absent" && !story.has(row.studentId)) {
      absentByStudent.set(row.studentId, [...(absentByStudent.get(row.studentId) ?? []), row.date]);
    }
  }
  for (const [studentId, dates] of absentByStudent) {
    // Group consecutive school days into one note.
    const groups: string[][] = [];
    for (const d of dates) {
      const last = groups.at(-1);
      const prev = last?.at(-1);
      if (last && prev && schoolDays.indexOf(d) === schoolDays.indexOf(prev) + 1) last.push(d);
      else groups.push([d]);
    }
    for (const g of groups) {
      if (!r.chance(0.75)) continue;
      const reason = r.pick(reasons);
      const guardians = ctx.guardiansByStudent.get(studentId) ?? [];
      if (!guardians[0]) continue;
      const student = ctx.students.find((s) => s.id === studentId)!;
      notes.push({
        id: newId(),
        studentId,
        submittedBy: guardians[0],
        fromDate: g[0]!,
        toDate: g.at(-1)!,
        reason,
        note: r.pick(noteText[reason]),
        status: "approved",
        reviewedBy: (student.classId && teacherOf.get(student.classId)) || ctx.principal.id,
        createdAt: zonedTime(g[0]!, "08:10", tz),
      });
      for (const row of rows) if (row.studentId === studentId && g.includes(row.date)) row.status = "excused";
    }
  }

  // Mia's sick day, approved by Mr Reyes.
  notes.push({
    id: newId(),
    studentId: mia.id,
    submittedBy: ctx.parent.id,
    fromDate: day(-6),
    toDate: day(-6),
    reason: "illness",
    note: "Mia has a sore throat and a temperature. Keeping her home to rest.",
    status: "approved",
    reviewedBy: ctx.teacher.id,
    createdAt: at(-6, "07:45"),
  });
  // Two 6A notes waiting for Mr Reyes: one for a past absence, one in advance.
  if (pendingPast && lastSchoolDay) {
    const g = ctx.guardiansByStudent.get(pendingPast.id)?.[0];
    if (g)
      notes.push({
        id: newId(),
        studentId: pendingPast.id,
        submittedBy: g,
        fromDate: lastSchoolDay,
        toDate: lastSchoolDay,
        reason: "medical",
        note: "Orthodontist appointment in the city — sorry for the late note!",
        status: "submitted",
        createdAt: new Date(Math.min(now.getTime(), zonedTime(lastSchoolDay, "19:30", tz).getTime())),
      });
  }
  if (pendingFuture) {
    const g = ctx.guardiansByStudent.get(pendingFuture.id)?.[0];
    if (g)
      notes.push({
        id: newId(),
        studentId: pendingFuture.id,
        submittedBy: g,
        fromDate: day(2),
        toDate: day(3),
        reason: "family",
        note: "We're travelling to Adelaide for a family wedding. Happy to collect any work beforehand.",
        status: "submitted",
        createdAt: at(-1, "20:15"),
      });
  }

  for (let i = 0; i < rows.length; i += 500) db.insert(attendance).values(rows.slice(i, i + 500)).run();
  if (notes.length) db.insert(absenceNotes).values(notes).run();
}
