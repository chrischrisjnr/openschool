import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classes, guardians, students, users } from "@/db/schema";
import { redirect } from "next/navigation";
import { getViewer, type Viewer } from "@/lib/viewer";

/**
 * Permission helpers for Assemble's pages and server actions. Every server
 * action calls one of these before touching the database.
 */

export const isParent = (viewer: Viewer) => viewer.role === "parent";

/** For pages: signed-in staff only, otherwise back to Assemble's home. */
export async function requireStaffViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer.isStaff) redirect("/assemble");
  return viewer;
}

/** True when a parent may act for this student (their own child). */
export function ownsStudent(viewer: Viewer, studentId: string): boolean {
  return viewer.students.some((s) => s.id === studentId);
}

/** Students in this school with the given ids (guards against cross-school ids). */
export function schoolStudentIds(schoolId: string, ids: string[]): string[] {
  if (!ids.length) return [];
  return db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.schoolId, schoolId), inArray(students.id, ids)))
    .all()
    .map((r) => r.id);
}

/** Classes a staff member teaches (admins: none unless they have a class). */
export function classesTaughtBy(userId: string) {
  return db.select().from(classes).where(eq(classes.teacherId, userId)).orderBy(asc(classes.name)).all();
}

export type Household = {
  key: string;
  userIds: string[];
  /** e.g. "Sarah Walker & Anh Nguyen" */
  parentNames: string;
  /** e.g. "Mia (6A), Leo (2A)" */
  children: string;
};

/**
 * Groups the guardians of these students into households: parents who share
 * a child count as one family. Used for "12 of 24 families have read this".
 */
export function householdsForStudents(studentIds: string[]): Household[] {
  if (!studentIds.length) return [];
  const rows = db
    .select({
      userId: guardians.userId,
      studentId: guardians.studentId,
      parentName: users.name,
      isPrimary: guardians.isPrimary,
      first: students.firstName,
      preferred: students.preferredName,
      className: classes.name,
    })
    .from(guardians)
    .innerJoin(users, eq(users.id, guardians.userId))
    .innerJoin(students, eq(students.id, guardians.studentId))
    .leftJoin(classes, eq(classes.id, students.classId))
    .where(and(inArray(guardians.studentId, studentIds), eq(users.role, "parent")))
    .all();

  // Union–find over parents linked by a shared child.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const firstParentOf = new Map<string, string>();
  for (const r of rows) {
    if (!parent.has(r.userId)) parent.set(r.userId, r.userId);
    const other = firstParentOf.get(r.studentId);
    if (other) parent.set(find(r.userId), find(other));
    else firstParentOf.set(r.studentId, r.userId);
  }

  const groups = new Map<string, { users: Map<string, { name: string; primary: boolean }>; kids: Map<string, string> }>();
  for (const r of rows) {
    const root = find(r.userId);
    const g = groups.get(root) ?? { users: new Map(), kids: new Map() };
    const existing = g.users.get(r.userId);
    g.users.set(r.userId, { name: r.parentName, primary: (existing?.primary ?? false) || r.isPrimary });
    g.kids.set(r.studentId, `${r.preferred ?? r.first}${r.className ? ` (${r.className})` : ""}`);
    groups.set(root, g);
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      const people = [...g.users.entries()].sort((a, b) => Number(b[1].primary) - Number(a[1].primary));
      return {
        key,
        userIds: people.map(([id]) => id),
        parentNames: people.map(([, p]) => p.name).join(" & "),
        children: [...g.kids.values()].join(", "),
      };
    })
    .sort((a, b) => a.parentNames.localeCompare(b.parentNames));
}
