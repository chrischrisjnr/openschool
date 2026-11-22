import { and, desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import { quadMessages, quadReports, quadSpaces, users } from "@/db/schema";
import { requireUser, STAFF_ROLES } from "@/lib/auth";
import { roleBadge } from "@/lib/quad/messages";
import { directName, spaceHref } from "@/lib/quad/spaces";
import { listMembers } from "@/lib/quad/spaces";
import { ModerationView, type ReportItem } from "./ModerationView";

export const metadata: Metadata = { title: "Moderation · Quad" };

export default async function ModerationPage() {
  const viewer = await requireUser(STAFF_ROLES);
  const author = alias(users, "author");
  const reporter = alias(users, "reporter");
  const resolver = alias(users, "resolver");

  const rows = db
    .select({
      report: quadReports,
      message: quadMessages,
      space: { id: quadSpaces.id, name: quadSpaces.name, emoji: quadSpaces.emoji, kind: quadSpaces.kind },
      author: { id: author.id, name: author.name, role: author.role, title: author.title },
      reporter: { name: reporter.name },
      resolver: { name: resolver.name },
    })
    .from(quadReports)
    .innerJoin(quadMessages, eq(quadMessages.id, quadReports.messageId))
    .innerJoin(quadSpaces, eq(quadSpaces.id, quadMessages.spaceId))
    .innerJoin(author, eq(author.id, quadMessages.authorId))
    .innerJoin(reporter, eq(reporter.id, quadReports.reporterId))
    .leftJoin(resolver, eq(resolver.id, quadReports.resolvedBy))
    .where(and(eq(quadSpaces.schoolId, viewer.schoolId), inArray(quadReports.status, ["open", "resolved"])))
    .orderBy(desc(quadReports.createdAt))
    .limit(100)
    .all();

  const dmNames = new Map<string, string>();
  for (const r of rows) {
    if (r.space.kind === "direct" && !dmNames.has(r.space.id)) {
      dmNames.set(r.space.id, `DM: ${directName(listMembers(r.space.id))}`);
    }
  }

  const items: ReportItem[] = rows.map((r) => ({
    id: r.report.id,
    status: r.report.status,
    reason: r.report.reason,
    createdAt: r.report.createdAt.getTime(),
    reporterName: r.reporter.name,
    resolverName: r.resolver?.name ?? null,
    space: {
      name: dmNames.get(r.space.id) ?? r.space.name,
      emoji: r.space.emoji,
      // Staff can't open other people's DMs, so only link to shared spaces.
      href: r.space.kind === "direct" ? null : `${spaceHref(r.space.id)}?m=${r.message.id}`,
    },
    message: {
      body: r.message.body,
      createdAt: r.message.createdAt.getTime(),
      removed: !!r.message.deletedAt,
      author: { name: r.author.name, badge: roleBadge(r.author) },
    },
  }));

  return <ModerationView open={items.filter((i) => i.status === "open")} resolved={items.filter((i) => i.status === "resolved").slice(0, 20)} />;
}
