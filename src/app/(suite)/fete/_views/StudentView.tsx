"use client";

import { EmptyState } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format";
import { ordinal, type ChildProgress } from "@/lib/fete/progress";
import { displayUrl } from "@/lib/fete/share";
import { percentOf, type PrizeTier } from "@/lib/fete/tiers";
import { Leaderboard, type BoardRow } from "../_components/Leaderboard";
import { DonationList, ProgressRing, QrCode, TierBadges, type DonationItem } from "../_components/Visuals";
import styles from "./views.module.css";

export type StudentData = {
  firstName: string;
  campaign: { name: string; tagline: string | null; cause: string | null; timeLabel: string; status: string };
  progress: ChildProgress;
  tiers: PrizeTier[];
  studentUrl: string;
  qr: string;
  supporters: DonationItem[];
  classBoard: BoardRow[];
  houseBoard: BoardRow[];
};

function cheer(pct: number) {
  if (pct >= 100) return "You smashed your goal! 🎉";
  if (pct >= 75) return "Nearly there — keep going! 🚀";
  if (pct >= 40) return "You're doing amazing! ⭐";
  if (pct > 0) return "Great start! 🌱";
  return "Ask a grown-up to share your page! 📣";
}

/** The kid-friendly "My fundraising" page for students. */
export function StudentView({ data, now }: { data: StudentData | null; now?: string }) {
  if (!data) {
    return (
      <>
        <h1 className="sr-only">My fundraising</h1>
        <EmptyState icon="star" title="No fundraiser right now" description="When your school starts a colour run or fun run, your page will be here!" />
      </>
    );
  }
  const p = data.progress;
  const pct = percentOf(p.raisedCents, p.goalCents);

  return (
    <div className={styles.stack}>
      <section className={styles.kidHero}>
        <h1 className={styles.kidHello}>Hi {data.firstName}! 👋</h1>
        <div className={styles.progressPanel}>
          <ProgressRing raisedCents={p.raisedCents} goalCents={p.goalCents} size={150} stroke={16} caption="of your goal" />
          <div>
            <div className={styles.muted}>You’ve raised</div>
            <div className={styles.kidRaised}>{formatMoney(p.raisedCents, { whole: true })}</div>
            <p className={styles.kidLine}>{cheer(pct)}</p>
            <div className={styles.muted}>
              Your goal: {formatMoney(p.goalCents, { whole: true })} · {data.campaign.name} · {data.campaign.timeLabel}
            </div>
          </div>
        </div>
      </section>

      <div className={styles.kidStats}>
        <div className={styles.kidStat}>
          <div className={styles.kidStatEmoji} aria-hidden>⚡</div>
          <div className={styles.kidStatValue}>{p.points.toLocaleString("en-AU")}</div>
          <div className={styles.kidStatLabel}>points</div>
        </div>
        <div className={styles.kidStat}>
          <div className={styles.kidStatEmoji} aria-hidden>💌</div>
          <div className={styles.kidStatValue}>{p.donationCount}</div>
          <div className={styles.kidStatLabel}>{p.donationCount === 1 ? "supporter" : "supporters"}</div>
        </div>
        <div className={styles.kidStat}>
          <div className={styles.kidStatEmoji} aria-hidden>🏫</div>
          <div className={styles.kidStatValue}>{p.classPlace ? ordinal(p.classPlace.rank) : "—"}</div>
          <div className={styles.kidStatLabel}>{p.className ?? "Your class"} on the leaderboard</div>
        </div>
        <div className={styles.kidStat}>
          <div className={styles.kidStatEmoji} aria-hidden>🏠</div>
          <div className={styles.kidStatValue}>{p.housePlace ? ordinal(p.housePlace.rank) : "—"}</div>
          <div className={styles.kidStatLabel}>{p.houseName ?? "Your house"} house</div>
        </div>
      </div>

      {data.tiers.length ? (
        <Card title="Your prizes">
          <div className={styles.stackSmall}>
            <p className={styles.kidLine}>
              {p.nextTier
                ? `${formatMoney(p.toNextCents, { whole: true })} more to unlock ${p.nextTier.emoji} ${p.nextTier.name}!`
                : "You unlocked every prize! 🦄"}
            </p>
            <TierBadges tiers={data.tiers} raisedCents={p.raisedCents} />
          </div>
        </Card>
      ) : null}

      <div className={styles.twoCol}>
        <Card title="🏫 Class leaderboard">
          <Leaderboard boards={[{ key: "classes", label: "Classes", rows: data.classBoard }]} limit={20} label="Classes" />
        </Card>
        <Card title="🏠 House leaderboard">
          <Leaderboard boards={[{ key: "houses", label: "Houses", rows: data.houseBoard }]} label="Houses" />
        </Card>
      </div>

      <div className={styles.twoCol}>
        <Card title="💌 Your supporters">
          {data.supporters.length ? (
            <DonationList items={data.supporters} now={now ?? new Date().toISOString()} />
          ) : (
            <p className={styles.muted}>No supporters yet — your first one is coming!</p>
          )}
        </Card>
        <Card title="📱 Your QR code">
          <div className={styles.qrPanel}>
            <div className={styles.qrBox}>
              <QrCode svg={data.qr} label={`QR code for ${data.firstName}'s sponsorship page`} />
            </div>
            <p className={styles.muted}>Show this to family and friends — they can scan it to sponsor you!</p>
            <span className={styles.muted}>{displayUrl(data.studentUrl)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
