"use client";

import { Button, Label } from "@primer/react";
import { Card, InitialsAvatar, VStack } from "@/components/ui/Card";
import type { SpaceKind } from "@/db/schema";
import type { PersonDTO } from "@/lib/quad/types";
import { addMembers, setArchived, updateMember, updateSpace } from "../../../actions";
import { RoleBadge } from "../../../_components/chat/MessageItem";
import { PeoplePicker, type PickerPerson } from "../../../_components/PeoplePicker";
import { SpaceForm } from "../../../_components/SpaceForm";
import styles from "../../../_components/quad.module.css";

type Member = PersonDTO & { memberRole: "member" | "moderator" };

function MemberButton({ spaceId, userId, op, children, danger }: { spaceId: string; userId: string; op: string; children: string; danger?: boolean }) {
  return (
    <form action={updateMember}>
      <input type="hidden" name="spaceId" value={spaceId} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="op" value={op} />
      <Button type="submit" size="small" variant={danger ? "danger" : "default"}>
        {children}
      </Button>
    </form>
  );
}

export function SettingsView({
  space,
  canRename,
  showVisibility,
  showPostingPolicy,
  members,
  candidates,
  viewerId,
}: {
  space: {
    id: string;
    name: string;
    emoji: string;
    description: string;
    visibility: "open" | "private";
    postingPolicy: "everyone" | "staff";
    archived: boolean;
    kind: SpaceKind;
  };
  canRename: boolean;
  showVisibility: boolean;
  showPostingPolicy: boolean;
  members: Member[];
  candidates: PickerPerson[];
  viewerId: string;
}) {
  const isGroup = space.kind === "group";
  return (
    <VStack gap={24}>
      <Card title="Details">
        <SpaceForm
          action={updateSpace}
          submitLabel="Save changes"
          canRename={canRename}
          showVisibility={showVisibility}
          showPostingPolicy={showPostingPolicy}
          initial={{ spaceId: space.id, ...space }}
        />
      </Card>

      {isGroup ? (
        <Card title={`Members (${members.length})`}>
          <ul className={styles.members}>
            {members.map((m) => (
              <li key={m.id}>
                <InitialsAvatar name={m.name} size={32} />
                <span className={styles.personText}>
                  <span className={styles.personName}>
                    {m.name} <RoleBadge badge={m.badge} />
                    {m.memberRole === "moderator" ? (
                      <Label size="small" variant="done">
                        Moderator
                      </Label>
                    ) : null}
                  </span>
                </span>
                {m.id !== viewerId ? (
                  <span className={styles.memberActions}>
                    <MemberButton spaceId={space.id} userId={m.id} op={m.memberRole === "moderator" ? "member" : "moderator"}>
                      {m.memberRole === "moderator" ? "Remove moderator" : "Make moderator"}
                    </MemberButton>
                    <MemberButton spaceId={space.id} userId={m.id} op="remove" danger>
                      Remove
                    </MemberButton>
                  </span>
                ) : (
                  <span className={styles.memberActions}>
                    <span className={styles.muted}>You</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {isGroup ? (
        <Card title="Add people">
          <PeoplePicker
            people={candidates}
            action={addMembers}
            name="userId"
            max={50}
            label="Who would you like to add?"
            submitLabel="Add to group"
            hidden={<input type="hidden" name="spaceId" value={space.id} />}
          />
        </Card>
      ) : null}

      {isGroup ? (
        <Card title={space.archived ? "This group is archived" : "Archive group"}>
          <p className={styles.lead}>
            {space.archived
              ? "People can read past messages but can't post. Restore it to bring it back."
              : "Archiving hides the group from Browse and stops new posts. Messages are kept."}
          </p>
          <form action={setArchived}>
            <input type="hidden" name="spaceId" value={space.id} />
            <input type="hidden" name="archived" value={space.archived ? "0" : "1"} />
            <Button type="submit" variant={space.archived ? "default" : "danger"}>
              {space.archived ? "Restore group" : "Archive group"}
            </Button>
          </form>
        </Card>
      ) : null}
    </VStack>
  );
}
