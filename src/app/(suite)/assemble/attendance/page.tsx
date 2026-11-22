import type { Metadata } from "next";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attendance, classes } from "@/db/schema";
import { classesTaughtBy } from "@/lib/assemble/access";
import {
  attendanceStats,
  notesAwaitingReview,
  notesForStudents,
  rollFor,
  unexplainedAbsences,
} from "@/lib/assemble/attendance";
import { ABSENCE_REASONS } from "@/lib/assemble/constants";
import { addDays, formatKeyLong, formatKeyRange, formatKeyShort, isDayKey, isWeekend, lastWeekday, termFor, todayKey } from "@/lib/assemble/dates";
import { getViewer } from "@/lib/viewer";
import { FamilyAttendance, StaffAttendance } from "./AttendanceView";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string; reported?: string }>;
}) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const tz = viewer.school.timezone;
  const today = todayKey(tz);
  const term = termFor(today);

  if (viewer.isStaff) {
    const all = db
      .select({ id: classes.id, name: classes.name, yearLevel: classes.yearLevel, teacherId: classes.teacherId })
      .from(classes)
      .where(eq(classes.schoolId, viewer.schoolId))
      .orderBy(asc(classes.yearLevel), asc(classes.name))
      .all();
    const mine = classesTaughtBy(viewer.id);
    const classId = all.find((c) => c.id === sp.class)?.id ?? mine[0]?.id ?? all[0]?.id ?? "";
    const date = isDayKey(sp.date) && sp.date <= today ? sp.date : lastWeekday(today);
    const scope = viewer.isAdmin ? undefined : mine.map((c) => c.id);
    const notes = notesAwaitingReview(viewer.schoolId, scope);
    const unexplained = unexplainedAbsences({ schoolId: viewer.schoolId, classIds: scope }, term.start, today);
    return (
      <StaffAttendance
        classes={all.map((c) => ({ id: c.id, name: c.name, mine: c.teacherId === viewer.id }))}
        classId={classId}
        date={date}
        dateLabel={formatKeyLong(date, tz)}
        today={today}
        weekend={isWeekend(date)}
        roll={classId ? rollFor(classId, date) : []}
        notes={notes.map((n) => ({
          id: n.id,
          student: n.studentName,
          className: n.className,
          when: formatKeyRange(n.fromDate, n.toDate, tz),
          reason: ABSENCE_REASONS[n.reason],
          note: n.note,
          by: n.submittedByName,
        }))}
        unexplained={unexplained.map((u) => ({ ...u, dateLabel: formatKeyShort(u.date, tz) }))}
        scopeLabel={viewer.isAdmin ? "across the school" : mine.length ? `in ${mine.map((c) => c.name).join(", ")}` : ""}
        termLabel={term.label}
      />
    );
  }

  const ids = viewer.students.map((s) => s.id);
  const stats = attendanceStats(ids, term.start, term.end);
  const from = addDays(today, -27);
  const recent = ids.length
    ? db
        .select({ studentId: attendance.studentId, date: attendance.date, status: attendance.status })
        .from(attendance)
        .where(and(inArray(attendance.studentId, ids), gte(attendance.date, from)))
        .all()
    : [];
  const unexplained = unexplainedAbsences({ schoolId: viewer.schoolId, studentIds: ids }, term.start, today);
  const days: string[] = [];
  for (let k = from; k <= today; k = addDays(k, 1)) if (!isWeekend(k)) days.push(k);

  return (
    <FamilyAttendance
      canAct={viewer.role === "parent"}
      reported={sp.reported === "1"}
      termLabel={term.label}
      days={days.map((d) => ({ key: d, label: formatKeyShort(d, tz) }))}
      kids={viewer.students.map((s) => ({
        id: s.id,
        name: s.displayName,
        short: s.preferredName ?? s.firstName,
        className: s.className,
        stats: stats.get(s.id)!,
        marks: Object.fromEntries(recent.filter((r) => r.studentId === s.id).map((r) => [r.date, r.status])),
      }))}
      unexplained={unexplained.map((u) => ({ ...u, dateLabel: formatKeyLong(u.date, tz) }))}
      notes={notesForStudents(ids, 20).map((n) => ({
        id: n.id,
        student: n.studentName,
        when: formatKeyRange(n.fromDate, n.toDate, tz),
        reason: ABSENCE_REASONS[n.reason],
        note: n.note,
        status: n.status,
        by: n.submittedByName,
      }))}
    />
  );
}
