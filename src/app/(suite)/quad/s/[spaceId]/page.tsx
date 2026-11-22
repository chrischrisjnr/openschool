import { and, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui";
import { db } from "@/db";
import { classes, quadMembers, quadMessages, users } from "@/db/schema";
import { getSpaceAccess } from "@/lib/quad/access";
import { getMessageRow, loadSpaceMessages, roleBadge, toPerson } from "@/lib/quad/messages";
import { directName } from "@/lib/quad/spaces";
import { getViewer } from "@/lib/viewer";
import { SpaceView } from "../../_components/chat/SpaceView";
import { listMembers } from "@/lib/quad/spaces";

type Props = {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<{ m?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { spaceId } = await params;
  const viewer = await getViewer();
  const access = getSpaceAccess(viewer, spaceId);
  if (!access?.canView) return { title: "Quad" };
  if (access.space.kind === "direct") return { title: "Direct message · Quad" };
  return { title: `${access.space.name} · Quad` };
}

export default async function SpacePage({ params, searchParams }: Props) {
  const [{ spaceId }, { m }] = await Promise.all([params, searchParams]);
  const viewer = await getViewer();
  const access = getSpaceAccess(viewer, spaceId);

  if (!access?.canView) {
    return (
      <EmptyState
        icon="shield"
        title="This space isn't available"
        description="It may have been removed, or it's only for some members of the school community."
        action={{ href: "/quad", label: "Back to Quad" }}
      />
    );
  }
  const { space } = access;

  // A linked message (from search or the home page) — open its thread if it's a reply.
  const target = m ? getMessageRow(m) : undefined;
  const linked = target && target.spaceId === space.id ? target : undefined;
  const threadId = linked?.parentId ?? null;
  const anchor = linked?.parentId ? getMessageRow(linked.parentId) : linked;

  const initial = loadSpaceMessages(space.id, { includeFrom: anchor?.createdAt.getTime() });
  const member = db
    .select({ lastReadAt: quadMembers.lastReadAt })
    .from(quadMembers)
    .where(and(eq(quadMembers.spaceId, space.id), eq(quadMembers.userId, viewer.id)))
    .get();
  const pinnedIds = db
    .select({ id: quadMessages.id })
    .from(quadMessages)
    .where(and(eq(quadMessages.spaceId, space.id), eq(quadMessages.pinned, true), isNull(quadMessages.deletedAt)))
    .all()
    .map((r) => r.id);

  const people =
    space.kind === "direct" ? listMembers(space.id).filter((p) => p.id !== viewer.id).map(({ memberRole: _r, ...p }) => p) : undefined;

  // Class spaces: offer "Message Mr Reyes" to families.
  let contact = null;
  if (space.kind === "class" && space.audienceId && viewer.role !== "admin" && viewer.role !== "staff") {
    const teacher = db
      .select({ id: users.id, name: users.name, role: users.role, title: users.title })
      .from(classes)
      .innerJoin(users, eq(users.id, classes.teacherId))
      .where(eq(classes.id, space.audienceId))
      .get();
    contact = teacher ? toPerson(teacher) : null;
  }

  const name = people ? directName(people) : space.name;

  return (
    <SpaceView
      key={`${space.id}:${m ?? ""}`}
      space={{
        id: space.id,
        name,
        emoji: space.emoji,
        kind: space.kind,
        description: space.description,
        archived: space.archived,
      }}
      people={people}
      contact={contact}
      permissions={{
        canPost: access.canPost,
        canReact: access.canReact,
        canModerate: access.canModerate,
        canPin: access.canPin,
        canJoin: access.canJoin,
        canLeave: access.canLeave,
        canManage: access.canModerate,
        postingNote: access.postingNote,
      }}
      viewer={{ id: viewer.id, name: viewer.name, role: viewer.role, badge: roleBadge(viewer) }}
      initial={initial}
      lastReadAt={member?.lastReadAt?.getTime() ?? (access.isMember ? Date.now() - 7 * 24 * 3600 * 1000 : null)}
      pinnedIds={pinnedIds}
      targetId={linked?.id ?? null}
      threadId={threadId}
      serverNow={Date.now()}
    />
  );
}
