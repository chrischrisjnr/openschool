import { and, asc, eq, inArray, like, or } from "drizzle-orm";
import { db } from "@/db";
import { classes, guardians, houses, students, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { yearLabel } from "@/lib/format";
import { PeopleView } from "./PeopleView";

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string }>;
}) {
  const me = await requireUser(["admin"]);
  const { q = "", class: classId = "" } = await searchParams;
  const sid = me.schoolId;

  const staff = db
    .select({ id: users.id, name: users.name, email: users.email, title: users.title, role: users.role, disabled: users.disabled })
    .from(users)
    .where(and(eq(users.schoolId, sid), inArray(users.role, ["admin", "staff"])))
    .orderBy(asc(users.name))
    .all();

  const classRows = db.select().from(classes).where(eq(classes.schoolId, sid)).orderBy(asc(classes.yearLevel), asc(classes.name)).all();
  const houseRows = db.select().from(houses).where(eq(houses.schoolId, sid)).orderBy(asc(houses.name)).all();

  const term = q.trim();
  const studentRows = db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      yearLevel: students.yearLevel,
      className: classes.name,
      houseName: houses.name,
    })
    .from(students)
    .leftJoin(classes, eq(classes.id, students.classId))
    .leftJoin(houses, eq(houses.id, students.houseId))
    .where(
      and(
        eq(students.schoolId, sid),
        eq(students.active, true),
        classId ? eq(students.classId, classId) : undefined,
        term ? or(like(students.firstName, `%${term}%`), like(students.lastName, `%${term}%`)) : undefined,
      ),
    )
    .orderBy(asc(students.lastName), asc(students.firstName))
    .limit(200)
    .all();

  const guardianRows = studentRows.length
    ? db
        .select({ studentId: guardians.studentId, name: users.name, email: users.email, relationship: guardians.relationship })
        .from(guardians)
        .innerJoin(users, eq(users.id, guardians.userId))
        .where(inArray(guardians.studentId, studentRows.map((s) => s.id)))
        .all()
    : [];

  return (
    <PeopleView
      meId={me.id}
      q={q}
      classId={classId}
      staff={staff}
      classes={classRows.map((c) => ({ id: c.id, name: c.name }))}
      houses={houseRows.map((h) => h.name)}
      students={studentRows.map((s) => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        detail: [yearLabel(s.yearLevel, me.school.state), s.className && `Class ${s.className}`, s.houseName].filter(Boolean).join(" · "),
        guardians: guardianRows.filter((g) => g.studentId === s.id).map((g) => `${g.name} (${g.relationship}) · ${g.email}`),
      }))}
    />
  );
}
