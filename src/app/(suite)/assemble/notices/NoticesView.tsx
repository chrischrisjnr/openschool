"use client";

import { PinIcon } from "@primer/octicons-react";
import { Banner, Label } from "@primer/react";
import NextLink from "next/link";
import { ButtonLink, EmptyState, PageTitle } from "@/components/ui";
import { InitialsAvatar } from "@/components/ui/Card";
import { NOTICE_CATEGORIES, type NoticeCategory } from "@/lib/assemble/constants";
import type { NoticeListItem } from "@/lib/assemble/notices";
import { pluralise } from "@/lib/format";
import { FilterChips, Meta, NoticeCategoryLabel } from "../_components/bits";
import shared from "../_components/assemble.module.css";
import styles from "./notices.module.css";

export function NoticesView({
  notices,
  category,
  categories,
  total,
  unread,
  canPost,
  deleted,
  tz,
}: {
  notices: NoticeListItem[];
  category: NoticeCategory | null;
  categories: { key: NoticeCategory; count: number }[];
  total: number;
  unread: number;
  canPost: boolean;
  deleted: boolean;
  tz: string;
}) {
  return (
    <div className={shared.stack}>
      <PageTitle
        title="Notices"
        description={unread ? `${pluralise(unread, "unread notice")} · ${total} in total` : "You're up to date."}
        actions={
          canPost ? (
            <ButtonLink href="/assemble/notices/new" variant="primary" leadingIcon="plus">
              New notice
            </ButtonLink>
          ) : undefined
        }
      />
      {deleted ? <Banner variant="success" title="Notice deleted" hideTitle description="The notice has been deleted." /> : null}

      <FilterChips
        label="Filter notices by category"
        items={[
          { href: "/assemble/notices", label: "All", current: !category, count: total },
          ...categories.map((c) => ({
            href: `/assemble/notices?category=${c.key}`,
            label: NOTICE_CATEGORIES[c.key].label,
            current: category === c.key,
            count: c.count,
          })),
        ]}
      />

      {notices.length ? (
        <ul className={styles.feed} aria-label="Notices">
          {notices.map((n) => (
            <li key={n.id}>
              <NextLink href={`/assemble/notices/${n.id}`} className={styles.notice} data-unread={!n.read || undefined}>
                <div className={styles.noticeTop}>
                  <div className={styles.labels}>
                    {n.pinned ? (
                      <Label variant="attention">
                        <PinIcon size={12} /> Pinned
                      </Label>
                    ) : null}
                    <NoticeCategoryLabel category={n.category} />
                    {n.ackMine ? (
                      <Label variant={n.acknowledged ? "success" : "severe"}>{n.acknowledged ? "Acknowledged" : "Please acknowledge"}</Label>
                    ) : n.requiresAck ? (
                      <Label variant="secondary">Acknowledgement requested</Label>
                    ) : null}
                    {n.expired ? <Label variant="secondary">Expired</Label> : null}
                  </div>
                  {!n.read ? <span className={styles.newBadge}>New</span> : null}
                </div>
                <h2 className={styles.title}>{n.title}</h2>
                <p className={styles.excerpt}>{n.excerpt}</p>
                <div className={styles.byline}>
                  <InitialsAvatar name={n.authorName} size={20} />
                  <span className={shared.muted}>
                    <Meta parts={[n.authorName, n.when, n.audience]} />
                  </span>
                </div>
              </NextLink>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="megaphone"
          title={category ? "No notices in this category" : "No notices yet"}
          description={canPost ? "Post a notice to share news with families." : "When the school posts news, it will appear here."}
          action={canPost ? { href: "/assemble/notices/new", label: "Post a notice" } : undefined}
        />
      )}
    </div>
  );
}
