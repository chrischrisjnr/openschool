/**
 * Demo data for Quad: Wattle Creek Primary's community spaces, groups,
 * direct messages, reactions, threads and a moderation report.
 *
 * Timestamps are relative to "now" so the demo always looks fresh.
 */
import { and, eq } from "drizzle-orm";
import type { DB } from "../../src/db/connection";
import { newId } from "../../src/db/ids";
import {
  quadMembers,
  quadMessages,
  quadReactions,
  quadReports,
  quadSpaces,
  users,
  type User,
} from "../../src/db/schema";
import { dayKey } from "../../src/lib/format";
import { ensureSchoolSpaces } from "../../src/lib/quad/defaults";
import { rng, type SeedContext } from "./core";

const TZ = "Australia/Melbourne";
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** "+11:00" — the school's UTC offset right now. */
function tzOffset(date: Date): string {
  const name = new Intl.DateTimeFormat("en-AU", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name?.match(/GMT([+-]\d{2}:\d{2})/);
  return m?.[1] ?? "+11:00";
}

export async function seedQuad(db: DB, ctx: SeedContext): Promise<void> {
  const r = rng(314);
  const now = new Date();
  const offset = tzOffset(now);

  /** A school-local time `daysAgo` days ago, never in the future. */
  const at = (daysAgo: number, hhmm: string): Date => {
    const key = dayKey(new Date(now.getTime() - daysAgo * DAY), TZ);
    const d = new Date(`${key}T${hhmm}:00${offset}`);
    return d.getTime() > now.getTime() - 5 * MIN ? new Date(now.getTime() - (10 + daysAgo) * MIN) : d;
  };
  const ago = (minutes: number) => new Date(now.getTime() - minutes * MIN);

  ensureSchoolSpaces(db, ctx.school.id);
  const spaces = db.select().from(quadSpaces).where(eq(quadSpaces.schoolId, ctx.school.id)).all();
  const cls = (name: string) => ctx.classes.find((c) => c.name === name)!;
  const space = (kind: string, audienceType: string, audienceId: string | null = null) =>
    spaces.find((s) => s.kind === kind && s.audienceType === audienceType && s.audienceId === audienceId)!;

  const announcements = space("announcements", "school");
  const community = space("school", "school");
  const staffRoom = space("school", "staff");
  const year6 = space("year", "year", "6");
  const year2 = space("year", "year", "2");
  const class6A = space("class", "class", cls("6A").id);
  const class2A = space("class", "class", cls("2A").id);

  // --- People ---------------------------------------------------------------
  const { principal, office, teacher, parent: sarah, studentUser: mia } = ctx;
  const byEmail = (email: string) => db.select().from(users).where(eq(users.email, email)).get()!;
  const anh = byEmail("anh.nguyen@demo.openschools.au");
  const staffNamed = (name: string) => ctx.staff.find((s) => s.name === name)!;
  const msNguyen = staffNamed("Ms Lucy Nguyen");
  const coach = staffNamed("Coach Ben Walsh");
  const msWhitfield = staffNamed("Ms Grace Whitfield");

  const parentsOf = (className: string): User[] => {
    const ids = new Set(
      ctx.students
        .filter((s) => s.classId === cls(className).id)
        .flatMap((s) => ctx.guardiansByStudent.get(s.id) ?? []),
    );
    return ctx.parents.filter((p) => ids.has(p.id) && p.id !== sarah.id && p.id !== anh.id);
  };
  const p6A = parentsOf("6A");
  const p2A = parentsOf("2A");
  const others = ctx.parents.filter((p) => !p6A.includes(p) && !p2A.includes(p) && p.id !== sarah.id && p.id !== anh.id);
  const [a6, b6, c6, d6, e6] = p6A;
  const [a2, b2, c2] = p2A;
  const [o1, o2, o3, o4, o5, o6, o7] = others;
  if (!a6 || !b6 || !c6 || !d6 || !e6 || !a2 || !b2 || !c2 || !o1 || !o2 || !o3 || !o4 || !o5 || !o6 || !o7) {
    throw new Error("Quad seed: not enough demo parents");
  }
  const president = o1; // P&C president
  const coordinator = o2; // Colour Run volunteer coordinator

  // --- Groups -----------------------------------------------------------------
  const group = (
    name: string,
    emoji: string,
    description: string,
    createdBy: User,
    opts: { visibility?: "open" | "private"; createdDaysAgo?: number } = {},
  ) => {
    const id = newId();
    db.insert(quadSpaces)
      .values({
        id,
        schoolId: ctx.school.id,
        name,
        emoji,
        description,
        kind: "group",
        visibility: opts.visibility ?? "open",
        createdBy: createdBy.id,
        createdAt: at(opts.createdDaysAgo ?? 20, "09:00"),
      })
      .run();
    return id;
  };
  const pandc = group("P&C", "🤝", "Parents & Citizens — planning events, fundraising and having a say in school life. Everyone welcome!", president);
  const colourRun = group("Colour Run volunteers", "🌈", "Helpers for the Colour Run and other big fundraising days.", coordinator);
  const sport = group("Weekend sport", "⚽", "Results, carpools and fixtures for Saturday and Sunday sport.", coach);
  const lostProperty = group("Lost property", "🧺", "Lost something? Found something? Post it here. Run by the school office.", office);
  const bookClub = group("Book club", "📚", "A relaxed monthly book club for parents and carers. Coffee essential.", o5);
  const camp = group("Year 6 camp planning", "🏕️", "Staff planning for the Year 6 camp to Phillip Island.", teacher, { visibility: "private" });

  const members: { spaceId: string; userId: string; role?: "member" | "moderator"; lastReadAt?: Date | null }[] = [];
  const join = (spaceId: string, list: User[], role: "member" | "moderator" = "member") => {
    for (const u of list) members.push({ spaceId, userId: u.id, role, lastReadAt: null });
  };
  join(pandc, [president], "moderator");
  join(pandc, [principal, sarah, a6, c6, b2, o3, o4, o6]);
  join(colourRun, [coordinator], "moderator");
  join(colourRun, [coach, sarah, b6, d6, a2, o3, o7]);
  join(sport, [coach], "moderator");
  join(sport, [a6, e6, c2, o4, o6, o7]);
  join(lostProperty, [office], "moderator");
  join(lostProperty, [sarah, a6, b6, a2, c2, o2, o5, anh]);
  join(bookClub, [o5], "moderator");
  join(bookClub, [b6, o3, o6, c2]);
  join(camp, [teacher], "moderator");
  join(camp, [msWhitfield, principal]);

  // --- Messages ---------------------------------------------------------------
  type Seeded = { id: string };
  const post = (spaceId: string, author: User, when: Date, body: string, parentId?: string): Seeded => {
    const id = newId();
    db.insert(quadMessages).values({ id, spaceId, authorId: author.id, body, parentId: parentId ?? null, createdAt: when }).run();
    return { id };
  };
  const react = (m: Seeded, emoji: string, people: User[]) => {
    for (const u of people) db.insert(quadReactions).values({ messageId: m.id, userId: u.id, emoji }).onConflictDoNothing().run();
  };
  const pin = (m: Seeded) => db.update(quadMessages).set({ pinned: true }).where(eq(quadMessages.id, m.id)).run();
  const someParents = (n: number) => [...ctx.parents].sort(() => r.next() - 0.5).slice(0, n);

  // Announcements (staff only)
  const welcome = post(
    announcements.id,
    principal,
    at(13, "08:30"),
    "Welcome to Quad! 👋\n\nThis is our new place for school community chat: your class and year level spaces, groups like the P&C, and private messages with teachers. It's free, and it replaces the old Facebook groups and WhatsApp chats.\n\nPlease take a moment to read the community guidelines on the Quad home page. — Dr Okafor",
  );
  pin(welcome);
  react(welcome, "🎉", someParents(9));
  react(welcome, "👍", [...someParents(6), teacher, msNguyen]);
  const swimming = post(
    announcements.id,
    office,
    at(10, "09:15"),
    "Reminder: the Term 4 swimming program starts next week for Years 3–6. Please send bathers, a towel and goggles in a named bag. Permission and payment are in Assemble.",
  );
  react(swimming, "👍", someParents(5));
  const bbq = post(
    announcements.id,
    principal,
    at(7, "15:40"),
    "Save the date: our end-of-year Christmas BBQ and carols night is on Friday 11 December from 5:30 pm on the oval 🎄\n\nThe P&C are looking for helpers — join the P&C group in Browse groups if you can lend a hand.",
  );
  react(bbq, "🎉", someParents(8));
  react(bbq, "❤️", someParents(4));
  const heat = post(
    announcements.id,
    principal,
    at(3, "16:05"),
    "Hot weather plan ☀️ With temperatures in the mid-30s forecast tomorrow, lunch play will be in the shaded areas and the library. Please pack a full water bottle and a hat — no hat, play in the shade.\n\nForecast: https://www.bom.gov.au/vic/forecasts/melbourne.shtml",
  );
  react(heat, "🙏", someParents(6));
  post(
    announcements.id,
    office,
    at(1, "10:20"),
    "The uniform shop will be open Tuesday 8:30–9:30 am for summer uniform orders. Second-hand dresses and shorts are $5 each.",
  );

  // Whole school community
  const recorder = post(community.id, o3, at(11, "19:42"), "Does anyone have a spare recorder? Ours has mysteriously vanished 🙈");
  post(community.id, o6, at(11, "20:05"), "We have two! I'll leave one at the office tomorrow with your name on it.", recorder.id);
  post(community.id, o3, at(11, "20:11"), "You're a lifesaver, thank you!", recorder.id);
  const assembly = post(community.id, a2, at(9, "11:30"), "Lovely to see so many families at assembly this morning. The Year 2 dance was a highlight 💃");
  react(assembly, "❤️", [sarah, b2, msNguyen, o4]);
  post(community.id, o4, at(8, "18:15"), "Carpool from the Sydney Rd side, anyone? Happy to share drop-offs on Tuesdays and Thursdays 🚗");
  post(community.id, sarah, at(8, "18:40"), "We're near Sydney Rd too — I'll send you a message!");
  // An earlier report that a moderator acted on.
  const removed = post(community.id, o7, at(6, "21:10"), "Honestly some of the parents in 4A need to learn some manners.");
  db.update(quadMessages)
    .set({ deletedAt: at(6, "21:45"), deletedBy: principal.id })
    .where(eq(quadMessages.id, removed.id))
    .run();
  post(community.id, o2, at(4, "08:50"), "Heads up: the Glenlyon Rd crossing has a new supervisor. Her name is Pat and she's lovely 😊");
  // The open report in the moderation queue.
  const spam = post(
    community.id,
    o6,
    at(2, "21:30"),
    "Anyone wanting to make $$$ from home?? 💰 DM me about my wellness oils business, special prices for Wattle Creek families! www.example.com/oils-offer",
  );
  post(community.id, o5, at(1, "07:55"), "Does anyone know if the school hall is available to hire on weekends? Thinking of a kids' birthday party 🎈");
  post(community.id, office, at(1, "09:10"), "It is! Pop into the office or email us and we'll send the booking form.", undefined);

  // Staff room
  post(staffRoom.id, principal, at(5, "07:45"), "Morning tea in the staff room on Friday to celebrate getting reports done ✍️ Thank you all for your hard work this term!");
  post(staffRoom.id, teacher, at(5, "07:58"), "I'll bring a lemon slice 🍋");
  post(staffRoom.id, msNguyen, at(2, "12:30"), "Has anyone seen the Year 2 laminator? 😅");
  post(staffRoom.id, coach, at(2, "12:41"), "It's in the PE shed. Long story.");

  // 6A families — the busy one
  const hi = post(class6A.id, teacher, at(13, "16:10"), "Hi 6A families! Mr Reyes here 👋 I'll use this space for quick class updates and reminders. For anything about your own child, please send me a direct message.");
  react(hi, "👍", [sarah, a6, b6, c6, d6]);
  post(class6A.id, a6, at(13, "16:32"), "Thanks Mr Reyes! Great to have everything in one place.");
  post(class6A.id, sarah, at(12, "20:14"), "Thanks! Is the camp packing list going out soon?");
  const packing = post(
    class6A.id,
    teacher,
    at(12, "20:40"),
    "Yes! Here's the short version for camp 🏕️\n\n• Sleeping bag and pillow\n• Torch\n• Warm jumper and raincoat\n• Sturdy closed shoes\n• Hat and sunscreen\n\nNo phones or devices please 📵 The full list is in Assemble.",
  );
  pin(packing);
  react(packing, "👍", [sarah, a6, b6, c6, d6, e6]);
  react(packing, "🙏", [b6, e6]);
  post(class6A.id, b6, at(10, "18:05"), "Has anyone else's kid come home talking about the solar system project nonstop? 🪐 Ours has turned the lounge room into Jupiter.");
  post(class6A.id, c6, at(10, "18:12"), "Ha! Ours is building Saturn out of a pool noodle 😂");
  post(class6A.id, sarah, at(10, "18:30"), "Mia wants to do Neptune because “nobody ever picks Neptune”. Fair enough!");
  post(class6A.id, teacher, at(9, "15:55"), "Love it! Projects are due in two weeks. Recycled materials are perfect — please don't buy anything special.");
  post(
    class6A.id,
    teacher,
    at(7, "15:30"),
    "Reminder: our Scienceworks excursion is on Thursday 🚌 Please sign the permission slip in Assemble. We leave at 9:00 am sharp and are back by 2:45 pm. Packed lunch and a water bottle please.",
  );
  post(class6A.id, d6, at(7, "16:02"), "Is there room for one more parent helper?");
  post(class6A.id, teacher, at(7, "16:20"), "We have three helpers already, but I'll let you know if anyone drops out. Thank you!");
  const thanks = post(class6A.id, b6, at(5, "17:45"), "The kids had the best time at Scienceworks! Thank you Mr Reyes and the helpers 🙏");
  react(thanks, "❤️", [sarah, a6, c6, d6]);
  post(class6A.id, sarah, at(5, "18:01"), "Mia hasn't stopped talking about the lightning show ⚡");
  post(
    class6A.id,
    teacher,
    at(4, "14:50"),
    "Graduation photos are next Tuesday — full summer uniform please. Info from the photographer: https://example.com/wattle-creek-photos",
  );
  post(class6A.id, e6, at(3, "19:20"), "Does anyone know if graduation is in the hall or the gym this year?");
  post(class6A.id, teacher, at(3, "19:48"), "In the hall — 6:00 pm on Wednesday 16 December. More details soon!");
  const picnic = post(
    class6A.id,
    sarah,
    at(2, "20:05"),
    "Would anyone be keen on a 6A end-of-year picnic at Princes Park after graduation? Everyone could bring a plate 🧺",
  );
  react(picnic, "🎉", [a6, c6, d6, teacher]);
  post(class6A.id, d6, at(2, "20:20"), "We're in! 🙋", picnic.id);
  post(class6A.id, c6, at(2, "20:31"), "Sounds lovely. We can bring a fruit platter 🍉", picnic.id);
  post(class6A.id, teacher, at(2, "21:02"), "What a great idea. I'd love to pop by if that's OK 😊", picnic.id);
  post(class6A.id, sarah, at(1, "07:40"), "Of course! I'll make a sign-up list closer to the date.", picnic.id);
  post(class6A.id, teacher, at(1, "15:30"), "Quick one: library books are due back by Friday so the library can do its end-of-year stocktake 📚");
  // Unread for the demo parent from here on.
  const sarahRead6A = at(1, "17:00");
  post(class6A.id, teacher, ago(5 * 60), "Great news — the solar system projects will be on display at the end-of-year exhibition. Families welcome from 3:00 pm on the last Thursday of term 🪐");
  post(class6A.id, b6, ago(3 * 60 + 10), "Wonderful! Will there be a sausage sizzle? 🌭");
  post(class6A.id, e6, ago(2 * 60), "Do the kids need to stay with their project, or can they wander around?");
  post(class6A.id, teacher, ago(40), "They can wander — we'll have a roster so each project has someone nearby. The sausage sizzle is a question for the P&C! 😄");

  // Year 6 families
  post(year6.id, principal, at(8, "12:15"), "Year 6 families: the graduation committee meets next Monday at 3:30 pm in the library. If you'd like to help with decorations, please reply here 🎓");
  post(year6.id, a6, at(8, "13:02"), "Happy to help with decorations!");
  post(year6.id, msWhitfield, at(6, "15:10"), "6B and 6A will rehearse the graduation song together on Fridays. Kids are sounding great already 🎶");

  // Year 2 families and 2A
  const plants = post(year2.id, msNguyen, at(11, "15:20"), "Hello Year 2 families! We're starting our “Living things” unit. If you have any old pots or seedlings to donate, we'd love them 🌱");
  post(year2.id, a2, at(11, "16:45"), "We have heaps of strawberry runners — I'll send some in!");
  react(plants, "👍", [sarah, a2, b2]);
  const kevin = post(year2.id, sarah, at(8, "17:30"), "Leo came home with a bean sprout in a cup and has named it Kevin 🌱😂");
  react(kevin, "😂", [a2, b2, c2, msNguyen]);
  post(year2.id, msNguyen, at(8, "17:52"), "Kevin is thriving in the classroom too! 😄");
  post(year2.id, b2, at(6, "08:10"), "Quick question: is sport uniform on Wednesdays or Thursdays for Year 2?");
  post(year2.id, c2, at(6, "08:22"), "Wednesdays! Learnt that one the hard way 😅");
  post(year2.id, msNguyen, at(2, "15:35"), "Reminder: the Year 2 assembly performance is this Friday at 2:30 pm. Children can wear something red, green or gold 🎄");
  post(year2.id, b2, at(1, "19:05"), "Does anyone have a spare kids' Santa hat? 🎅");
  post(class2A.id, msNguyen, at(9, "15:40"), "2A families: our class reading goal is 1,000 nights of reading this term. We're at 812! 📖");
  post(class2A.id, a2, at(9, "16:30"), "Go 2A! 🎉");

  // P&C
  post(
    pandc,
    president,
    at(12, "19:00"),
    "Welcome to the P&C group! Our next meeting is Tuesday at 7 pm in the library (or join online). On the agenda: Christmas BBQ, Colour Run wrap-up and new shade sails.",
  );
  post(pandc, principal, at(12, "19:25"), "Thanks! I'll bring an update on the shade sail quote.");
  const roster = post(
    pandc,
    president,
    at(9, "20:10"),
    "Christmas BBQ planning 🎄🌭 We need:\n• 6 people on the BBQ (two shifts)\n• 4 on drinks\n• 2 on the raffle table\n• Someone with a ute to pick up the cool room\n\nReply in the thread with what you can do!",
  );
  pin(roster);
  post(pandc, sarah, at(9, "20:22"), "Put me down for drinks, first shift 🥤", roster.id);
  post(pandc, a6, at(9, "20:40"), "Happy to do a BBQ shift — I'll bring my own tongs 😎", roster.id);
  post(pandc, o4, at(9, "21:05"), "I have a ute! I can grab the cool room on the Friday.", roster.id);
  post(pandc, president, at(9, "21:30"), "Legends, thank you! I'll put the roster together this week.", roster.id);
  post(pandc, c6, at(6, "12:45"), "Do we need a food handling certificate for the BBQ?");
  post(pandc, president, at(6, "13:10"), "One person per shift needs it — I have mine and so does Tom. Everyone else just needs clean hands and a big smile 😄");
  post(pandc, b2, at(4, "18:20"), "Vegetarian sausages too please! Last year they sold out by 6:30.");
  post(pandc, president, at(4, "18:34"), "Noted — ordering double 🌱");
  post(pandc, sarah, at(2, "09:40"), "The Colour Run total is amazing — well done everyone! 🌈");
  const total = post(pandc, president, at(2, "10:05"), "We raised just over $14,000! That's the shade sails covered 🎉 Full details are in Fete.");
  react(total, "🎉", [sarah, a6, c6, b2, o3, principal]);

  // Colour Run volunteers
  post(colourRun, coordinator, at(13, "18:00"), "Thanks for signing up to help with the Colour Run! Volunteer briefing is at 8:15 am at the canteen. Wear clothes you don't mind getting colourful 🌈");
  post(colourRun, sarah, at(13, "18:20"), "Can I bring my sunnies? Asking for my eyes 😂");
  post(colourRun, coordinator, at(13, "18:31"), "Definitely — swimming goggles are even better!");
  post(colourRun, coach, at(12, "07:10"), "I'll set up the course from 7:30. Could use two extra pairs of hands at the colour stations.");
  post(colourRun, d6, at(12, "07:25"), "I can help from 7:30 👋");
  const wow = post(colourRun, coordinator, at(11, "14:00"), "What a morning!! Thank you all — the kids had a ball. Photos coming soon 📸");
  react(wow, "❤️", [sarah, b6, d6, a2, coach]);
  const stain = post(colourRun, o7, at(10, "19:30"), "Does anyone know how to get pink powder out of a white school shirt? Asking for a friend… 🙈");
  post(colourRun, a2, at(10, "19:44"), "Soak it in cold water with a bit of laundry soap overnight. Worked for us!", stain.id);
  post(colourRun, o7, at(10, "21:00"), "It worked! Thank you 🙏", stain.id);

  // Lost property
  const lostRules = post(lostProperty, office, at(10, "08:45"), "Lost property is outside the office. Anything unnamed goes to the second-hand uniform stall at the end of each term — please name everything! 🏷️");
  pin(lostRules);
  post(lostProperty, b6, at(8, "15:30"), "Has anyone seen a navy jumper with “Archie T” on the tag? It went missing after sport.");
  post(lostProperty, office, at(8, "15:52"), "Found it! It's at the office 😊");
  post(lostProperty, sarah, at(4, "15:40"), "Leo's lost a green drink bottle with a dinosaur sticker 🦕");
  post(lostProperty, c2, at(3, "08:55"), "There's one like that on the hook outside 2A!");
  const found = post(lostProperty, sarah, at(3, "15:35"), "Got it — thank you!! 🙏");
  react(found, "🎉", [c2, office]);
  post(lostProperty, office, at(1, "12:10"), "Current haul: 14 hats, 9 jumpers, 6 drink bottles and one very lonely left shoe 👟 Come and have a look!");

  // Weekend sport
  post(sport, coach, at(8, "12:30"), "Saturday netball: the Wattle Creek Wombats won 12–8! Great team effort 🏐");
  post(sport, o4, at(6, "17:10"), "Under 10s footy is at Gillon Oval this Sunday, 9 am. Bring a jumper, it's always windy there 🌬️");
  post(sport, e6, at(1, "18:40"), "Anyone want to carpool to Saturday's cricket in Coburg? We have two spare seats.");

  // Book club
  post(bookClub, o5, at(9, "20:00"), "This month's book: “The Dictionary of Lost Words” by Pip Williams. We'll meet at the Brunswick library café, Thursday 7 pm ☕");
  post(bookClub, o3, at(3, "21:15"), "Halfway through and loving it!");

  // Year 6 camp planning (private staff group)
  post(camp, teacher, at(7, "16:30"), "Cabin lists draft is in the shared drive. Let me know if you spot any pairings we should change.");
  post(camp, msWhitfield, at(7, "16:55"), "Looks good. I'll check the medical forms against it tomorrow.");

  // --- Direct messages --------------------------------------------------------
  const dm = (people: User[], createdDaysAgo: number) => {
    const id = newId();
    db.insert(quadSpaces)
      .values({
        id,
        schoolId: ctx.school.id,
        name: "Direct message",
        emoji: "✉️",
        kind: "direct",
        visibility: "private",
        createdBy: people[0]!.id,
        createdAt: at(createdDaysAgo, "08:00"),
      })
      .run();
    for (const u of people) members.push({ spaceId: id, userId: u.id, lastReadAt: null });
    return id;
  };

  const sarahTeacher = dm([sarah, teacher], 6);
  post(sarahTeacher, sarah, at(6, "19:50"), "Hi Mr Reyes, just letting you know Mia is a bit worried about camp — she's never been away from home overnight. Is there anything we can do to help her feel more prepared?");
  post(sarahTeacher, teacher, at(6, "20:35"), "Hi Sarah, thanks so much for letting me know. That's really common and completely okay. I'll make sure she's in a cabin with friends, and we'll go through the daily timetable in class so there are no surprises. Would she like a quick chat with me at lunchtime this week?");
  post(sarahTeacher, sarah, at(6, "20:41"), "That would be wonderful, thank you. She'd love that.");
  const chat = post(sarahTeacher, teacher, at(4, "15:45"), "We had a lovely chat today — she's actually starting to get excited about the flying fox! 😊");
  react(chat, "❤️", [sarah]);
  post(sarahTeacher, sarah, at(4, "16:02"), "Thank you so much, that's made our week 🙏");
  const sarahReadDm = at(4, "16:03");
  post(sarahTeacher, teacher, ago(90), "Hi Sarah, Mia gave a fantastic presentation on Neptune today — you'd have been very proud! 🪐");

  const carpool = dm([o4, sarah], 8);
  post(carpool, sarah, at(8, "18:45"), "Hi! Saw your carpool message. We're on Albert St — Tuesdays and Thursdays would work well for us.");
  post(carpool, o4, at(8, "19:10"), "Perfect, we're just around the corner. Shall I do Tuesdays and you do Thursdays?");
  post(carpool, sarah, at(8, "19:12"), "Deal! 🚗");

  const miaTeacher = dm([mia, teacher], 3);
  post(miaTeacher, mia, at(3, "18:30"), "Hi Mr Reyes, I left my library book at home. Can I bring it tomorrow?");
  post(miaTeacher, teacher, at(3, "19:05"), "Of course, Mia. Thanks for letting me know!");

  const staffDm = dm([principal, teacher], 5);
  post(staffDm, principal, at(5, "11:20"), "Daniel, could you send me the final camp numbers by Friday? Thanks!");
  post(staffDm, teacher, at(5, "11:42"), "Will do — 24 students and 3 parent helpers so far.");

  // --- Membership rows and read positions ------------------------------------
  db.insert(quadMembers).values(members.map((m) => ({ ...m, joinedAt: at(14, "08:00") }))).run();
  const setRead = (spaceId: string, user: User, when: Date) =>
    db.insert(quadMembers)
      .values({ spaceId, userId: user.id, lastReadAt: when, joinedAt: at(14, "08:00") })
      .onConflictDoUpdate({ target: [quadMembers.spaceId, quadMembers.userId], set: { lastReadAt: when } })
      .run();

  // The demo parent has caught up on most things, with a few new messages waiting.
  setRead(announcements.id, sarah, at(2, "08:00"));
  setRead(community.id, sarah, at(3, "20:00"));
  setRead(class6A.id, sarah, sarahRead6A);
  setRead(year6.id, sarah, now);
  setRead(year2.id, sarah, now);
  setRead(class2A.id, sarah, now);
  setRead(pandc, sarah, at(3, "12:00"));
  setRead(colourRun, sarah, now);
  setRead(lostProperty, sarah, now);
  setRead(sarahTeacher, sarah, sarahReadDm);
  setRead(carpool, sarah, now);

  // The demo teacher: up to date in 6A, a little behind elsewhere.
  setRead(class6A.id, teacher, ago(30));
  setRead(year6.id, teacher, at(7, "09:00"));
  setRead(announcements.id, teacher, at(1, "09:00"));
  setRead(community.id, teacher, at(2, "09:00"));
  setRead(staffRoom.id, teacher, at(3, "09:00"));
  setRead(sarahTeacher, teacher, now);
  setRead(miaTeacher, teacher, now);
  setRead(staffDm, teacher, now);
  setRead(camp, teacher, now);

  // Mia (student): her class, announcements and the whole school space.
  setRead(class6A.id, mia, at(1, "17:00"));
  setRead(announcements.id, mia, at(3, "09:00"));
  setRead(community.id, mia, at(3, "09:00"));
  setRead(miaTeacher, mia, now);

  setRead(announcements.id, principal, now);
  setRead(staffDm, principal, now);

  // --- Moderation -------------------------------------------------------------
  db.insert(quadReports)
    .values([
      { id: newId(), messageId: spam.id, reporterId: o2.id, reason: "Spam or advertising — selling products in the community space", createdAt: at(1, "07:30") },
      { id: newId(), messageId: removed.id, reporterId: o3.id, reason: "Unkind or bullying", status: "resolved", resolvedBy: principal.id, createdAt: at(6, "21:20") },
    ])
    .run();

  // Sanity check: everyone in a DM exists exactly once.
  const dmCount = db.select().from(quadMembers).where(and(eq(quadMembers.spaceId, sarahTeacher))).all().length;
  if (dmCount !== 2) throw new Error("Quad seed: unexpected DM membership");
}
