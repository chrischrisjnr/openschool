"use client";

import { Label } from "@primer/react";
import { ButtonLink, EmptyState, PageTitle } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { formatMoney, formatLongDate } from "@/lib/format";
import { ordinal, type ChildProgress } from "@/lib/fete/progress";
import type { PrizeTier } from "@/lib/fete/tiers";
import { ProgressRing, Swatch, Thermometer } from "../_components/Visuals";
import styles from "./views.module.css";

export type FamilyChild = {
  participantId: string;
  firstName: string;
  detail: string;
  publicPath: string;
  progress: ChildProgress;
};

export type FamilyCampaign = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  cause: string | null;
  status: "draft" | "live" | "closed";
  eventDate: string | null;
  timeLabel: string;
  raisedCents: number;
  goalCents: number;
  publicPath: string;
  campaignUrl: string;
  tiers: PrizeTier[];
  children: FamilyChild[];
};

const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

export function FamilyHomeView({
  firstNames,
  schoolName,
  campaigns,
}: {
  firstNames: string[];
  schoolName: string;
  campaigns: FamilyCampaign[];
}) {
  const live = campaigns.filter((c) => c.status === "live");
  const past = campaigns.filter((c) => c.status === "closed");

  return (
    <>
      <PageTitle
        title="Fundraising"
        description={
          live.length
            ? `Help ${joinNames(firstNames)} raise money for ${schoolName}. Share their page with family and friends — every dollar earns points for their class and house.`
            : `School fundraisers for ${joinNames(firstNames)} will appear here.`
        }
      />

      <div className={styles.stack}>
        {live.length === 0 ? (
          <EmptyState
            icon="gift"
            title="No fundraiser running right now"
            description="When the school starts a colour run, fun run or readathon, your children's sponsorship pages and QR codes will be here."
          />
        ) : null}

        {live.map((c) => (
          <section key={c.id} className={styles.stack} aria-labelledby={`c-${c.id}`}>
            <div className={styles.hero}>
              <div className={styles.heroTop}>
                <div>
                  <h2 id={`c-${c.id}`} className={styles.heroName}>
                    🌈 {c.name}
                  </h2>
                  {c.tagline ? <p className={styles.heroTagline}>{c.tagline}</p> : null}
                </div>
                <Label variant="severe" size="large">
                  {c.timeLabel}
                </Label>
              </div>
              {c.cause ? (
                <span className={styles.cause}>
                  🎯 Raising money for <strong>{c.cause}</strong>
                </span>
              ) : null}
              <Thermometer raisedCents={c.raisedCents} goalCents={c.goalCents} label="raised by the whole school" />
              {c.eventDate ? <span className={styles.muted}>Event day: {formatLongDate(`${c.eventDate}T12:00:00+10:00`)}</span> : null}
            </div>

            <div className={styles.childGrid}>
              {c.children.map((child) => (
                <ChildCard key={child.participantId} child={child} />
              ))}
            </div>
          </section>
        ))}

        {past.length ? (
          <Card title="Past fundraisers">
            <ul className={styles.pastList}>
              {past.flatMap((c) =>
                c.children.map((child) => (
                  <li key={child.participantId} className={styles.pastItem}>
                    <span>
                      <strong>{c.name}</strong> · {child.firstName}
                    </span>
                    <span>
                      {child.progress.currentTier ? `${child.progress.currentTier.emoji} ` : ""}
                      {formatMoney(child.progress.raisedCents, { whole: true })} raised · {child.progress.points.toLocaleString("en-AU")} pts
                    </span>
                  </li>
                )),
              )}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function ChildCard({ child }: { child: FamilyChild }) {
  const p = child.progress;
  return (
    <article className={styles.childCard} aria-label={child.firstName}>
      <div className={styles.childTop}>
        <ProgressRing raisedCents={p.raisedCents} goalCents={p.goalCents} size={104} stroke={11} />
        <div>
          <h3 className={styles.childName}>{child.firstName}</h3>
          <div className={styles.muted}>{child.detail}</div>
          <div className={styles.childRaised}>{formatMoney(p.raisedCents, { whole: true })}</div>
          <div className={styles.muted}>of {formatMoney(p.goalCents, { whole: true })} goal</div>
        </div>
      </div>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>Points</dt>
          <dd>{p.points.toLocaleString("en-AU")}</dd>
        </div>
        <div className={styles.fact}>
          <dt>In {p.className ?? "class"}</dt>
          <dd>{p.classRank ? ordinal(p.classRank.rank) : "—"}</dd>
        </div>
        <div className={styles.fact}>
          <dt>
            <Swatch color={p.houseColor} /> {p.houseName ?? "House"}
          </dt>
          <dd>{p.housePlace ? `${ordinal(p.housePlace.rank)} of ${p.housePlace.of}` : "—"}</dd>
        </div>
      </dl>
      <p className={styles.nextTier}>
        {p.nextTier
          ? `${p.currentTier ? `${p.currentTier.emoji} ${p.currentTier.name} unlocked! ` : ""}Just ${formatMoney(p.toNextCents, { whole: true })} more to unlock ${p.nextTier.emoji} ${p.nextTier.name}.`
          : p.currentTier
            ? `${p.currentTier.emoji} Every prize unlocked — what a superstar!`
            : "Share the link to get the first donation rolling!"}
      </p>
      <div className={styles.row}>
        <ButtonLink href={`/fete/child/${child.participantId}`} variant="primary" leadingIcon="share">
          Share {child.firstName}’s page
        </ButtonLink>
        <ButtonLink href={`${child.publicPath}#donate`} leadingIcon="heart">
          Donate
        </ButtonLink>
      </div>
    </article>
  );
}
