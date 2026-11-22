import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classes, houses, students, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { yearLabel } from "@/lib/format";
import { ClassesView } from "./ClassesView";

export default async function AdminClassesPage() {
  const me = await requireUser(["admin"]);
  const sid = me.schoolId;
  const counts = new Map(
    db
      .select({ classId: students.classId, n: count() })
      .from(students)
      .where(and(eq(students.schoolId, sid), eq(students.active, true)))
      .groupBy(students.classId)
      .all()
      .map((r) => [r.classId, r.n]),
  );
  const houseCounts = new Map(
    db
      .select({ houseId: students.houseId, n: count() })
      .from(students)
      .where(and(eq(students.schoolId, sid), eq(students.active, true)))
      .groupBy(students.houseId)
      .all()
      .map((r) => [r.houseId, r.n]),
  );
  const teachers = db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.schoolId, sid), inArray(users.role, ["staff", "admin"]), eq(users.disabled, false)))
    .orderBy(asc(users.name))
    .all();

  return (
    <ClassesView
      teachers={teachers}
      classes={db
        .select()
        .from(classes)
        .where(eq(classes.schoolId, sid))
        .orderBy(asc(classes.yearLevel), asc(classes.name))
        .all()
        .map((c) => ({
          id: c.id,
          name: c.name,
          year: yearLabel(c.yearLevel, me.school.state),
          teacherId: c.teacherId ?? "",
          room: c.room ?? "",
          students: counts.get(c.id) ?? 0,
        }))}
      houses={db
        .select()
        .from(houses)
        .where(eq(houses.schoolId, sid))
        .orderBy(asc(houses.name))
        .all()
        .map((h) => ({ id: h.id, name: h.name, color: h.color, students: houseCounts.get(h.id) ?? 0 }))}
      yearOptions={Array.from({ length: 13 }, (_, y) => ({ value: y, label: yearLabel(y, me.school.state) }))}
    />
  );
}
