import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isDayKey, todayKey } from "@/lib/assemble/dates";
import { getViewer } from "@/lib/viewer";
import { ReportAbsenceForm } from "./ReportAbsenceForm";

export const metadata: Metadata = { title: "Report an absence" };

export default async function ReportAbsencePage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; date?: string }>;
}) {
  const viewer = await getViewer();
  if (viewer.role !== "parent" || !viewer.students.length) redirect("/assemble/attendance");
  const sp = await searchParams;
  const today = todayKey(viewer.school.timezone);
  const student = viewer.students.find((s) => s.id === sp.student)?.id ?? viewer.students[0]!.id;
  return (
    <ReportAbsenceForm
      kids={viewer.students.map((s) => ({ id: s.id, name: s.displayName, className: s.className }))}
      studentId={student}
      date={isDayKey(sp.date) ? sp.date : today}
    />
  );
}
