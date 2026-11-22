import "server-only";
import { and, asc, desc, eq, inArray, isNull, lt, max, count, gte, or } from "drizzle-orm";
import { db } from "@/db";
import { quadMessages, quadReactions, users, type Role } from "@/db/schema";
import { PAGE_SIZE, REACTIONS, type MessageDTO, type PersonDTO } from "./types";

export type MessageRow = typeof quadMessages.$inferSelect;

/** "Teacher", "Principal", "Staff" or "Student" — parents get no badge. */
export function roleBadge(user: { role: Role; title: string | null }): string | null {
  if (user.role === "student") return "Student";
  if (user.role === "parent") return null;
  const title = (user.title ?? "").toLowerCase();
  if (title.includes("principal")) return "Principal";
  if (title.includes("teacher")) return "Teacher";
  return "Staff";
}

export function toPerson(user: { id: string; name: string; role: Role; title: string | null }): PersonDTO {
  return { id: user.id, name: user.name, role: user.role, badge: roleBadge(user) };
}

/** Builds browser-safe DTOs (author, reactions, reply counts) for message rows. */
export function toMessageDTOs(rows: MessageRow[]): MessageDTO[] {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);

  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const authors = new Map(
    db
      .select({ id: users.id, name: users.name, role: users.role, title: users.title })
      .from(users)
      .where(inArray(users.id, authorIds))
      .all()
      .map((u) => [u.id, toPerson(u)]),
  );

  const reactionRows = db
    .select({ messageId: quadReactions.messageId, emoji: quadReactions.emoji, userId: users.id, name: users.name })
    .from(quadReactions)
    .innerJoin(users, eq(users.id, quadReactions.userId))
    .where(inArray(quadReactions.messageId, ids))
    .orderBy(asc(users.name))
    .all();
  const reactions = new Map<string, Map<string, { id: string; name: string }[]>>();
  for (const r of reactionRows) {
    const byEmoji = reactions.get(r.messageId) ?? new Map();
    byEmoji.set(r.emoji, [...(byEmoji.get(r.emoji) ?? []), { id: r.userId, name: r.name }]);
    reactions.set(r.messageId, byEmoji);
  }

  const topLevel = rows.filter((r) => !r.parentId).map((r) => r.id);
  const replies = new Map(
    topLevel.length
      ? db
          .select({ parentId: quadMessages.parentId, n: count(), last: max(quadMessages.createdAt) })
          .from(quadMessages)
          .where(and(inArray(quadMessages.parentId, topLevel), isNull(quadMessages.deletedAt)))
          .groupBy(quadMessages.parentId)
          .all()
          .map((r) => [r.parentId!, r])
      : [],
  );

  return rows.map((r) => {
    const deleted = r.deletedAt ? (r.deletedBy && r.deletedBy !== r.authorId ? "moderator" : "author") : null;
    const byEmoji = reactions.get(r.id);
    const reply = replies.get(r.id);
    return {
      id: r.id,
      spaceId: r.spaceId,
      parentId: r.parentId,
      author: authors.get(r.authorId) ?? { id: r.authorId, name: "Former member", role: "parent", badge: null },
      body: deleted ? "" : r.body,
      createdAt: r.createdAt.getTime(),
      editedAt: r.editedAt?.getTime() ?? null,
      deleted,
      pinned: !deleted && r.pinned,
      // Keep the fixed order of the reaction set, not insertion order.
      reactions: deleted
        ? []
        : REACTIONS.filter((e) => byEmoji?.has(e)).map((emoji) => ({ emoji, users: byEmoji!.get(emoji)! })),
      replyCount: reply?.n ?? 0,
      lastReplyAt: reply?.last ? new Date(reply.last).getTime() : null,
    };
  });
}

export function getMessageRow(id: string): MessageRow | undefined {
  return db.select().from(quadMessages).where(eq(quadMessages.id, id)).get();
}

export function getMessageDTO(id: string): MessageDTO | null {
  const row = getMessageRow(id);
  return row ? toMessageDTOs([row])[0]! : null;
}

/**
 * Top-level messages in a space, oldest first. Loads the latest page, or
 * the page before `before`, and always reaches back to `includeFrom` (used to
 * jump to a search result).
 */
export function loadSpaceMessages(
  spaceId: string,
  opts: { before?: number; includeFrom?: number } = {},
): { messages: MessageDTO[]; hasMore: boolean } {
  const conds = [eq(quadMessages.spaceId, spaceId), isNull(quadMessages.parentId)];
  if (opts.before) conds.push(lt(quadMessages.createdAt, new Date(opts.before)));
  const where = and(...conds);

  let rows = db
    .select()
    .from(quadMessages)
    .where(where)
    .orderBy(desc(quadMessages.createdAt))
    .limit(PAGE_SIZE + 1)
    .all();
  let hasMore = rows.length > PAGE_SIZE;
  rows = rows.slice(0, PAGE_SIZE);

  const oldest = rows.at(-1)?.createdAt.getTime();
  if (opts.includeFrom && oldest && opts.includeFrom < oldest) {
    rows = db
      .select()
      .from(quadMessages)
      .where(and(where, gte(quadMessages.createdAt, new Date(opts.includeFrom))))
      .orderBy(desc(quadMessages.createdAt))
      .all();
    hasMore = true;
  }
  return { messages: toMessageDTOs(rows.reverse()), hasMore };
}

/** A thread: the parent message and its replies, oldest first. */
export function loadThread(parentId: string): MessageDTO[] {
  const rows = db
    .select()
    .from(quadMessages)
    .where(or(eq(quadMessages.id, parentId), eq(quadMessages.parentId, parentId)))
    .orderBy(asc(quadMessages.createdAt))
    .all();
  return toMessageDTOs(rows);
}

export function loadPinned(spaceId: string): MessageDTO[] {
  const rows = db
    .select()
    .from(quadMessages)
    .where(and(eq(quadMessages.spaceId, spaceId), eq(quadMessages.pinned, true), isNull(quadMessages.deletedAt)))
    .orderBy(desc(quadMessages.createdAt))
    .all();
  return toMessageDTOs(rows);
}
