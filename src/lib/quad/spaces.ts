import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, guardians, quadMembers, quadMessages, quadSpaces, students, users } from "@/db/schema";
import type { Viewer } from "@/lib/viewer";
import { canPairMessage, getAllSpaceAccess, isStaffRole, type SpaceAccess } from "./access";
import { ensureSchoolSpaces } from "./defaults";
import { toMessageDTOs, toPerson } from "./messages";
import type { MessageDTO, PersonDTO, SpaceSummaryDTO } from "./types";

/** Messages older than this count as read for people who've never opened a space. */
const UNREAD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const spaceHref = (id: string) => `/quad/s/${id}`;

/** Unread top-level messages per space (not written by the viewer). */
export function unreadCounts(viewerId: string, spaceIds: string[]): Map<string, number> {
  if (!spaceIds.length) return new Map();
  const fallback = Date.now() - UNREAD_WINDOW_MS;
  const rows = db
    .select({ spaceId: quadMessages.spaceId, n: count() })
    .from(quadMessages)
    .leftJoin(quadMembers, and(eq(quadMembers.spaceId, quadMessages.spaceId), eq(quadMembers.userId, viewerId)))
    .where(
      and(
        inArray(quadMessages.spaceId, spaceIds),
        isNull(quadMessages.parentId),
        isNull(quadMessages.deletedAt),
        ne(quadMessages.authorId, viewerId),
        sql`${quadMessages.createdAt} > coalesce(${quadMembers.lastReadAt}, ${quadMembers.joinedAt}, ${fallback})`,
      ),
    )
    .groupBy(quadMessages.spaceId)
    .all();
  return new Map(rows.map((r) => [r.spaceId, r.n]));
}

type LastMessage = { at: number; body: string; authorId: string; authorName: string };

/**
 * The latest top-level message in each space. Uses SQLite's documented
 * "bare columns with max()" behaviour to pick the row holding the maximum.
 */
function lastMessages(spaceIds: string[]): Map<string, LastMessage> {
  if (!spaceIds.length) return new Map();
  const rows = db.all<{ spaceId: string; at: number; body: string; authorId: string; authorName: string }>(sql`
    select m.space_id as spaceId, max(m.created_at) as at, m.body as body,
           m.author_id as authorId, u.name as authorName
    from quad_messages m join users u on u.id = m.author_id
    where m.space_id in (${sql.join(
      spaceIds.map((i) => sql`${i}`),
      sql`, `,
    )})
      and m.parent_id is null and m.deleted_at is null
    group by m.space_id
  `);
  return new Map(rows.map((r) => [r.spaceId, { ...r, at: Number(r.at) }]));
}

function previewOf(last: LastMessage | undefined, viewerId: string): string | null {
  if (!last) return null;
  const who = last.authorId === viewerId ? "You" : last.authorName.split(" ")[0];
  const text = last.body.replace(/\s+/g, " ").trim();
  return `${who}: ${text.length > 90 ? `${text.slice(0, 89)}…` : text}`;
}

/** Other people in each direct-message space. */
function directPeople(spaceIds: string[], viewerId: string): Map<string, PersonDTO[]> {
  const out = new Map<string, PersonDTO[]>();
  if (!spaceIds.length) return out;
  for (const r of db
    .select({ spaceId: quadMembers.spaceId, id: users.id, name: users.name, role: users.role, title: users.title })
    .from(quadMembers)
    .innerJoin(users, eq(users.id, quadMembers.userId))
    .where(inArray(quadMembers.spaceId, spaceIds))
    .orderBy(asc(users.name))
    .all()) {
    if (r.id === viewerId) continue;
    out.set(r.spaceId, [...(out.get(r.spaceId) ?? []), toPerson(r)]);
  }
  return out;
}

export function directName(people: PersonDTO[]): string {
  if (!people.length) return "Just you";
  if (people.length <= 3) return people.map((p) => p.name).join(", ");
  return `${people.slice(0, 2).map((p) => p.name).join(", ")} and ${people.length - 2} others`;
}

const KIND_ORDER = { announcements: 0, school: 1, year: 2, class: 3, group: 4, direct: 5 } as const;

/** Sorts spaces: announcements, school, years, classes (Foundation first), groups. */
function spaceSorter(schoolId: string) {
  const order = new Map(
    db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.schoolId, schoolId))
      .orderBy(asc(classes.yearLevel), asc(classes.name))
      .all()
      .map((c, i) => [c.id, i]),
  );
  return (a: SpaceAccess, b: SpaceAccess): number => {
    const [x, y] = [a.space, b.space];
    if (x.kind !== y.kind) return KIND_ORDER[x.kind] - KIND_ORDER[y.kind];
    if (x.kind === "school") return (x.audienceType === "staff" ? 1 : 0) - (y.audienceType === "staff" ? 1 : 0);
    if (x.kind === "year") return Number(x.audienceId) - Number(y.audienceId);
    if (x.kind === "class") return (order.get(x.audienceId ?? "") ?? 0) - (order.get(y.audienceId ?? "") ?? 0);
    return x.name.localeCompare(y.name);
  };
}

function summarise(viewer: Viewer, list: SpaceAccess[]): SpaceSummaryDTO[] {
  const ids = list.map((a) => a.space.id);
  const unread = unreadCounts(viewer.id, ids);
  const last = lastMessages(ids);
  const people = directPeople(
    list.filter((a) => a.space.kind === "direct").map((a) => a.space.id),
    viewer.id,
  );
  return list.map(({ space }) => {
    const dm = space.kind === "direct" ? (people.get(space.id) ?? []) : undefined;
    return {
      id: space.id,
      name: dm ? directName(dm) : space.name,
      emoji: space.emoji,
      kind: space.kind,
      description: space.description,
      href: spaceHref(space.id),
      unread: unread.get(space.id) ?? 0,
      lastMessageAt: last.get(space.id)?.at ?? null,
      preview: previewOf(last.get(space.id), viewer.id),
      archived: space.archived,
      people: dm,
    };
  });
}

/**
 * Staff can open every class and year space, but their sidebar only lists
 * the school-wide spaces, their own classes and year levels, and any space
 * they've opened before (which gives them a membership row).
 */
function staffRelevance(viewer: Viewer): ((a: SpaceAccess) => boolean) | null {
  if (!viewer.isStaff) return null;
  const own = db
    .select({ id: classes.id, yearLevel: classes.yearLevel })
    .from(classes)
    .where(and(eq(classes.schoolId, viewer.schoolId), eq(classes.teacherId, viewer.id)))
    .all();
  const classIds = new Set(own.map((c) => c.id));
  const years = new Set(own.map((c) => String(c.yearLevel)));
  return ({ space, memberRole }) => {
    if (memberRole) return true;
    if (space.kind === "class") return classIds.has(space.audienceId ?? "");
    if (space.kind === "year") return years.has(space.audienceId ?? "");
    return true;
  };
}

/** Every class and year space (staff browse these from "Browse"). */
export function listAudienceSpaces(viewer: Viewer): SpaceSummaryDTO[] {
  const list = getAllSpaceAccess(viewer)
    .filter((a) => a.space.kind === "year" || a.space.kind === "class")
    .sort(spaceSorter(viewer.schoolId));
  return summarise(viewer, list);
}

/**
 * The viewer's spaces for the sidebar and Quad home: automatic spaces,
 * groups they've joined and their direct messages (newest first).
 */
export function listMySpaces(viewer: Viewer): SpaceSummaryDTO[] {
  ensureSchoolSpaces(db, viewer.schoolId);
  const relevant = staffRelevance(viewer);
  const mine = getAllSpaceAccess(viewer)
    .filter((a) => a.isMember && !(a.space.archived && a.space.kind !== "direct"))
    .filter((a) => !relevant || relevant(a))
    .sort(spaceSorter(viewer.schoolId));
  const summaries = summarise(viewer, mine);
  const spaces = summaries.filter((s) => s.kind !== "direct");
  const dms = summaries
    .filter((s) => s.kind === "direct" && s.lastMessageAt)
    .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  return [...spaces, ...dms];
}

export type GroupListing = SpaceSummaryDTO & {
  visibility: "open" | "private";
  memberCount: number;
  isMember: boolean;
  canJoin: boolean;
};

/** Groups the viewer can browse: every open group plus private ones they're in. */
export function listGroups(viewer: Viewer): GroupListing[] {
  const groups = getAllSpaceAccess(viewer)
    .filter((a) => a.space.kind === "group" && !a.space.archived && (a.space.visibility === "open" || a.isMember))
    .sort((a, b) => a.space.name.localeCompare(b.space.name));
  const ids = groups.map((g) => g.space.id);
  const counts = new Map(
    ids.length
      ? db
          .select({ spaceId: quadMembers.spaceId, n: count() })
          .from(quadMembers)
          .where(inArray(quadMembers.spaceId, ids))
          .groupBy(quadMembers.spaceId)
          .all()
          .map((r) => [r.spaceId, r.n])
      : [],
  );
  const summaries = summarise(viewer, groups);
  return summaries.map((s, i) => ({
    ...s,
    visibility: groups[i]!.space.visibility,
    memberCount: counts.get(s.id) ?? 0,
    isMember: groups[i]!.isMember,
    canJoin: groups[i]!.canJoin,
  }));
}

export type ActivityItem = { space: { id: string; name: string; emoji: string; href: string }; message: MessageDTO };

/** Latest messages across the viewer's (non-DM) spaces, for the Quad home. */
export function recentActivity(viewer: Viewer, limit = 8): ActivityItem[] {
  const spaces = getAllSpaceAccess(viewer).filter((a) => a.isMember && a.space.kind !== "direct");
  if (!spaces.length) return [];
  const byId = new Map(spaces.map((a) => [a.space.id, a.space]));
  const rows = db
    .select()
    .from(quadMessages)
    .where(and(inArray(quadMessages.spaceId, [...byId.keys()]), isNull(quadMessages.deletedAt), isNull(quadMessages.parentId)))
    .orderBy(desc(quadMessages.createdAt))
    .limit(limit)
    .all();
  return toMessageDTOs(rows).map((message) => {
    const s = byId.get(message.spaceId)!;
    return { space: { id: s.id, name: s.name, emoji: s.emoji, href: spaceHref(s.id) }, message };
  });
}

/* ------------------------------------------------------------------ */
/* People you can message                                              */
/* ------------------------------------------------------------------ */

export type Recipient = PersonDTO & { detail: string | null };

/** Children (and their classes) for a set of parent ids, e.g. "Parent of Mia (6A)". */
function parentDetails(parentIds: string[]): Map<string, string> {
  const out = new Map<string, string[]>();
  if (!parentIds.length) return new Map();
  for (const r of db
    .select({
      userId: guardians.userId,
      first: students.firstName,
      preferred: students.preferredName,
      className: classes.name,
    })
    .from(guardians)
    .innerJoin(students, eq(students.id, guardians.studentId))
    .leftJoin(classes, eq(classes.id, students.classId))
    .where(and(inArray(guardians.userId, parentIds), eq(students.active, true)))
    .orderBy(asc(students.yearLevel))
    .all()) {
    const label = `${r.preferred ?? r.first}${r.className ? ` (${r.className})` : ""}`;
    out.set(r.userId, [...(out.get(r.userId) ?? []), label]);
  }
  return new Map([...out].map(([id, kids]) => [id, `Parent of ${kids.join(", ")}`]));
}

/**
 * Everyone the viewer may start a direct message with.
 * - Students: staff only.
 * - Parents: staff, and parents of children in the same classes.
 * - Staff: staff, parents and students with their own login.
 */
export function listRecipients(viewer: Viewer): Recipient[] {
  const all = db
    .select({ id: users.id, name: users.name, role: users.role, title: users.title })
    .from(users)
    .where(and(eq(users.schoolId, viewer.schoolId), eq(users.disabled, false), ne(users.id, viewer.id)))
    .orderBy(asc(users.name))
    .all()
    .filter((u) => canPairMessage(viewer.role, u.role));

  let allowed = all;
  if (viewer.role === "parent") {
    const classIds = viewer.students.flatMap((s) => (s.classId ? [s.classId] : []));
    const classmates = new Set(
      classIds.length
        ? db
            .selectDistinct({ id: guardians.userId })
            .from(guardians)
            .innerJoin(students, eq(students.id, guardians.studentId))
            .where(and(inArray(students.classId, classIds), eq(students.active, true)))
            .all()
            .map((r) => r.id)
        : [],
    );
    // …and people in the same groups (e.g. the P&C).
    const myGroups = db
      .select({ spaceId: quadMembers.spaceId })
      .from(quadMembers)
      .innerJoin(quadSpaces, eq(quadSpaces.id, quadMembers.spaceId))
      .where(and(eq(quadMembers.userId, viewer.id), eq(quadSpaces.kind, "group")))
      .all()
      .map((r) => r.spaceId);
    if (myGroups.length) {
      for (const r of db
        .selectDistinct({ id: quadMembers.userId })
        .from(quadMembers)
        .where(inArray(quadMembers.spaceId, myGroups))
        .all()) {
        classmates.add(r.id);
      }
    }
    allowed = all.filter((u) => isStaffRole(u.role) || (u.role === "parent" && classmates.has(u.id)));
  }

  const parents = parentDetails(allowed.filter((u) => u.role === "parent").map((u) => u.id));
  const roleOrder = (r: string) => (r === "admin" || r === "staff" ? 0 : r === "parent" ? 1 : 2);
  return allowed
    .map((u) => ({
      ...toPerson(u),
      detail: u.role === "parent" ? (parents.get(u.id) ?? "Parent") : u.title,
    }))
    .sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || a.name.localeCompare(b.name));
}

/** An existing direct-message space with exactly these people, if any. */
export function findDirectSpace(schoolId: string, memberIds: string[]): string | null {
  const want = [...new Set(memberIds)].sort().join(",");
  const [first] = memberIds;
  if (!first) return null;
  const candidates = db
    .select({ id: quadSpaces.id })
    .from(quadSpaces)
    .innerJoin(quadMembers, eq(quadMembers.spaceId, quadSpaces.id))
    .where(and(eq(quadSpaces.schoolId, schoolId), eq(quadSpaces.kind, "direct"), eq(quadMembers.userId, first)))
    .all()
    .map((r) => r.id);
  if (!candidates.length) return null;
  const members = new Map<string, string[]>();
  for (const m of db
    .select({ spaceId: quadMembers.spaceId, userId: quadMembers.userId })
    .from(quadMembers)
    .where(inArray(quadMembers.spaceId, candidates))
    .all()) {
    members.set(m.spaceId, [...(members.get(m.spaceId) ?? []), m.userId]);
  }
  for (const [id, list] of members) if (list.sort().join(",") === want) return id;
  return null;
}

/** Members of a group, for its settings page. */
export function listMembers(spaceId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      title: users.title,
      memberRole: quadMembers.role,
    })
    .from(quadMembers)
    .innerJoin(users, eq(users.id, quadMembers.userId))
    .where(eq(quadMembers.spaceId, spaceId))
    .orderBy(asc(users.name))
    .all()
    .map((u) => ({ ...toPerson(u), memberRole: u.memberRole }));
}

/** Open moderation reports in the viewer's school. */
export function openReportCount(schoolId: string): number {
  return (
    db.get<{ n: number }>(sql`
      select count(*) as n from quad_reports r
      join quad_messages m on m.id = r.message_id
      join quad_spaces s on s.id = m.space_id
      where r.status = 'open' and s.school_id = ${schoolId}
    `)?.n ?? 0
  );
}
