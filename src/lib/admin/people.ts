import "server-only";
import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { newId } from "@/db/ids";
import { classes, guardians, houses, students, users, type Role } from "@/db/schema";
import { hashPassword } from "@/lib/password";

const WORDS = [
  "wattle", "koala", "banksia", "possum", "kookaburra", "gumtree", "billabong", "wombat",
  "echidna", "galah", "lorikeet", "platypus", "waratah", "emu", "dingo", "magpie",
];

/** A temporary password that's easy to read out or write down, e.g. "koala-wattle-4821". */
export function temporaryPassword(): string {
  const w = () => WORDS[randomInt(WORDS.length)];
  return `${w()}-${w()}-${randomInt(1000, 10000)}`;
}

export type CreatedAccount = { name: string; email: string; password: string; role: Role };

/**
 * Finds a user by email in this school, or creates one with a temporary
 * password (returned so the admin can pass it on).
 */
export async function findOrCreateUser(
  schoolId: string,
  input: { name: string; email: string; role: Role; title?: string | null; phone?: string | null },
): Promise<{ id: string; created?: CreatedAccount; error?: string }> {
  const email = input.email.trim().toLowerCase();
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    if (existing.schoolId !== schoolId) return { id: "", error: `${email} belongs to another school` };
    return { id: existing.id };
  }
  const password = temporaryPassword();
  const id = newId();
  db.insert(users)
    .values({
      id,
      schoolId,
      email,
      name: input.name.trim(),
      role: input.role,
      title: input.title ?? null,
      phone: input.phone ?? null,
      passwordHash: await hashPassword(password),
    })
    .run();
  return { id, created: { name: input.name.trim(), email, password, role: input.role } };
}

/** "3B" → 3, "Foundation A" / "FA" / "Prep" / "K" → 0, "Year 10" → 10. */
export function yearFromClassName(name: string): number | null {
  const n = name.trim();
  const digits = n.match(/\d{1,2}/);
  if (digits) {
    const y = Number(digits[0]);
    return y >= 0 && y <= 12 ? y : null;
  }
  if (/^(f|p|k|r|t|prep|found|kind|recep|trans)/i.test(n)) return 0;
  return null;
}

export function findOrCreateClass(schoolId: string, name: string): { id: string; yearLevel: number } | null {
  const existing = db
    .select()
    .from(classes)
    .where(and(eq(classes.schoolId, schoolId), eq(classes.name, name)))
    .get();
  if (existing) return existing;
  const yearLevel = yearFromClassName(name);
  if (yearLevel === null) return null;
  const id = newId();
  db.insert(classes).values({ id, schoolId, name, yearLevel }).run();
  return { id, yearLevel };
}

export function findOrCreateHouse(schoolId: string, name: string): string {
  const existing = db
    .select()
    .from(houses)
    .where(and(eq(houses.schoolId, schoolId), eq(houses.name, name)))
    .get();
  if (existing) return existing.id;
  const id = newId();
  const palette = ["blue", "green", "red", "yellow", "purple", "orange"];
  const count = db.select().from(houses).where(eq(houses.schoolId, schoolId)).all().length;
  db.insert(houses).values({ id, schoolId, name, color: palette[count % palette.length]! }).run();
  return id;
}

export type GuardianInput = { name: string; email: string; relationship?: string };

export async function createStudentWithGuardians(
  schoolId: string,
  input: {
    firstName: string;
    lastName: string;
    className: string;
    houseName?: string;
    guardians: GuardianInput[];
  },
): Promise<{ studentId?: string; created: CreatedAccount[]; error?: string }> {
  const cls = findOrCreateClass(schoolId, input.className);
  if (!cls) return { created: [], error: `Couldn't work out the year level of class "${input.className}"` };
  const houseId = input.houseName ? findOrCreateHouse(schoolId, input.houseName) : null;
  const created: CreatedAccount[] = [];
  const guardianIds: { id: string; relationship: string }[] = [];
  for (const g of input.guardians) {
    const res = await findOrCreateUser(schoolId, { name: g.name, email: g.email, role: "parent" });
    if (res.error) return { created, error: res.error };
    if (res.created) created.push(res.created);
    guardianIds.push({ id: res.id, relationship: g.relationship || "Parent" });
  }
  const studentId = newId();
  db.transaction((tx) => {
    tx.insert(students)
      .values({
        id: studentId,
        schoolId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        classId: cls.id,
        houseId,
        yearLevel: cls.yearLevel,
      })
      .run();
    guardianIds.forEach((g, i) =>
      tx.insert(guardians)
        .values({ userId: g.id, studentId, relationship: g.relationship, isPrimary: i === 0 })
        .onConflictDoNothing()
        .run(),
    );
  });
  return { studentId, created };
}
