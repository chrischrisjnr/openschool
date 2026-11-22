import "server-only";
import { and, desc, eq, gt, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { noticeReads, notices, users, type AudienceType } from "@/db/schema";
import { studentIdsInAudience, userIdsInAudience } from "@/lib/audience";
import { formatRelative } from "@/lib/format";
import { audienceWhere, canSeeAudience, type Viewer } from "@/lib/viewer";
import { householdsForStudents } from "./access";
import { audienceLabeler } from "./audience";

export type NoticeListItem = {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  audience: string;
  audienceType: AudienceType;
  audienceId: string | null;
  pinned: boolean;
  requiresAck: boolean;
  publishedAt: Date;
  /** "2 days ago" — computed on the server so it matches after hydration. */
  when: string;
  expiresAt: Date | null;
  expired: boolean;
  authorName: string;
  read: boolean;
  acknowledged: boolean;
  /** This viewer is one of the people asked to acknowledge it. */
  ackMine: boolean;
};

function visibleNotices(viewer: Viewer, now = new Date()): SQL {
  const conds: (SQL | undefined)[] = [
    eq(notices.schoolId, viewer.schoolId),
    audienceWhere(viewer, notices.audienceType, notices.audienceId),
  ];
  if (!viewer.isStaff) conds.push(or(isNull(notices.expiresAt), gt(notices.expiresAt, now)));
  return and(...conds)!;
}

const excerptOf = (body: string, max = 180) => {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

export function listNotices(viewer: Viewer, opts: { category?: string; limit?: number } = {}): NoticeListItem[] {
  const now = new Date();
  const label = audienceLabeler(viewer.schoolId, viewer.school.state);
  const rows = db
    .select({
      notice: notices,
      authorName: users.name,
      readAt: noticeReads.readAt,
      acknowledgedAt: noticeReads.acknowledgedAt,
    })
    .from(notices)
    .innerJoin(users, eq(users.id, notices.authorId))
    .leftJoin(noticeReads, and(eq(noticeReads.noticeId, notices.id), eq(noticeReads.userId, viewer.id)))
    .where(and(visibleNotices(viewer, now), opts.category ? eq(notices.category, opts.category) : undefined))
    .orderBy(desc(notices.pinned), desc(notices.publishedAt))
    .limit(opts.limit ?? 100)
    .all();
  return rows.map(({ notice: n, authorName, readAt, acknowledgedAt }) => ({
    id: n.id,
    title: n.title,
    excerpt: excerptOf(n.body),
    category: n.category,
    audience: label(n.audienceType, n.audienceId),
    audienceType: n.audienceType,
    audienceId: n.audienceId,
    pinned: n.pinned,
    requiresAck: n.requiresAck,
    publishedAt: n.publishedAt,
    when: formatRelative(n.publishedAt, now, viewer.school.timezone),
    expiresAt: n.expiresAt,
    expired: !!n.expiresAt && n.expiresAt <= now,
    authorName,
    read: !!readAt,
    acknowledged: !!acknowledgedAt,
    ackMine: n.requiresAck && (viewer.role === "parent" || (viewer.isStaff && n.audienceType === "staff")),
  }));
}

/** A single notice, if the viewer may see it. */
export function getNotice(viewer: Viewer, id: string) {
  const row = db
    .select({ notice: notices, authorName: users.name, authorTitle: users.title })
    .from(notices)
    .innerJoin(users, eq(users.id, notices.authorId))
    .where(and(eq(notices.id, id), eq(notices.schoolId, viewer.schoolId)))
    .get();
  if (!row) return null;
  const n = row.notice;
  if (!canSeeAudience(viewer, n.audienceType, n.audienceId)) return null;
  if (!viewer.isStaff && n.expiresAt && n.expiresAt <= new Date()) return null;
  return { ...row, audience: audienceLabeler(viewer.schoolId, viewer.school.state)(n.audienceType, n.audienceId) };
}

/** Records that the viewer opened a notice (first read only). */
export function recordRead(noticeId: string, userId: string) {
  db.insert(noticeReads).values({ noticeId, userId, readAt: new Date() }).onConflictDoNothing().run();
}

export function readStateFor(noticeId: string, userId: string) {
  return db
    .select()
    .from(noticeReads)
    .where(and(eq(noticeReads.noticeId, noticeId), eq(noticeReads.userId, userId)))
    .get();
}

/** Unread, current notices for the nav badge. */
export function unreadNoticeCount(viewer: Viewer): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(notices)
    .leftJoin(noticeReads, and(eq(noticeReads.noticeId, notices.id), eq(noticeReads.userId, viewer.id)))
    .where(and(visibleNotices(viewer), isNull(noticeReads.userId)))
    .get();
  return row?.n ?? 0;
}

export type NoticeReach = {
  /** "families" for community notices, "staff" for staff-only notices. */
  unit: "families" | "staff";
  total: number;
  read: number;
  acknowledged: number;
  /** Who hasn't acknowledged (or read, when no acknowledgement is needed). */
  outstanding: { key: string; name: string; detail: string }[];
};

/**
 * Read receipts for staff. Community notices are counted per family (either
 * parent opening it counts); staff-only notices per staff member.
 */
export function noticeReach(
  schoolId: string,
  notice: { id: string; audienceType: AudienceType; audienceId: string | null; requiresAck: boolean },
  withOutstanding = true,
): NoticeReach {
  const reads = db
    .select({ userId: noticeReads.userId, ack: noticeReads.acknowledgedAt })
    .from(noticeReads)
    .where(eq(noticeReads.noticeId, notice.id))
    .all();
  const readers = new Set(reads.map((r) => r.userId));
  const ackers = new Set(reads.filter((r) => r.ack).map((r) => r.userId));

  if (notice.audienceType === "staff") {
    const ids = userIdsInAudience(schoolId, "staff", null);
    const staff = withOutstanding && ids.length
      ? db.select({ id: users.id, name: users.name, title: users.title }).from(users).where(inArray(users.id, ids)).all()
      : [];
    const done = notice.requiresAck ? ackers : readers;
    return {
      unit: "staff",
      total: ids.length,
      read: ids.filter((id) => readers.has(id)).length,
      acknowledged: ids.filter((id) => ackers.has(id)).length,
      outstanding: staff
        .filter((s) => !done.has(s.id))
        .map((s) => ({ key: s.id, name: s.name, detail: s.title ?? "Staff" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  const households = householdsForStudents(studentIdsInAudience(schoolId, notice.audienceType, notice.audienceId));
  const hasAny = (h: { userIds: string[] }, set: Set<string>) => h.userIds.some((id) => set.has(id));
  const done = notice.requiresAck ? ackers : readers;
  return {
    unit: "families",
    total: households.length,
    read: households.filter((h) => hasAny(h, readers)).length,
    acknowledged: households.filter((h) => hasAny(h, ackers)).length,
    outstanding: withOutstanding
      ? households.filter((h) => !hasAny(h, done)).map((h) => ({ key: h.key, name: h.parentNames, detail: h.children }))
      : [],
  };
}
