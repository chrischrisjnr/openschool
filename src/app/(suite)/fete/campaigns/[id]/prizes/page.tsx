import type { Metadata } from "next";
import { formatMoney } from "@/lib/format";
import { requireStaffCampaign } from "@/lib/fete/access";
import { getTiers, scoreboard } from "@/lib/fete/queries";
import { tierProgress } from "@/lib/fete/tiers";
import { ButtonLink } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { PrintButton } from "../../../_components/PrintButton";
import styles from "../campaign.module.css";

export const metadata: Metadata = { title: "Prize list" };
export const dynamic = "force-dynamic";

/** Printable prize fulfilment list: who reached which tier, by class. */
export default async function PrizesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { campaign } = await requireStaffCampaign(id);
  const tiers = getTiers(campaign.id);
  const board = scoreboard(campaign.id);

  if (!tiers.length) {
    return (
      <Card title="Prize list">
        <div className={styles.stackSmall}>
          <p className={styles.muted}>This campaign has no prize tiers yet.</p>
          <div>
            <ButtonLink href={`/fete/campaigns/${campaign.id}/settings`} leadingIcon="gift">
              Add prize tiers
            </ButtonLink>
          </div>
        </div>
      </Card>
    );
  }

  const winners = board.participants
    .map((p) => ({ p, progress: tierProgress(p.raisedCents, tiers) }))
    .filter((w) => w.progress.unlocked.length > 0);
  const classes = board.classes
    .map((c) => ({
      ...c,
      winners: winners
        .filter((w) => w.p.classId === c.id)
        .sort((a, b) => b.p.raisedCents - a.p.raisedCents || a.p.firstName.localeCompare(b.p.firstName)),
    }))
    .filter((c) => c.winners.length);

  return (
    <div className={`${styles.stack} ${styles.printRoot}`}>
      <div className={`${styles.sheetToolbar} ${styles.noPrint}`}>
        <p className={styles.muted} style={{ margin: 0 }}>
          Students receive every prize up to the highest tier they reached. Print one page per class and tick prizes off as they’re handed out.
        </p>
        <PrintButton label="Print prize list" />
      </div>

      <h2 className={styles.printOnly} style={{ margin: 0 }}>
        {campaign.name} — prize list
      </h2>

      <div className={styles.tierSummary}>
        {tiers.map((t) => (
          <div key={t.id} className={styles.tierCount}>
            <div className={styles.tierCountEmoji} aria-hidden>
              {t.emoji}
            </div>
            <div className={styles.tierCountNum}>{winners.filter((w) => w.p.raisedCents >= t.thresholdCents).length}</div>
            <div className={styles.muted}>
              {t.name} · {formatMoney(t.thresholdCents, { whole: true })}+
            </div>
            {t.description ? <div className={styles.muted}>{t.description}</div> : null}
          </div>
        ))}
      </div>

      {classes.length === 0 ? <p className={styles.muted}>No student has reached a prize tier yet.</p> : null}

      {classes.map((c) => (
        <section key={c.id} className={styles.classBlock} aria-labelledby={`prize-${c.id}`}>
          <h3 id={`prize-${c.id}`} className={styles.classTitle}>
            Class {c.name} <span className={styles.muted}>· {c.winners.length} with prizes</span>
          </h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th className={styles.num}>Raised</th>
                  <th>Highest tier</th>
                  <th>Prizes to hand out</th>
                  <th>Given</th>
                </tr>
              </thead>
              <tbody>
                {c.winners.map(({ p, progress }) => (
                  <tr key={p.participantId}>
                    <td>
                      {p.preferredName ?? p.firstName} {p.lastName}
                    </td>
                    <td className={styles.num}>{formatMoney(p.raisedCents, { whole: true })}</td>
                    <td className={styles.nowrap}>
                      {progress.current!.emoji} {progress.current!.name}
                    </td>
                    <td>{progress.unlocked.map((t) => `${t.emoji} ${t.description ?? t.name}`).join(", ")}</td>
                    <td>
                      <span className={styles.tickBox} aria-label="Not yet given" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
