import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { quadMembers, quadSpaces, users, type Role, type SpaceKind } from "@/db/schema";
import { canSeeAudience, type Viewer } from "@/lib/viewer";

/**
 * Who may see and do what in a Quad space.
 *
 * Every page, server action and the real-time stream goes through
 * `getSpaceAccess()` so the rules live in exactly one place.
 *
 * Child safety (Australian Child Safe Standards): student accounts only ever
 * see their own class space, the announcements space and the whole-school
 * space, and may only take part in direct messages with staff.
 */

export type SpaceRow = typeof quadSpaces.$inferSelect;
export type MemberRole = "member" | "moderator";

export type SpaceAccess = {
  space: SpaceRow;
  canView: boolean;
  /** Write new messages and thread replies. */
  canPost: boolean;
  /** Add emoji reactions. */
  canReact: boolean;
  /** Delete anyone's message, pin, edit the space's settings. */
  canModerate: boolean;
  canPin: boolean;
  /** Has a membership row (groups / DMs) or automatic membership (audience spaces). */
  isMember: boolean;
  memberRole: MemberRole | null;
  canJoin: boolean;
  canLeave: boolean;
  /** Friendly explanation shown instead of the composer when posting is not allowed. */
  postingNote: string | null;
};

/** Spaces whose membership comes from the audience columns. */
export const AUDIENCE_KINDS: readonly SpaceKind[] = ["announcements", "school", "year", "class"];
export const isAudienceKind = (kind: SpaceKind) => AUDIENCE_KINDS.includes(kind);

const STAFF_ROLES: readonly Role[] = ["admin", "staff"];
export const isStaffRole = (role: Role) => STAFF_ROLES.includes(role);

type ViewerLike = Pick<Viewer, "id" | "role" | "isStaff" | "isAdmin" | "audienceKeys" | "schoolId">;

/**
 * Pure rules, given everything already loaded. `directRoles` holds the roles
 * of the other people in a direct-message space.
 */
export function evaluateAccess(
  viewer: ViewerLike,
  space: SpaceRow,
  membership: { role: MemberRole } | null,
  directRoles: Role[] = [],
): SpaceAccess {
  const isStudent = viewer.role === "student";
  let canView = false;
  let isMember = false;

  if (space.schoolId !== viewer.schoolId) {
    canView = false;
  } else if (isAudienceKind(space.kind)) {
    const type = space.audienceType ?? "school";
    canView = canSeeAudience(viewer, type, space.audienceId);
    // Students: their class, announcements and the whole-school space only.
    if (isStudent) {
      const allowed =
        space.kind === "announcements" ||
        (space.kind === "school" && type === "school") ||
        space.kind === "class";
      canView = canView && allowed;
    }
    isMember = canView;
  } else if (space.kind === "group") {
    const audienceOk = space.audienceType ? canSeeAudience(viewer, space.audienceType, space.audienceId) : true;
    isMember = !!membership;
    canView = !isStudent && audienceOk && (space.visibility === "open" || isMember || viewer.isAdmin);
  } else if (space.kind === "direct") {
    isMember = !!membership;
    canView = isMember && (!isStudent || directRoles.every(isStaffRole));
  }

  const canModerate =
    canView && space.kind !== "direct" && (viewer.isStaff || membership?.role === "moderator");
  const staffOnly = space.kind === "announcements" || space.postingPolicy === "staff";
  const needsMembership = space.kind === "group" || space.kind === "direct";

  let postingNote: string | null = null;
  if (!canView) postingNote = null;
  else if (space.archived) postingNote = "This space has been archived. You can still read past messages.";
  else if (needsMembership && !isMember) postingNote = "Join this group to post and react.";
  else if (staffOnly && !canModerate) postingNote = "Only school staff can post here. You can still react to messages.";

  const canPost = canView && !space.archived && (!needsMembership || isMember) && (!staffOnly || canModerate);
  const canReact = canView && !space.archived && (!needsMembership || isMember);

  return {
    space,
    canView,
    canPost,
    canReact,
    canModerate,
    canPin: canModerate || (space.kind === "direct" && canView),
    isMember: canView && isMember,
    memberRole: membership?.role ?? null,
    canJoin:
      space.kind === "group" &&
      space.visibility === "open" &&
      !membership &&
      !isStudent &&
      !space.archived &&
      canView,
    canLeave: space.kind === "group" && !!membership,
    postingNote,
  };
}

/** Roles of the *other* members of a direct-message space. */
function otherMemberRoles(spaceId: string, viewerId: string): Role[] {
  return db
    .select({ id: users.id, role: users.role })
    .from(quadMembers)
    .innerJoin(users, eq(users.id, quadMembers.userId))
    .where(eq(quadMembers.spaceId, spaceId))
    .all()
    .filter((r) => r.id !== viewerId)
    .map((r) => r.role);
}

/**
 * The single permission check for a space. Returns null when the space does
 * not exist in the viewer's school; check `canView` before showing anything.
 */
export function getSpaceAccess(viewer: ViewerLike, spaceId: string): SpaceAccess | null {
  const space = db
    .select()
    .from(quadSpaces)
    .where(and(eq(quadSpaces.id, spaceId), eq(quadSpaces.schoolId, viewer.schoolId)))
    .get();
  if (!space) return null;
  const membership =
    db
      .select({ role: quadMembers.role })
      .from(quadMembers)
      .where(and(eq(quadMembers.spaceId, spaceId), eq(quadMembers.userId, viewer.id)))
      .get() ?? null;
  const directRoles = space.kind === "direct" ? otherMemberRoles(space.id, viewer.id) : [];
  return evaluateAccess(viewer, space, membership, directRoles);
}

/**
 * Every space in the viewer's school with the viewer's access, in one pass.
 * Includes open groups the viewer hasn't joined (for browsing).
 */
export function getAllSpaceAccess(viewer: ViewerLike): SpaceAccess[] {
  const spaces = db.select().from(quadSpaces).where(eq(quadSpaces.schoolId, viewer.schoolId)).all();
  const memberships = new Map(
    db
      .select({ spaceId: quadMembers.spaceId, role: quadMembers.role })
      .from(quadMembers)
      .where(eq(quadMembers.userId, viewer.id))
      .all()
      .map((m) => [m.spaceId, m]),
  );

  // Students: we need the roles of the other people in their DMs.
  const directRoles = new Map<string, Role[]>();
  if (viewer.role === "student") {
    const dmIds = spaces.filter((s) => s.kind === "direct" && memberships.has(s.id)).map((s) => s.id);
    if (dmIds.length) {
      for (const r of db
        .select({ spaceId: quadMembers.spaceId, userId: users.id, role: users.role })
        .from(quadMembers)
        .innerJoin(users, eq(users.id, quadMembers.userId))
        .where(inArray(quadMembers.spaceId, dmIds))
        .all()) {
        if (r.userId === viewer.id) continue;
        directRoles.set(r.spaceId, [...(directRoles.get(r.spaceId) ?? []), r.role]);
      }
    }
  }

  return spaces
    .map((s) => evaluateAccess(viewer, s, memberships.get(s.id) ?? null, directRoles.get(s.id) ?? []))
    .filter((a) => a.canView);
}

/** May these two people be in a direct conversation together? */
export function canPairMessage(a: Role, b: Role): boolean {
  if (a === "student") return isStaffRole(b);
  if (b === "student") return isStaffRole(a);
  return true;
}
