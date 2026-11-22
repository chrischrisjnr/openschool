import type { Metadata } from "next";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classes, users } from "@/db/schema";
import { classesTaughtBy, isParent } from "@/lib/assemble/access";
import {
  attendanceStats,
  notesAwaitingReview,
  notesCovering,
  rollProgress,
  statusOn,
  unexplainedAbsences,
} from "@/lib/assemble/attendance";
import { eventsBetween, upcomingEvents } from "@/lib/assemble/calendar";
import { familyCharges, schoolMoneyTotals } from "@/lib/assemble/charges";
import { ABSENCE_REASONS } from "@/lib/assemble/constants";
import { addDays, formatKeyLong, formatKeyShort, isWeekend, lastWeekday, nextWeekday, termFor, todayKey } from "@/lib/assemble/dates";
import { listNotices, noticeReach } from "@/lib/assemble/notices";
import { formatMoney, formatShortDate, yearLabel } from "@/lib/format";
import { getViewer } from "@/lib/viewer";
import { StaffToday, FamilyToday, type ActionItem, type ChildCard } from "./TodayView";

export const metadata: Metadata = { title: "Today" };

export default async function AssembleToday() {
  const viewer = await getViewer();
  const tz = viewer.school.timezone;
  const today = todayKey(tz);
  const holiday = eventsBetween(viewer, today, today).find((e) => e.category === "holiday" || e.title.toLowerCase().includes("student free"));
  const schoolDay = !isWeekend(today) && !holiday;
  const noSchoolReason = isWeekend(today) ? "No school today — enjoy the weekend" : holiday ? holiday.title : null;
  const week = upcomingEvents(viewer, 7);
  const term = termFor(today);
  const firstName = viewer.name.replace(/^(Mr|Mrs|Ms|Miss|Dr|Coach)\s+/, "").split(" ")[0] ?? viewer.name;

  if (viewer.isStaff) {
    const mine = classesTaughtBy(viewer.id);
    const rollDay = schoolDay ? today : lastWeekday(addDays(today, -1));
    const allClasses = viewer.isAdmin && !mine.length
      ? db.select().from(classes).where(eq(classes.schoolId, viewer.schoolId)).all()
      : mine;
    const progress = rollProgress(allClasses.map((c) => c.id), rollDay);
    const notes = notesAwaitingReview(viewer.schoolId, viewer.isAdmin ? undefined : mine.map((c) => c.id));
    const unexplained = unexplainedAbsences(
      { schoolId: viewer.schoolId, classIds: viewer.isAdmin ? undefined : mine.map((c) => c.id) },
      term.start,
      today,
    );
    const recent = listNotices(viewer, { limit: 30 })
      .filter((n) => !n.expired)
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .slice(0, 4);
    const money = viewer.isAdmin ? schoolMoneyTotals(viewer.schoolId) : null;

    return (
      <StaffToday
        firstName={firstName}
        dateLabel={formatKeyLong(today, tz)}
        noSchoolReason={noSchoolReason}
        rollDayLabel={rollDay === today ? "Today" : formatKeyShort(rollDay, tz)}
        rollDay={rollDay}
        nextSchoolDayLabel={schoolDay ? null : formatKeyShort(nextWeekday(addDays(today, 1)), tz)}
        ownClasses={mine.length > 0}
        rolls={allClasses
          .sort((a, b) => a.yearLevel - b.yearLevel || a.name.localeCompare(b.name))
          .map((c) => ({ classId: c.id, name: c.name, ...(progress.get(c.id) ?? { marked: 0, total: 0, absent: 0 }) }))}
        notes={notes.slice(0, 5).map((n) => ({
          id: n.id,
          student: n.studentName,
          className: n.className,
          when: n.fromDate === n.toDate ? formatKeyShort(n.fromDate, tz) : `${formatKeyShort(n.fromDate, tz)} – ${formatKeyShort(n.toDate, tz)}`,
          reason: ABSENCE_REASONS[n.reason],
          note: n.note,
        }))}
        notesTotal={notes.length}
        unexplainedCount={unexplained.length}
        notices={recent.map((n) => {
          const reach = noticeReach(viewer.schoolId, n, false);
          return {
            id: n.id,
            title: n.title,
            audience: n.audience,
            published: formatShortDate(n.publishedAt, tz),
            requiresAck: n.requiresAck,
            unit: reach.unit,
            total: reach.total,
            done: n.requiresAck ? reach.acknowledged : reach.read,
          };
        })}
        money={money ? { outstanding: formatMoney(money.outstandingCents), collected: formatMoney(money.collectedCents), studentsOwing: money.studentsOwing } : null}
        events={week}
        today={today}
        tz={tz}
      />
    );
  }

  // Families (and students)
  const ids = viewer.students.map((s) => s.id);
  const status = statusOn(ids, today);
  const covering = notesCovering(ids, today);
  const stats = attendanceStats(ids, term.start, term.end);
  const teacherRows = viewer.students.some((s) => s.classId)
    ? db
        .select({ classId: classes.id, teacher: users.name })
        .from(classes)
        .leftJoin(users, eq(users.id, classes.teacherId))
        .where(inArray(classes.id, viewer.students.flatMap((s) => (s.classId ? [s.classId] : []))))
        .all()
    : [];
  const teachers = new Map(teacherRows.map((r) => [r.classId, r.teacher]));

  const children: ChildCard[] = viewer.students.map((s) => {
    const st = status.get(s.id);
    const note = covering.get(s.id);
    let today: ChildCard["today"];
    if (st) today = { kind: "status", status: st };
    else if (!schoolDay) today = { kind: "text", text: isWeekend(todayKey(tz)) ? "No school today" : (holiday?.title ?? "No school today") };
    else if (note) today = { kind: "text", text: `Absence reported — ${ABSENCE_REASONS[note.reason].toLowerCase()}` };
    else today = { kind: "text", text: "Roll not marked yet" };
    const sStats = stats.get(s.id);
    return {
      id: s.id,
      name: s.displayName,
      detail: [yearLabel(s.yearLevel, viewer.school.state), s.className && `Class ${s.className}`].filter(Boolean).join(" · "),
      teacher: (s.classId && teachers.get(s.classId)) || null,
      house: s.houseName,
      houseColor: s.houseColor,
      today,
      rate: sStats?.rate ?? null,
      absences: (sStats?.absent ?? 0) + (sStats?.excused ?? 0),
    };
  });

  const actions: ActionItem[] = [];
  const parent = isParent(viewer);
  const names = new Map(viewer.students.map((s) => [s.id, s.preferredName ?? s.firstName]));
  for (const c of familyCharges(viewer).filter((c) => c.needsAction)) {
    const child = names.get(c.studentId) ?? "";
    const due = c.dueAt ? `due ${formatShortDate(c.dueAt, tz)}` : null;
    const overdue = !!c.dueAt && c.dueAt < new Date();
    if (c.requiresConsent && c.consent === "pending") {
      actions.push({
        key: `consent-${c.id}`,
        icon: "shield",
        title: `Give permission: ${c.title}`,
        detail: [child, c.amountCents ? formatMoney(c.amountCents) : "Consent only", due].filter(Boolean).join(" · "),
        href: `/assemble/payments/${c.itemId}`,
        tone: overdue ? "danger" : "attention",
      });
    } else {
      actions.push({
        key: `pay-${c.id}`,
        icon: "card",
        title: `Pay: ${c.title}`,
        detail: [child, formatMoney(c.amountCents), due].filter(Boolean).join(" · "),
        href: "/assemble/payments",
        tone: overdue ? "danger" : "attention",
      });
    }
  }
  const notices = listNotices(viewer, { limit: 30 });
  for (const n of notices.filter((n) => n.ackMine && !n.acknowledged)) {
    actions.push({ key: `ack-${n.id}`, icon: "megaphone", title: `Read and acknowledge: ${n.title}`, detail: n.audience, href: `/assemble/notices/${n.id}`, tone: "accent" });
  }
  if (parent) {
    for (const a of unexplainedAbsences({ schoolId: viewer.schoolId, studentIds: ids }, term.start, today)) {
      actions.push({
        key: `absence-${a.attendanceId}`,
        icon: "checklist",
        title: `Explain ${names.get(a.studentId) ?? a.studentName}'s absence`,
        detail: `Absent ${formatKeyShort(a.date, tz)} — no note received yet`,
        href: `/assemble/attendance/report?student=${a.studentId}&date=${a.date}`,
        tone: "danger",
      });
    }
  }

  return (
    <FamilyToday
      firstName={firstName}
      dateLabel={formatKeyLong(today, tz)}
      noSchoolReason={noSchoolReason}
      termLabel={term.label}
      kids={children}
      actions={parent ? actions : actions.filter((a) => a.key.startsWith("ack-"))}
      canAct={parent}
      events={week}
      notices={[...notices].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, 4)}
      today={today}
      tz={tz}
    />
  );
}
