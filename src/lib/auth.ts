import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { schools, sessions, users, type Role, type School, type User } from "@/db/schema";

const COOKIE = "os_session";
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.insert(sessions).values({ id: hashToken(token), userId, expiresAt }).run();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db.delete(sessions).where(eq(sessions.id, hashToken(token))).run();
  jar.delete(COOKIE);
}

export type SessionUser = Omit<User, "passwordHash"> & { school: School };

/** The signed-in user, or null. Cached for the duration of a request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = db
    .select({ user: users, school: schools })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(schools, eq(schools.id, users.schoolId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .get();
  if (!row || row.user.disabled) return null;
  const { passwordHash: _omit, ...user } = row.user;
  return { ...user, school: row.school };
});

/**
 * Use at the top of any protected page, layout or server action.
 * Redirects to the login page when signed out, and to the home page when
 * the user's role is not allowed.
 */
export async function requireUser(roles?: readonly Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/");
  return user;
}

export const STAFF_ROLES = ["admin", "staff"] as const satisfies readonly Role[];

export const isStaff = (user: Pick<User, "role">) =>
  user.role === "admin" || user.role === "staff";
