"use client";

import { Button } from "@primer/react";
import NextLink from "next/link";
import { ButtonLink, PageTitle } from "@/components/ui";
import { InitialsAvatar } from "@/components/ui/Card";
import type { Role } from "@/db/schema";
import type { MessageDTO, SpaceSummaryDTO } from "@/lib/quad/types";
import { dismissGuidelines } from "../actions";
import { RoleBadge } from "./chat/MessageItem";
import { SpaceCards } from "./SpaceList";
import { RelativeTime } from "./time";
import styles from "./quad.module.css";

type Activity = { space: { id: string; name: string; emoji: string; href: string }; message: MessageDTO };

const GUIDELINES = [
  "Be kind and patient — we're all here for the children.",
  "Keep it about school life. No selling, politics or chain messages.",
  "Protect privacy: don't share photos or details of other people's children.",
  "Talk to your child's teacher directly about your own child.",
  "If something worries you, use “Report to staff” on the message.",
  "Urgent? Call the school office — Quad isn't watched all the time.",
];

const STUDENT_GUIDELINES = [
  "Be kind. Write like your teacher is reading — they can.",
  "Never share passwords, your address or phone number.",
  "If something makes you feel unsafe, tell a teacher or use “Report to staff”.",
];

export function Guidelines({ role, dismissible }: { role: Role; dismissible: boolean }) {
  const items = role === "student" ? STUDENT_GUIDELINES : GUIDELINES;
  return (
    <section className={styles.guidelines} aria-labelledby="guidelines-title">
      <span className={styles.guidelinesIcon} aria-hidden>
        🤝
      </span>
      <div>
        <h2 id="guidelines-title" className={styles.guidelinesTitle}>
          Our community guidelines
        </h2>
        <ul className={styles.guidelinesList}>
          {items.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
        {dismissible ? (
          <form action={dismissGuidelines}>
            <Button type="submit" size="small">
              Got it, thanks
            </Button>
          </form>
        ) : null}
      </div>
    </section>
  );
}

export function QuadHomeView({
  firstName,
  role,
  spaces,
  activity,
  showGuidelines,
}: {
  firstName: string;
  role: Role;
  spaces: SpaceSummaryDTO[];
  activity: Activity[];
  showGuidelines: boolean;
}) {
  const unread = spaces.filter((s) => s.kind !== "direct").reduce((n, s) => n + s.unread, 0);
  const dms = spaces.filter((s) => s.kind === "direct");
  return (
    <div className={styles.page}>
      <PageTitle
        title="Quad"
        description={
          unread
            ? `Hi ${firstName} — there ${unread === 1 ? "is 1 new message" : `are ${unread} new messages`} in your spaces.`
            : `Hi ${firstName} — you're all caught up.`
        }
        actions={
          <>
            <ButtonLink href="/quad/dm" leadingIcon="mail">
              New message
            </ButtonLink>
            {role !== "student" ? (
              <ButtonLink href="/quad/new" leadingIcon="plus">
                New group
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {showGuidelines ? <Guidelines role={role} dismissible /> : null}

      <div className={styles.columns}>
        <div className={styles.column}>
          <h2 className={styles.sectionTitle}>Your spaces</h2>
          <SpaceCards spaces={spaces} kinds={["announcements", "school", "year", "class", "group"]} />
          {role !== "student" ? (
            <p className={styles.muted}>
              Looking for the P&amp;C, sport or volunteers? <NextLink href="/quad/browse">Browse groups</NextLink>
            </p>
          ) : null}
        </div>

        <div className={styles.column}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Direct messages</h2>
            <NextLink href="/quad/dm">See all</NextLink>
          </div>
          <SpaceCards
            spaces={dms.slice(0, 4)}
            emptyText={
              role === "student"
                ? "You can message your teachers from here."
                : "Message a teacher or another family privately."
            }
          />

          <h2 className={styles.sectionTitle}>Recent activity</h2>
          {activity.length ? (
            <ul className={styles.activity}>
              {activity.map(({ space, message }) => (
                <li key={message.id}>
                  <NextLink href={`${space.href}?m=${message.id}`} className={styles.activityItem}>
                    <InitialsAvatar name={message.author.name} size={32} />
                    <span className={styles.activityText}>
                      <span className={styles.activityMeta}>
                        <span className={styles.activityAuthor}>{message.author.name}</span>
                        <RoleBadge badge={message.author.badge} />
                        <span>
                          in {space.emoji} {space.name} · <RelativeTime at={message.createdAt} short />
                        </span>
                      </span>
                      <span className={styles.activityBody}>{message.body}</span>
                    </span>
                  </NextLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>Nothing yet — say hello in one of your spaces!</p>
          )}

          {!showGuidelines ? (
            <details>
              <summary className={styles.muted}>Community guidelines</summary>
              <div className={styles.spacedSmall}>
                <Guidelines role={role} dismissible={false} />
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
