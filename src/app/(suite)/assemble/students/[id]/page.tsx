import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { classes, guardians, houses, paymentItems, studentCharges, students, users } from "@/db/schema";
import { requireStaffViewer } from "@/lib/assemble/access";
import { attendanceStats, notesForStudents, recentAttendance } from "@/lib/assemble/attendance";
import { toFamilyCharge } from "@/lib/assemble/charges";
import { ABSENCE_REASONS } from "@/lib/assemble/constants";
import { formatKey, formatKeyRange, formatKeyShort, termFor, todayKey } from "@/lib/assemble/dates";
import { formatMoney, formatShortDate, yearLabel } from "@/lib/format";
import { StudentProfileView } from "./StudentProfileView";

export const metadata: Metadata = { title: "Student" };

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireStaffViewer();
  const tz = viewer.school.timezone;
  const row = db
    .select({ s: students, className: classes.name, classId: classes.id, house: houses.name, teacher: users.name })
    .from(students)
    .leftJoin(classes, eq(classes.id, students.classId))
    .leftJoin(houses, eq(houses.id, students.houseId))
    .leftJoin(users, eq(users.id, classes.teacherId))
    .where(and(eq(students.id, id), eq(students.schoolId, viewer.schoolId)))
    .get();
  if (!row) notFound();
  const s = row.s;
  const term = termFor(todayKey(tz));
  const stats = attendanceStats([s.id], term.start, term.end).get(s.id)!;
  const family = db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, relationship: guardians.relationship, primary: guardians.isPrimary })
    .from(guardians)
    .innerJoin(users, eq(users.id, guardians.userId))
    .where(eq(guardians.studentId, s.id))
    .all()
    .sort((a, b) => Number(b.primary) - Number(a.primary));
  const charges = db
    .select({ charge: studentCharges, item: paymentItems })
    .from(studentCharges)
    .innerJoin(paymentItems, eq(paymentItems.id, studentCharges.itemId))
    .where(eq(studentCharges.studentId, s.id))
    .all()
    .map(toFamilyCharge);

  return (
    <StudentProfileView
      student={{
        name: `${s.preferredName ?? s.firstName} ${s.lastName}`,
        legalName: s.preferredName ? `${s.firstName} ${s.lastName}` : null,
        year: yearLabel(s.yearLevel, viewer.school.state),
        className: row.className,
        classId: row.classId,
        teacher: row.teacher,
        house: row.house,
        dob: s.dateOfBirth ? formatKey(s.dateOfBirth, tz) : null,
        medical: s.medicalNotes,
      }}
      family={family}
      stats={stats}
      termLabel={term.label}
      recent={recentAttendance(s.id, 15).map((r) => ({ ...r, label: formatKeyShort(r.date, tz) }))}
      notes={notesForStudents([s.id], 10).map((n) => ({
        id: n.id,
        when: formatKeyRange(n.fromDate, n.toDate, tz),
        reason: ABSENCE_REASONS[n.reason],
        note: n.note,
        status: n.status,
      }))}
      charges={charges.map((c) => ({
        id: c.id,
        itemId: c.itemId,
        title: c.title,
        amount: c.amountCents ? formatMoney(c.amountCents) : "Consent only",
        status: c.status,
        consent: c.requiresConsent ? c.consent : null,
        needsAction: c.needsAction,
        due: c.dueAt ? formatShortDate(c.dueAt, tz) : null,
      }))}
    />
  );
}
