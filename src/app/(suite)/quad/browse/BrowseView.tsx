"use client";

import { LockIcon, PeopleIcon } from "@primer/octicons-react";
import { Button, Label } from "@primer/react";
import NextLink from "next/link";
import { ButtonLink, EmptyState, PageTitle } from "@/components/ui";
import type { SpaceSummaryDTO } from "@/lib/quad/types";
import { joinSpace } from "../actions";
import { SpaceCards } from "../_components/SpaceList";
import { RelativeTime } from "../_components/time";
import styles from "../_components/quad.module.css";

type Group = SpaceSummaryDTO & {
  visibility: "open" | "private";
  memberCount: number;
  isMember: boolean;
  canJoin: boolean;
};

export function BrowseView({
  groups,
  audienceSpaces,
  isStaff,
}: {
  groups: Group[];
  audienceSpaces: SpaceSummaryDTO[];
  isStaff: boolean;
}) {
  return (
    <div className={styles.page}>
      <PageTitle
        title="Browse groups"
        description="Join groups for the things you care about — from the P&C to weekend sport. You can leave any time."
        actions={
          <ButtonLink href="/quad/new" leadingIcon="plus" variant="primary">
            Create a group
          </ButtonLink>
        }
      />

      {groups.length === 0 ? (
        <EmptyState
          icon="people"
          title="No groups yet"
          description="Start one for your sports team, book club or volunteers."
          action={{ href: "/quad/new", label: "Create a group" }}
        />
      ) : (
        <div className={styles.groupGrid}>
          {groups.map((g) => (
            <article key={g.id} className={styles.groupCard}>
              <div className={styles.groupCardHead}>
                <span className={styles.spaceEmoji} style={{ width: 44, height: 44, fontSize: 24 }} aria-hidden>
                  {g.emoji}
                </span>
                <div>
                  <h2 className={styles.groupName}>
                    <NextLink href={g.href}>{g.name}</NextLink>
                  </h2>
                  <div className={styles.groupMeta}>
                    <PeopleIcon size={12} />
                    {g.memberCount === 1 ? "1 member" : `${g.memberCount} members`}
                    {g.visibility === "private" ? (
                      <Label size="small" variant="secondary">
                        <LockIcon size={10} /> Private
                      </Label>
                    ) : null}
                    {g.lastMessageAt ? (
                      <>
                        {" · active "}<RelativeTime at={g.lastMessageAt} short />
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
              <p className={styles.groupDescription}>{g.description ?? "A community group."}</p>
              <div className={styles.groupActions}>
                {g.isMember ? (
                  <ButtonLink href={g.href}>Open</ButtonLink>
                ) : g.canJoin ? (
                  <>
                    <form action={joinSpace}>
                      <input type="hidden" name="spaceId" value={g.id} />
                      <input type="hidden" name="open" value="1" />
                      <Button type="submit" variant="primary">
                        Join
                      </Button>
                    </form>
                    <ButtonLink href={g.href} variant="invisible">
                      Have a look
                    </ButtonLink>
                  </>
                ) : (
                  <ButtonLink href={g.href}>View</ButtonLink>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {isStaff && audienceSpaces.length ? (
        <section className={styles.spaced} aria-labelledby="all-classes">
          <h2 id="all-classes" className={styles.sectionTitle}>
            Every class and year level
          </h2>
          <p className={styles.lead}>
            As staff you can open any class or year space. Spaces you open are added to your sidebar.
          </p>
          <SpaceCards spaces={audienceSpaces} />
        </section>
      ) : null}
    </div>
  );
}
