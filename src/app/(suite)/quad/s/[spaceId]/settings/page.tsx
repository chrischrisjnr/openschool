import type { Metadata } from "next";
import { EmptyState, PageTitle } from "@/components/ui";
import { getSpaceAccess, isAudienceKind } from "@/lib/quad/access";
import { listMembers, listRecipients, spaceHref } from "@/lib/quad/spaces";
import { getViewer } from "@/lib/viewer";
import { SettingsView } from "./SettingsView";
import styles from "../../../_components/quad.module.css";

export const metadata: Metadata = { title: "Space settings · Quad" };

export default async function SpaceSettingsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const viewer = await getViewer();
  const access = getSpaceAccess(viewer, spaceId);
  if (!access?.canModerate) {
    return (
      <EmptyState
        icon="shield"
        title="Only staff and moderators can change this space"
        action={{ href: access?.canView ? spaceHref(spaceId) : "/quad", label: "Go back" }}
      />
    );
  }
  const { space } = access;
  const isGroup = space.kind === "group";
  const members = isGroup ? listMembers(space.id) : [];
  const memberIds = new Set(members.map((m) => m.id));
  const candidates = isGroup
    ? listRecipients(viewer).filter((r) => r.role !== "student" && !memberIds.has(r.id))
    : [];

  return (
    <div className={styles.narrow}>
      <PageTitle
        title={`${space.emoji} ${space.name}`}
        description="Settings and members"
        back={{ href: spaceHref(space.id), label: "Back to the conversation" }}
      />
      <SettingsView
        space={{
          id: space.id,
          name: space.name,
          emoji: space.emoji,
          description: space.description ?? "",
          visibility: space.visibility,
          postingPolicy: space.postingPolicy,
          archived: space.archived,
          kind: space.kind,
        }}
        canRename={!isAudienceKind(space.kind) || space.kind === "school"}
        showVisibility={isGroup && viewer.isStaff}
        showPostingPolicy={space.kind !== "announcements"}
        members={members}
        candidates={candidates}
        viewerId={viewer.id}
      />
    </div>
  );
}
