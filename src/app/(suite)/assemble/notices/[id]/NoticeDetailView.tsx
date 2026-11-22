"use client";

import { CheckCircleFillIcon, PinIcon } from "@primer/octicons-react";
import { Label } from "@primer/react";
import { ButtonLink, PageTitle, SubmitButton } from "@/components/ui";
import { Card, InitialsAvatar, RichText } from "@/components/ui/Card";
import type { NoticeReach } from "@/lib/assemble/notices";
import { ConfirmButton } from "../../_components/ConfirmButton";
import { Meter, NoticeCategoryLabel, Row, RowList } from "../../_components/bits";
import shared from "../../_components/assemble.module.css";
import { acknowledgeNotice, deleteNotice } from "../actions";
import styles from "../notices.module.css";

type NoticeDetail = {
  id: string;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  requiresAck: boolean;
  audience: string;
  published: string;
  expires: string | null;
  expired: boolean;
  authorName: string;
  authorTitle: string | null;
};

export function NoticeDetailView({
  notice: n,
  ack,
  reach,
  canEdit,
}: {
  notice: NoticeDetail;
  ack: { done: boolean; at: string | null } | null;
  reach: NoticeReach | null;
  canEdit: boolean;
}) {
  const unit = reach?.unit ?? "families";
  return (
    <div className={reach ? shared.columns : undefined}>
      <article className={styles.article}>
        <PageTitle
          back={{ href: "/assemble/notices", label: "All notices" }}
          title={n.title}
          actions={
            canEdit ? (
              <>
                <ButtonLink href={`/assemble/notices/${n.id}/edit`} leadingIcon="pencil">
                  Edit
                </ButtonLink>
                <ConfirmButton
                  action={deleteNotice}
                  fields={{ id: n.id }}
                  title="Delete this notice?"
                  body="Families will no longer see it, and its read receipts will be removed. This can't be undone."
                  confirmLabel="Delete notice"
                >
                  Delete
                </ConfirmButton>
              </>
            ) : undefined
          }
        />
        <div className={`${styles.labels} ${styles.detailLabels}`}>
          {n.pinned ? (
            <Label variant="attention">
              <PinIcon size={12} /> Pinned
            </Label>
          ) : null}
          <NoticeCategoryLabel category={n.category} />
          <Label variant="secondary">{n.audience}</Label>
          {n.expired ? <Label variant="secondary">Expired {n.expires}</Label> : n.expires ? <Label variant="secondary">Until {n.expires}</Label> : null}
        </div>
        <div className={styles.articleMeta}>
          <InitialsAvatar name={n.authorName} size={40} />
          <div>
            <strong>{n.authorName}</strong>
            <span className={styles.authorLine}>
              {n.authorTitle ? `${n.authorTitle} · ` : ""}
              {n.published}
            </span>
          </div>
        </div>
        <div className={styles.body}>
          <RichText text={n.body} />
        </div>

        {ack ? (
          <div className={styles.ack} data-done={ack.done || undefined}>
            {ack.done ? (
              <span className={styles.ackText}>
                <CheckCircleFillIcon fill="var(--fgColor-success)" /> You acknowledged this notice{ack.at ? ` on ${ack.at}` : ""}.
              </span>
            ) : (
              <>
                <span className={styles.ackText}>The school has asked families to confirm they&apos;ve read this.</span>
                <form action={acknowledgeNotice}>
                  <input type="hidden" name="id" value={n.id} />
                  <SubmitButton pendingLabel="Saving…">I&apos;ve read this</SubmitButton>
                </form>
              </>
            )}
          </div>
        ) : null}
      </article>

      {reach ? (
        <aside className={shared.stackTight} aria-label="Read receipts">
          <Card title="Read receipts">
            <div className={styles.reachNumbers}>
              <div className={styles.reachNumber}>
                <span className={`${shared.muted} ${shared.small}`}>Read</span>
                <strong>
                  {reach.read} <span className={shared.muted}>of {reach.total}</span>
                </strong>
                <Meter value={reach.read} max={reach.total} label="Read" />
              </div>
              {n.requiresAck ? (
                <div className={styles.reachNumber}>
                  <span className={`${shared.muted} ${shared.small}`}>Acknowledged</span>
                  <strong>
                    {reach.acknowledged} <span className={shared.muted}>of {reach.total}</span>
                  </strong>
                  <Meter value={reach.acknowledged} max={reach.total} label="Acknowledged" tone="attention" />
                </div>
              ) : null}
            </div>
            <p className={styles.receiptNote}>
              Counted per {unit === "families" ? "family — either parent or carer opening it counts" : "staff member"}.
            </p>
          </Card>
          <Card
            title={`${n.requiresAck ? "Not yet acknowledged" : "Not yet read"} (${reach.outstanding.length})`}
            padded={false}
          >
            {reach.outstanding.length ? (
              <div className={styles.outstanding}>
                <RowList label="Not yet acknowledged">
                  {reach.outstanding.map((o) => (
                    <Row key={o.key} leading={<InitialsAvatar name={o.name} size={28} />} title={o.name} meta={o.detail} />
                  ))}
                </RowList>
              </div>
            ) : (
              <p className={shared.emptyLine}>Everyone is up to date. 🎉</p>
            )}
          </Card>
        </aside>
      ) : null}
    </div>
  );
}
