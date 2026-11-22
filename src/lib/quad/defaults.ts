/**
 * The spaces every school gets automatically: announcements, the whole
 * school community, a staff room, and one space per year level and class.
 *
 * Deliberately free of "server-only" so the demo seed script can use it too.
 */
import { and, asc, eq } from "drizzle-orm";
import type { DB } from "@/db/connection";
import { newId } from "@/db/ids";
import { classes, quadSpaces, schools, type AudienceType, type SpaceKind } from "@/db/schema";
import { yearLabel } from "@/lib/format";

type DefaultSpace = {
  kind: SpaceKind;
  audienceType: AudienceType;
  audienceId: string | null;
  name: string;
  emoji: string;
  description: string;
  postingPolicy: "everyone" | "staff";
};

const YEAR_EMOJI = ["🌱", "🐨", "🦘", "🐢", "🦜", "🐬", "🚀"];

export function defaultSpacesFor(
  state: string,
  classRows: { id: string; name: string; yearLevel: number }[],
): DefaultSpace[] {
  const years = [...new Set(classRows.map((c) => c.yearLevel))].sort((a, b) => a - b);
  return [
    {
      kind: "announcements",
      audienceType: "school",
      audienceId: null,
      name: "Announcements",
      emoji: "📣",
      description: "Important news from the school. Only staff can post here.",
      postingPolicy: "staff",
    },
    {
      kind: "school",
      audienceType: "school",
      audienceId: null,
      name: "Whole school community",
      emoji: "🏫",
      description: "Chat with families and staff from across the school.",
      postingPolicy: "everyone",
    },
    {
      kind: "school",
      audienceType: "staff",
      audienceId: null,
      name: "Staff room",
      emoji: "☕",
      description: "For staff only — families and students can't see this space.",
      postingPolicy: "everyone",
    },
    ...years.map(
      (y): DefaultSpace => ({
        kind: "year",
        audienceType: "year",
        audienceId: String(y),
        name: `${yearLabel(y, state)} families`,
        emoji: YEAR_EMOJI[y] ?? "🎒",
        description: `For families and staff of ${yearLabel(y, state)}.`,
        postingPolicy: "everyone",
      }),
    ),
    ...classRows.map(
      (c): DefaultSpace => ({
        kind: "class",
        audienceType: "class",
        audienceId: c.id,
        name: `${c.name} families`,
        emoji: "🍎",
        description: `For the families, teacher and students of class ${c.name}.`,
        postingPolicy: "everyone",
      }),
    ),
  ];
}

/**
 * Creates any automatic spaces that are missing (e.g. after a new class is
 * added). Cheap to call: one read of the school's audience spaces.
 */
export function ensureSchoolSpaces(db: DB, schoolId: string): void {
  const school = db.select({ state: schools.state }).from(schools).where(eq(schools.id, schoolId)).get();
  if (!school) return;
  const classRows = db
    .select({ id: classes.id, name: classes.name, yearLevel: classes.yearLevel })
    .from(classes)
    .where(eq(classes.schoolId, schoolId))
    .orderBy(asc(classes.yearLevel), asc(classes.name))
    .all();
  const existing = db
    .select({ kind: quadSpaces.kind, audienceType: quadSpaces.audienceType, audienceId: quadSpaces.audienceId })
    .from(quadSpaces)
    .where(and(eq(quadSpaces.schoolId, schoolId)))
    .all();
  const key = (s: { kind: string; audienceType: string | null; audienceId: string | null }) =>
    `${s.kind}|${s.audienceType ?? ""}|${s.audienceId ?? ""}`;
  const have = new Set(existing.map(key));
  const missing = defaultSpacesFor(school.state, classRows).filter((s) => !have.has(key(s)));
  if (!missing.length) return;
  db.insert(quadSpaces)
    .values(missing.map((s) => ({ id: newId(), schoolId, ...s })))
    .run();
}
