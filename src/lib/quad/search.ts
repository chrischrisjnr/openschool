import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { quadMembers, quadMessages, users } from "@/db/schema";
import type { Viewer } from "@/lib/viewer";
import { getAllSpaceAccess } from "./access";
import { toMessageDTOs, toPerson } from "./messages";
import { directName, spaceHref } from "./spaces";
import type { MessageDTO } from "./types";

export type SearchResult = {
  message: MessageDTO;
  space: { id: string; name: string; emoji: string; href: string };
};

/**
 * Simple text search across every space the viewer can see (including open
 * groups they haven't joined, but never other people's DMs).
 */
export function searchMessages(viewer: Viewer, query: string, limit = 50): SearchResult[] {
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  const spaces = getAllSpaceAccess(viewer);
  if (!spaces.length) return [];
  const byId = new Map(spaces.map((a) => [a.space.id, a.space]));

  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = db
    .select()
    .from(quadMessages)
    .where(
      and(
        inArray(quadMessages.spaceId, [...byId.keys()]),
        isNull(quadMessages.deletedAt),
        sql`${quadMessages.body} like ${`%${escaped}%`} escape '\\'`,
      ),
    )
    .orderBy(desc(quadMessages.createdAt))
    .limit(limit)
    .all();

  // DM names are the other people in the conversation.
  const dmIds = [...new Set(rows.map((r) => r.spaceId).filter((id) => byId.get(id)?.kind === "direct"))];
  const dmPeople = new Map<string, ReturnType<typeof toPerson>[]>();
  if (dmIds.length) {
    for (const r of db
      .select({ spaceId: quadMembers.spaceId, id: users.id, name: users.name, role: users.role, title: users.title })
      .from(quadMembers)
      .innerJoin(users, eq(users.id, quadMembers.userId))
      .where(inArray(quadMembers.spaceId, dmIds))
      .all()) {
      if (r.id !== viewer.id) dmPeople.set(r.spaceId, [...(dmPeople.get(r.spaceId) ?? []), toPerson(r)]);
    }
  }

  return toMessageDTOs(rows).map((message) => {
    const s = byId.get(message.spaceId)!;
    const name = s.kind === "direct" ? directName(dmPeople.get(s.id) ?? []) : s.name;
    return { message, space: { id: s.id, name, emoji: s.emoji, href: spaceHref(s.id) } };
  });
}
