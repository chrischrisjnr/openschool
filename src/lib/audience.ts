import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classes, guardians, houses, students, users, type AudienceType } from "@/db/schema";
import { yearLabel } from "./format";

export type AudienceOption = {
  /** Encoded as "type" or "type:id" — use parseAudience() to decode. */
  value: string;
  label: string;
  group: "Everyone" | "Year levels" | "Classes" | "Houses";
};

export function encodeAudience(type: AudienceType, id: string | null): string {
  return id ? `${type}:${id}` : type;
}

const AUDIENCE_TYPES: AudienceType[] = ["school", "staff", "year", "class", "house"];

/** Decodes a form value from <AudiencePicker>. Returns null if invalid. */
export function parseAudience(
  value: string,
): { audienceType: AudienceType; audienceId: string | null } | null {
  const [type, id] = value.split(":", 2) as [string, string | undefined];
  if (!AUDIENCE_TYPES.includes(type as AudienceType)) return null;
  if ((type === "school" || type === "staff") !== !id) return null;
  return { audienceType: type as AudienceType, audienceId: id ?? null };
}

/** Every audience staff can address, for pickers in forms. */
export function getAudienceOptions(schoolId: string, state = "VIC"): AudienceOption[] {
  const classRows = db
    .select()
    .from(classes)
    .where(eq(classes.schoolId, schoolId))
    .orderBy(asc(classes.yearLevel), asc(classes.name))
    .all();
  const houseRows = db.select().from(houses).where(eq(houses.schoolId, schoolId)).orderBy(asc(houses.name)).all();
  const years = [...new Set(classRows.map((c) => c.yearLevel))].sort((a, b) => a - b);
  return [
    { value: "school", label: "Whole school community", group: "Everyone" },
    { value: "staff", label: "Staff only", group: "Everyone" },
    ...years.map((y) => ({ value: `year:${y}`, label: yearLabel(y, state), group: "Year levels" as const })),
    ...classRows.map((c) => ({ value: `class:${c.id}`, label: `Class ${c.name}`, group: "Classes" as const })),
    ...houseRows.map((h) => ({ value: `house:${h.id}`, label: `${h.name} house`, group: "Houses" as const })),
  ];
}

/** Human label for an audience, e.g. "Year 3", "Class 3B", "Whole school". */
export function audienceLabel(
  schoolId: string,
  type: AudienceType,
  id: string | null,
  state = "VIC",
): string {
  switch (type) {
    case "school":
      return "Whole school";
    case "staff":
      return "Staff only";
    case "year":
      return yearLabel(Number(id), state);
    case "class": {
      const c = id ? db.select({ name: classes.name }).from(classes).where(and(eq(classes.id, id), eq(classes.schoolId, schoolId))).get() : undefined;
      return c ? `Class ${c.name}` : "Class";
    }
    case "house": {
      const h = id ? db.select({ name: houses.name }).from(houses).where(and(eq(houses.id, id), eq(houses.schoolId, schoolId))).get() : undefined;
      return h ? `${h.name} house` : "House";
    }
  }
}

/** Ids of active students addressed by an audience ("staff" → none). */
export function studentIdsInAudience(
  schoolId: string,
  type: AudienceType,
  id: string | null,
): string[] {
  if (type === "staff") return [];
  const conds = [eq(students.schoolId, schoolId), eq(students.active, true)];
  if (type === "year") conds.push(eq(students.yearLevel, Number(id)));
  if (type === "class" && id) conds.push(eq(students.classId, id));
  if (type === "house" && id) conds.push(eq(students.houseId, id));
  return db.select({ id: students.id }).from(students).where(and(...conds)).all().map((r) => r.id);
}

/**
 * User ids of everyone in an audience: guardians (and student logins) of the
 * students addressed, plus all staff. Useful for read-receipt totals.
 */
export function userIdsInAudience(
  schoolId: string,
  type: AudienceType,
  id: string | null,
): string[] {
  const staff = db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.schoolId, schoolId), inArray(users.role, ["admin", "staff"])))
    .all()
    .map((r) => r.id);
  if (type === "staff") return staff;
  const studentIds = studentIdsInAudience(schoolId, type, id);
  if (!studentIds.length) return staff;
  const parents = db
    .selectDistinct({ id: guardians.userId })
    .from(guardians)
    .where(inArray(guardians.studentId, studentIds))
    .all()
    .map((r) => r.id);
  const studentUsers = db
    .select({ id: students.userId })
    .from(students)
    .where(inArray(students.id, studentIds))
    .all()
    .flatMap((r) => (r.id ? [r.id] : []));
  return [...new Set([...staff, ...parents, ...studentUsers])];
}
