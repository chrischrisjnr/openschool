import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classes, students, users } from "@/db/schema";
import { Grid, Stat, VStack } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth";
import { SchoolForm } from "./SchoolForm";

export default async function AdminSchoolPage() {
  const me = await requireUser(["admin"]);
  const sid = me.schoolId;
  const n = (q: { n: number } | undefined) => q?.n ?? 0;
  const studentCount = n(db.select({ n: count() }).from(students).where(and(eq(students.schoolId, sid), eq(students.active, true))).get());
  const familyCount = n(db.select({ n: count() }).from(users).where(and(eq(users.schoolId, sid), eq(users.role, "parent"))).get());
  const staffCount = n(db.select({ n: count() }).from(users).where(and(eq(users.schoolId, sid), inArray(users.role, ["staff", "admin"]))).get());
  const classCount = n(db.select({ n: count() }).from(classes).where(eq(classes.schoolId, sid)).get());
  const s = me.school;

  return (
    <VStack gap={24}>
      <Grid min={180}>
        <Stat label="Students" value={studentCount} />
        <Stat label="Parent & carer accounts" value={familyCount} />
        <Stat label="Staff" value={staffCount} />
        <Stat label="Classes" value={classCount} />
      </Grid>
      <SchoolForm
        school={{
          name: s.name,
          shortName: s.shortName,
          suburb: s.suburb ?? "",
          state: s.state,
          phone: s.phone ?? "",
          email: s.email ?? "",
          abn: s.abn ?? "",
        }}
      />
    </VStack>
  );
}
