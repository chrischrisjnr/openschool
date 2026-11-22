import "server-only";
import { and, asc, eq, inArray, or, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { cache } from "react";
import { db } from "@/db";
import {
  classes,
  guardians,
  houses,
  students,
  type AudienceType,
  type Role,
} from "@/db/schema";
import { requireUser, type SessionUser } from "./auth";

export type ViewerStudent = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  displayName: string;
  yearLevel: number;
  classId: string | null;
  className: string | null;
  houseId: string | null;
  houseName: string | null;
  houseColor: string | null;
};

export type Viewer = SessionUser & {
  isStaff: boolean;
  isAdmin: boolean;
  /** Students this user is responsible for (parents) or is (students). Empty for staff. */
  students: ViewerStudent[];
  /** Audience keys like "school", "year:3", "class:abc", "house:xyz". */
  audienceKeys: Set<string>;
};

const studentFields = {
  id: students.id,
  firstName: students.firstName,
  lastName: students.lastName,
  preferredName: students.preferredName,
  yearLevel: students.yearLevel,
  classId: students.classId,
  className: classes.name,
  houseId: students.houseId,
  houseName: houses.name,
  houseColor: houses.color,
};

function loadStudents(userId: string, role: Role): ViewerStudent[] {
  const base = db
    .select(studentFields)
    .from(students)
    .leftJoin(classes, eq(classes.id, students.classId))
    .leftJoin(houses, eq(houses.id, students.houseId));
  const rows =
    role === "parent"
      ? base
          .innerJoin(guardians, eq(guardians.studentId, students.id))
          .where(and(eq(guardians.userId, userId), eq(students.active, true)))
          .orderBy(asc(students.yearLevel), asc(students.firstName))
          .all()
      : role === "student"
        ? base.where(eq(students.userId, userId)).all()
        : [];
  return rows.map((s) => ({
    ...s,
    displayName: `${s.preferredName ?? s.firstName} ${s.lastName}`,
  }));
}

/** The signed-in user plus everything needed to decide what they can see. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await requireUser();
  const isStaff = user.role === "admin" || user.role === "staff";
  const linked = loadStudents(user.id, user.role);
  const audienceKeys = new Set<string>(["school"]);
  if (isStaff) audienceKeys.add("staff");
  for (const s of linked) {
    audienceKeys.add(`year:${s.yearLevel}`);
    if (s.classId) audienceKeys.add(`class:${s.classId}`);
    if (s.houseId) audienceKeys.add(`house:${s.houseId}`);
  }
  return {
    ...user,
    isStaff,
    isAdmin: user.role === "admin",
    students: linked,
    audienceKeys,
  };
});

/** True when the viewer should see an item addressed to this audience. */
export function canSeeAudience(
  viewer: Pick<Viewer, "isStaff" | "audienceKeys">,
  type: AudienceType,
  id: string | null,
): boolean {
  if (viewer.isStaff) return true;
  if (type === "school") return true;
  if (type === "staff") return false;
  return viewer.audienceKeys.has(`${type}:${id}`);
}

/**
 * SQL condition restricting rows with audience columns to those the viewer
 * may see. Returns undefined for staff (who see everything).
 */
export function audienceWhere(
  viewer: Pick<Viewer, "isStaff" | "audienceKeys">,
  typeCol: SQLiteColumn,
  idCol: SQLiteColumn,
): SQL | undefined {
  if (viewer.isStaff) return undefined;
  const ids = (prefix: string) =>
    [...viewer.audienceKeys]
      .filter((k) => k.startsWith(`${prefix}:`))
      .map((k) => k.slice(prefix.length + 1));
  const clauses: SQL[] = [eq(typeCol, "school")];
  for (const t of ["year", "class", "house"] as const) {
    const list = ids(t);
    if (list.length) clauses.push(and(eq(typeCol, t), inArray(idCol, list))!);
  }
  return or(...clauses);
}
