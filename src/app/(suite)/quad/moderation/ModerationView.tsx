"use client";

import { Button, Label } from "@primer/react";
import NextLink from "next/link";
import { EmptyState, PageTitle } from "@/components/ui";
import { InitialsAvatar } from "@/components/ui/Card";
import { resolveReport } from "../actions";
import { RoleBadge } from "../_components/chat/MessageItem";
import { RelativeTime } from "../_components/time";
import styles from "../_components/quad.module.css";

export type ReportItem = {
  id: string;
  status: "open" | "resolved";
  reason: string;
  createdAt: number;
  reporterName: string;
  resolverName: string | null;
  space: { name: string; emoji: string; href: string | null };
  message: { body: string; createdAt: number; removed: boolean; author: { name: string; badge: string | null } };
};

function ReportCard({ item }: { item: ReportItem }) {
  const open = item.status === "open";
  return (
    <article className={styles.report} aria-label={`Report about a message by ${item.message.author.name}`}>
      <div className={styles.reportHead}>
        <span className={styles.reportReason}>{item.reason}</span>
        <span>
          · reported by {item.reporterName} <RelativeTime at={item.createdAt} short />
        </span>
        <span>
          · in{" "}
          {item.space.href ? (
            <NextLink href={item.space.href}>
              {item.space.emoji} {item.space.name}
            </NextLink>
          ) : (
            <>
              {item.space.emoji} {item.space.name}
            </>
          )}
        </span>
        {!open ? (
          <Label variant={item.message.removed ? "danger" : "secondary"}>
            {item.message.removed ? "Message removed" : "Dismissed"}
            {item.resolverName ? ` by ${item.resolverName}` : ""}
          </Label>
        ) : null}
      </div>
      <div className={styles.reportMessage}>
        <InitialsAvatar name={item.message.author.name} size={32} />
        <div>
          <div className={styles.activityMeta}>
            <span className={styles.activityAuthor}>{item.message.author.name}</span>
            <RoleBadge badge={item.message.author.badge} />
            <RelativeTime at={item.message.createdAt} short />
          </div>
          <p className={styles.reportMessageBody}>{item.message.body}</p>
        </div>
      </div>
      {open ? (
        <div className={styles.reportActions}>
          <form action={resolveReport}>
            <input type="hidden" name="reportId" value={item.id} />
            <input type="hidden" name="op" value="remove" />
            <Button type="submit" variant="danger">
              Remove message
            </Button>
          </form>
          <form action={resolveReport}>
            <input type="hidden" name="reportId" value={item.id} />
            <input type="hidden" name="op" value="dismiss" />
            <Button type="submit">Keep message and dismiss</Button>
          </form>
        </div>
      ) : null}
    </article>
  );
}

export function ModerationView({ open, resolved }: { open: ReportItem[]; resolved: ReportItem[] }) {
  return (
    <div className={styles.narrow}>
      <PageTitle
        title="Moderation"
        description="Messages families and staff have reported. Removing a message replaces it with “Message removed by a moderator” for everyone."
      />
      {open.length ? (
        <div className={styles.reports}>
          {open.map((item) => (
            <ReportCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState icon="shield" title="Nothing to review" description="When someone reports a message it will appear here." />
      )}

      {resolved.length ? (
        <section className={styles.spaced} aria-labelledby="resolved-heading">
          <h2 id="resolved-heading" className={styles.sectionTitle}>
            Recently resolved
          </h2>
          <div className={`${styles.reports} ${styles.spacedSmall}`}>
            {resolved.map((item) => (
              <ReportCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
