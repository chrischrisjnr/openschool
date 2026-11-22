import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  absenceNotes,
  attendance,
  classes,
  students,
  users,
  type AbsenceReason,
  type AttendanceStatus,
} from "@/db/schema";

export type AttendanceStats = {
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
  /** Share of recorded days the student was at school (present or late), 0–100. */
  rate: number | null;
};

const emptyStats = (): AttendanceStats => ({ present: 0, late: 0, absent: 0, excused: 0, total: 0, rate: null });

export function attendanceStats(studentIds: string[], from: string, to: string): Map<string, AttendanceStats> {
  const out = new Map(studentIds.map((id) => [id, emptyStats()]));
  if (!studentIds.length) return out;
  const rows = db
    .select({ studentId: attendance.studentId, status: attendance.status, n: sql<number>`count(*)` })
    .from(attendance)
    .where(and(inArray(attendance.studentId, studentIds), gte(attendance.date, from), lte(attendance.date, to)))
    .groupBy(attendance.studentId, attendance.status)
    .all();
  for (const r of rows) {
    const s = out.get(r.studentId) ?? emptyStats();
    s[r.status] += r.n;
    s.total += r.n;
    out.set(r.studentId, s);
  }
  for (const s of out.values()) s.rate = s.total ? Math.round(((s.present + s.late) / s.total) * 1000) / 10 : null;
  return out;
}

export function statusOn(studentIds: string[], date: string): Map<string, AttendanceStatus> {
  if (!studentIds.length) return new Map();
  return new Map(
    db
      .select({ studentId: attendance.studentId, status: attendance.status })
      .from(attendance)
      .where(and(inArray(attendance.studentId, studentIds), eq(attendance.date, date)))
      .all()
      .map((r) => [r.studentId, r.status]),
  );
}

export type NoteRow = {
  id: string;
  studentId: string;
  studentName: string;
  className: string | null;
  fromDate: string;
  toDate: string;
  reason: AbsenceReason;
  note: string | null;
  status: "submitted" | "approved";
  submittedByName: string;
  createdAt: Date;
};

function noteQuery() {
  return db
    .select({
      id: absenceNotes.id,
      studentId: absenceNotes.studentId,
      first: students.firstName,
      preferred: students.preferredName,
      last: students.lastName,
      className: classes.name,
      classId: students.classId,
      fromDate: absenceNotes.fromDate,
      toDate: absenceNotes.toDate,
      reason: absenceNotes.reason,
      note: absenceNotes.note,
      status: absenceNotes.status,
      submittedByName: users.name,
      createdAt: absenceNotes.createdAt,
    })
    .from(absenceNotes)
    .innerJoin(students, eq(students.id, absenceNotes.studentId))
    .leftJoin(classes, eq(classes.id, students.classId))
    .innerJoin(users, eq(users.id, absenceNotes.submittedBy));
}

const toNoteRow = (r: Awaited<ReturnType<ReturnType<typeof noteQuery>["all"]>>[number]): NoteRow => ({
  id: r.id,
  studentId: r.studentId,
  studentName: `${r.preferred ?? r.first} ${r.last}`,
  className: r.className,
  fromDate: r.fromDate,
  toDate: r.toDate,
  reason: r.reason,
  note: r.note,
  status: r.status,
  submittedByName: r.submittedByName,
  createdAt: r.createdAt,
});

/** Absence notes for these students, newest first. */
export function notesForStudents(studentIds: string[], limit = 50): NoteRow[] {
  if (!studentIds.length) return [];
  return noteQuery()
    .where(inArray(absenceNotes.studentId, studentIds))
    .orderBy(desc(absenceNotes.fromDate), desc(absenceNotes.createdAt))
    .limit(limit)
    .all()
    .map(toNoteRow);
}

/** Notes awaiting review in a school, optionally limited to some classes. */
export function notesAwaitingReview(schoolId: string, classIds?: string[]): NoteRow[] {
  if (classIds && !classIds.length) return [];
  return noteQuery()
    .where(
      and(
        eq(students.schoolId, schoolId),
        eq(absenceNotes.status, "submitted"),
        classIds ? inArray(students.classId, classIds) : undefined,
      ),
    )
    .orderBy(asc(absenceNotes.fromDate))
    .all()
    .map(toNoteRow);
}

/** Notes covering a given day for these students: studentId → reason. */
export function notesCovering(studentIds: string[], date: string): Map<string, { reason: AbsenceReason; status: string }> {
  if (!studentIds.length) return new Map();
  return new Map(
    db
      .select({ studentId: absenceNotes.studentId, reason: absenceNotes.reason, status: absenceNotes.status })
      .from(absenceNotes)
      .where(
        and(inArray(absenceNotes.studentId, studentIds), lte(absenceNotes.fromDate, date), gte(absenceNotes.toDate, date)),
      )
      .all()
      .map((r) => [r.studentId, { reason: r.reason, status: r.status }]),
  );
}

export type UnexplainedAbsence = {
  attendanceId: string;
  studentId: string;
  studentName: string;
  className: string | null;
  date: string;
};

/** Absences with no absence note covering the day. */
export function unexplainedAbsences(
  scope: { schoolId: string; studentIds?: string[]; classIds?: string[] },
  from: string,
  to: string,
): UnexplainedAbsence[] {
  if (scope.studentIds && !scope.studentIds.length) return [];
  if (scope.classIds && !scope.classIds.length) return [];
  const covered = sql`exists (select 1 from ${absenceNotes} n where n.student_id = ${attendance.studentId} and n.from_date <= ${attendance.date} and n.to_date >= ${attendance.date})`;
  return db
    .select({
      attendanceId: attendance.id,
      studentId: students.id,
      first: students.firstName,
      preferred: students.preferredName,
      last: students.lastName,
      className: classes.name,
      date: attendance.date,
    })
    .from(attendance)
    .innerJoin(students, eq(students.id, attendance.studentId))
    .leftJoin(classes, eq(classes.id, students.classId))
    .where(
      and(
        eq(students.schoolId, scope.schoolId),
        eq(attendance.status, "absent"),
        gte(attendance.date, from),
        lte(attendance.date, to),
        scope.studentIds ? inArray(students.id, scope.studentIds) : undefined,
        scope.classIds ? inArray(students.classId, scope.classIds) : undefined,
        sql`not ${covered}`,
      ),
    )
    .orderBy(desc(attendance.date), asc(classes.name), asc(students.lastName))
    .all()
    .map((r) => ({
      attendanceId: r.attendanceId,
      studentId: r.studentId,
      studentName: `${r.preferred ?? r.first} ${r.last}`,
      className: r.className,
      date: r.date,
    }));
}

export type RollStudent = {
  id: string;
  name: string;
  status: AttendanceStatus | null;
  note: string | null;
  medical: boolean;
  /** Reason from an absence note covering this day, if any. */
  noteReason: AbsenceReason | null;
};

export function rollFor(classId: string, date: string): RollStudent[] {
  const list = db
    .select({
      id: students.id,
      first: students.firstName,
      preferred: students.preferredName,
      last: students.lastName,
      medicalNotes: students.medicalNotes,
    })
    .from(students)
    .where(and(eq(students.classId, classId), eq(students.active, true)))
    .orderBy(asc(students.lastName), asc(students.firstName))
    .all();
  const ids = list.map((s) => s.id);
  const marks = new Map(
    ids.length
      ? db
          .select({ studentId: attendance.studentId, status: attendance.status, note: attendance.note })
          .from(attendance)
          .where(and(inArray(attendance.studentId, ids), eq(attendance.date, date)))
          .all()
          .map((r) => [r.studentId, r])
      : [],
  );
  const notes = notesCovering(ids, date);
  return list.map((s) => ({
    id: s.id,
    name: `${s.preferred ?? s.first} ${s.last}`,
    status: marks.get(s.id)?.status ?? null,
    note: marks.get(s.id)?.note ?? null,
    medical: !!s.medicalNotes,
    noteReason: notes.get(s.id)?.reason ?? null,
  }));
}

/** How many students in each class have been marked on a day. */
export function rollProgress(classIds: string[], date: string) {
  if (!classIds.length) return new Map<string, { marked: number; total: number; absent: number }>();
  const rows = db
    .select({
      classId: students.classId,
      total: sql<number>`count(${students.id})`,
      marked: sql<number>`count(${attendance.id})`,
      absent: sql<number>`coalesce(sum(case when ${attendance.status} in ('absent', 'excused') then 1 else 0 end), 0)`,
    })
    .from(students)
    .leftJoin(attendance, and(eq(attendance.studentId, students.id), eq(attendance.date, date)))
    .where(and(inArray(students.classId, classIds), eq(students.active, true)))
    .groupBy(students.classId)
    .all();
  return new Map(rows.map((r) => [r.classId!, { marked: r.marked, total: r.total, absent: r.absent }]));
}

/** Recent attendance records for one student, newest first. */
export function recentAttendance(studentId: string, limit = 30) {
  return db
    .select({ date: attendance.date, status: attendance.status, note: attendance.note })
    .from(attendance)
    .where(eq(attendance.studentId, studentId))
    .orderBy(desc(attendance.date))
    .limit(limit)
    .all();
}
