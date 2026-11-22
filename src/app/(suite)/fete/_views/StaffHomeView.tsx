"use client";

import { Label } from "@primer/react";
import NextLink from "next/link";
import { ButtonLink, EmptyState, PageTitle } from "@/components/ui";
import { formatDate, pluralise } from "@/lib/format";
import { Thermometer } from "../_components/Visuals";
import styles from "./views.module.css";

export type CampaignStatus = "draft" | "live" | "closed";

export function StatusLabel({ status }: { status: CampaignStatus }) {
  if (status === "live") return <Label variant="success">● Live</Label>;
  if (status === "draft") return <Label variant="secondary">Draft</Label>;
  return <Label variant="done">Finished</Label>;
}

type CampaignCard = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  status: CampaignStatus;
  raisedCents: number;
  goalCents: number;
  participantCount: number;
  startsAt: string;
  endsAt: string;
  timeLabel: string | null;
};

export function StaffHomeView({ campaigns }: { campaigns: CampaignCard[] }) {
  return (
    <>
      <PageTitle
        title="Fundraising"
        description="Fun runs, colour runs and readathons — every student gets their own page and QR code, and the whole school cheers on the leaderboards."
        actions={
          <ButtonLink href="/fete/campaigns/new" variant="primary" leadingIcon="plus">
            New campaign
          </ButtonLink>
        }
      />
      {campaigns.length === 0 ? (
        <EmptyState
          icon="rocket"
          title="Start your first fundraiser"
          description="Set a goal and prizes, enrol students, then print QR codes to send home. Families share their child's page and donations flow straight to the school."
          action={{ href: "/fete/campaigns/new", label: "Create a campaign" }}
        />
      ) : (
        <ul className={styles.campaignList}>
          {campaigns.map((c) => (
            <li key={c.id} className={styles.campaignCard} data-status={c.status}>
              <div className={styles.campaignHead}>
                <div className={styles.campaignTitleWrap}>
                  <NextLink href={`/fete/campaigns/${c.id}`} className={styles.campaignTitle}>
                    {c.name}
                  </NextLink>
                  <StatusLabel status={c.status} />
                </div>
                <div className={styles.muted}>
                  {formatDate(c.startsAt)} – {formatDate(c.endsAt)} · {pluralise(c.participantCount, "student")}
                  {c.timeLabel ? ` · ${c.timeLabel}` : ""}
                </div>
                {c.tagline ? <p className={styles.campaignTagline}>{c.tagline}</p> : null}
              </div>
              <Thermometer raisedCents={c.raisedCents} goalCents={c.goalCents} />
              <div className={styles.campaignActions}>
                <ButtonLink href={`/fete/campaigns/${c.id}`} variant={c.status === "live" ? "primary" : "default"} leadingIcon="graph">
                  Dashboard
                </ButtonLink>
                {c.status !== "draft" ? (
                  <ButtonLink href={`/give/${c.slug}`} variant="invisible" leadingIcon="link">
                    Public page
                  </ButtonLink>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
