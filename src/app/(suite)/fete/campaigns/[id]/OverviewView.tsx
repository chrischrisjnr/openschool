"use client";

import { Banner } from "@primer/react";
import NextLink from "next/link";
import { ButtonLink } from "@/components/ui";
import { Card, Stat } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format";
import type { Board } from "@/lib/fete/boards";
import type { CampaignTotals } from "@/lib/fete/scoring";
import { Leaderboard } from "../../_components/Leaderboard";
import { DonationList, Thermometer, type DonationItem } from "../../_components/Visuals";
import styles from "./campaign.module.css";

export function OverviewView({
  campaign,
  totals: t,
  boards,
  hasTiers,
  tierReach,
  recent,
  now,
}: {
  campaign: { id: string; slug: string; status: "draft" | "live" | "closed"; goalCents: number };
  totals: CampaignTotals;
  boards: Board[];
  hasTiers: boolean;
  tierReach: { id: string; emoji: string; name: string; count: number }[];
  recent: DonationItem[];
  now: string;
}) {
  const base = `/fete/campaigns/${campaign.id}`;
  const steps = [
    { done: hasTiers, label: "Add prize tiers", href: `${base}/settings` },
    { done: t.participantCount > 0, label: "Enrol students", href: `${base}/participants` },
    { done: false, label: "Print QR sheets for each class", href: `${base}/qr` },
  ];

  return (
    <div className={styles.stack}>
      {campaign.status === "draft" ? (
        <Banner
          variant="info"
          title="This campaign is a draft"
          description={
            <>
              Families can’t see it yet. When you’re ready, press <strong>Go live</strong> and the public page opens for donations.
              <ul className={styles.checklist} style={{ marginTop: "var(--base-size-8)" }}>
                {steps.map((s) => (
                  <li key={s.label} className={styles.checkItem} data-done={s.done}>
                    {s.done ? "✅" : "⬜"} <NextLink href={s.href}>{s.label}</NextLink>
                  </li>
                ))}
              </ul>
            </>
          }
        />
      ) : null}

      <div className={styles.overviewTop}>
        <Card>
          <div className={styles.raisedCard}>
            <Thermometer raisedCents={t.raisedCents} goalCents={campaign.goalCents} size="large" />
            <div className={styles.split}>
              <span className={styles.muted}>
                Online {formatMoney(t.onlineCents, { whole: true })} · Cash {formatMoney(t.cashCents, { whole: true })} · General {formatMoney(t.generalCents, { whole: true })}
              </span>
            </div>
            <div className={styles.row}>
              <ButtonLink href={`${base}/donations#record`} leadingIcon="plus" size="small">
                Record cash
              </ButtonLink>
              <ButtonLink href={`${base}/points`} leadingIcon="star" size="small">
                Award points
              </ButtonLink>
              <ButtonLink href={`${base}/qr`} leadingIcon="mobile" size="small">
                QR sheets
              </ButtonLink>
            </div>
          </div>
        </Card>
        <div className={styles.statGrid}>
          <Stat label="Donors" value={t.donorCount.toLocaleString("en-AU")} hint={`${t.donationCount} donations`} />
          <Stat label="Average gift" value={formatMoney(t.averageCents, { whole: true })} />
          <Stat
            label="Students with donations"
            value={`${t.activeParticipantCount}/${t.participantCount}`}
            hint={t.participantCount ? `${Math.round((t.activeParticipantCount / t.participantCount) * 100)}% of enrolled` : "Nobody enrolled yet"}
          />
          <Stat
            label="Prize reached"
            value={tierReach.length ? `${tierReach[0]!.count}` : "—"}
            hint={tierReach.length ? `${tierReach[0]!.emoji} ${tierReach[0]!.name} or better` : "No prize tiers"}
            tone="success"
          />
        </div>
      </div>

      <div className={styles.main2}>
        <Card title="Leaderboards">
          <Leaderboard boards={boards} limit={10} />
        </Card>
        <Card
          title="Latest donations"
          action={
            <NextLink href={`${base}/donations`} className={styles.muted}>
              See all
            </NextLink>
          }
        >
          {recent.length ? <DonationList items={recent} now={now} /> : <p className={styles.muted}>No donations yet.</p>}
        </Card>
      </div>
    </div>
  );
}
