import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, houses, students, users } from "@/db/schema";
import { classesTaughtBy, requireStaffViewer } from "@/lib/assemble/access";
import { attendanceStats } from "@/lib/assemble/attendance";
import { termFor, todayKey } from "@/lib/assemble/dates";
import { StudentsView } from "./StudentsView";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const viewer = await requireStaffViewer();
  const sp = await searchParams;
  const classRows = db
    .select({ id: classes.id, name: classes.name, yearLevel: classes.yearLevel, room: classes.room, teacher: users.name })
    .from(classes)
    .leftJoin(users, eq(users.id, classes.teacherId))
    .where(eq(classes.schoolId, viewer.schoolId))
    .orderBy(asc(classes.yearLevel), asc(classes.name))
    .all();
  const mine = classesTaughtBy(viewer.id);
  const classId = sp.class === "all" ? null : (classRows.find((c) => c.id === sp.class)?.id ?? mine[0]?.id ?? null);

  const list = db
    .select({
      id: students.id,
      first: students.firstName,
      preferred: students.preferredName,
      last: students.lastName,
      yearLevel: students.yearLevel,
      classId: students.classId,
      className: classes.name,
      house: houses.name,
      houseColor: houses.color,
      medical: students.medicalNotes,
    })
    .from(students)
    .leftJoin(classes, eq(classes.id, students.classId))
    .leftJoin(houses, eq(houses.id, students.houseId))
    .where(and(eq(students.schoolId, viewer.schoolId), eq(students.active, true), classId ? eq(students.classId, classId) : undefined))
    .orderBy(asc(students.lastName), asc(students.firstName))
    .all();
  const term = termFor(todayKey(viewer.school.timezone));
  const stats = attendanceStats(list.map((s) => s.id), term.start, term.end);
  const current = classRows.find((c) => c.id === classId);

  return (
    <StudentsView
      classes={classRows.map((c) => ({ id: c.id, name: c.name }))}
      classId={classId}
      classInfo={current ? { name: current.name, teacher: current.teacher, room: current.room } : null}
      termLabel={term.label}
      students={list.map((s) => ({
        id: s.id,
        name: `${s.preferred ?? s.first} ${s.last}`,
        className: s.className,
        house: s.house,
        houseColor: s.houseColor,
        medical: s.medical,
        rate: stats.get(s.id)?.rate ?? null,
      }))}
    />
  );
}
