/**
 * Fete visuals that need no client JavaScript, so they render from server
 * or client components alike: progress ring, thermometer, prize badges,
 * QR codes and donation lists.
 */
import type { CSSProperties } from "react";
import { formatMoney, formatRelative } from "@/lib/format";
import { percentOf, type PrizeTier } from "@/lib/fete/tiers";
import styles from "./fete.module.css";

const HOUSE_COLOURS = new Set([
  "red", "orange", "yellow", "lemon", "olive", "lime", "green", "pine", "teal", "cyan",
  "blue", "indigo", "purple", "plum", "pink", "coral", "brown", "auburn", "gray",
]);

/** CSS custom property for a house colour (Primer display colour). */
export function swatchStyle(color: string | null | undefined): CSSProperties | undefined {
  if (!color || !HOUSE_COLOURS.has(color)) return undefined;
  return { "--swatch": `var(--display-${color}-bgColor-emphasis)` } as CSSProperties;
}

export function Swatch({ color }: { color: string | null | undefined }) {
  const style = swatchStyle(color);
  return style ? <span className={styles.swatch} style={style} aria-hidden /> : null;
}

/* ---------- Progress ring ---------- */

export function ProgressRing({
  raisedCents,
  goalCents,
  size = 120,
  stroke = 12,
  caption,
}: {
  raisedCents: number;
  goalCents: number;
  size?: number;
  stroke?: number;
  caption?: string;
}) {
  const pct = percentOf(raisedCents, goalCents);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={styles.ring}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${formatMoney(raisedCents, { whole: true })} raised of a ${formatMoney(goalCents, { whole: true })} goal (${pct}%)`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className={styles.ringTrack} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className={styles.ringFill}
          data-done={pct >= 100}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div className={styles.ringLabel} aria-hidden>
        <span className={styles.ringValue} style={{ fontSize: Math.round(size / 5) }}>
          {pct}%
        </span>
        <span className={styles.ringCaption}>{caption ?? "of goal"}</span>
      </div>
    </div>
  );
}

/* ---------- Thermometer ---------- */

export function Thermometer({
  raisedCents,
  goalCents,
  size = "medium",
  label = "raised",
}: {
  raisedCents: number;
  goalCents: number;
  size?: "medium" | "large";
  label?: string;
}) {
  const pct = percentOf(raisedCents, goalCents);
  return (
    <div className={styles.thermo} data-size={size}>
      <div className={styles.thermoMeta}>
        <span>
          <span className={styles.thermoRaised}>{formatMoney(raisedCents, { whole: true })}</span> {label}
        </span>
        <span>
          {pct}% of {formatMoney(goalCents, { whole: true })}
        </span>
      </div>
      <div
        className={styles.thermoTrack}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${pct}% of the goal raised`}
      >
        <div className={styles.thermoFill} data-empty={raisedCents === 0} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- Prize tiers ---------- */

export function TierBadges({ tiers, raisedCents }: { tiers: PrizeTier[]; raisedCents: number }) {
  if (!tiers.length) return null;
  const nextId = tiers.find((t) => raisedCents < t.thresholdCents)?.id;
  return (
    <ul className={styles.tiers}>
      {tiers.map((t) => {
        const unlocked = raisedCents >= t.thresholdCents;
        const isNext = t.id === nextId;
        return (
          <li key={t.id} className={styles.tier} data-unlocked={unlocked} data-next={isNext}>
            <span className={styles.tierEmoji} aria-hidden>
              {t.emoji}
            </span>
            <span className={styles.tierName}>{t.name}</span>
            <span className={styles.tierAmount}>{formatMoney(t.thresholdCents, { whole: true })}</span>
            <span className={styles.tierStatus}>
              {unlocked ? "✓ Unlocked" : isNext ? `${formatMoney(t.thresholdCents - raisedCents, { whole: true })} to go` : "Locked"}
            </span>
            {t.description ? <span className={styles.tierAmount}>{t.description}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- QR code ---------- */

/** Renders an SVG produced server-side by `qrSvg()` (our own markup, never user input). */
export function QrCode({ svg, label, size }: { svg: string; label: string; size?: number }) {
  return (
    <span
      className={styles.qr}
      role="img"
      aria-label={label}
      style={size ? { width: size } : undefined}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/* ---------- Donation list ---------- */

export type DonationItem = {
  id: string;
  who: string;
  /** e.g. "for Mia N. (6A)" — omit on a student's own page */
  forLabel?: string | null;
  message: string | null;
  amountCents: number | null;
  createdAt: string;
  method?: "online" | "cash";
  status?: "pending" | "succeeded" | "failed";
};

const EMOJI = ["🎉", "🌈", "💛", "⭐", "🎨", "💜", "🧡", "💚"];

export function DonationList({ items, now }: { items: DonationItem[]; now: string }) {
  const nowDate = new Date(now);
  return (
    <ul className={styles.donations}>
      {items.map((d, i) => (
        <li key={d.id} className={styles.donation}>
          <span className={styles.donationIcon} aria-hidden>
            {d.method === "cash" ? "💵" : EMOJI[i % EMOJI.length]}
          </span>
          <div>
            <div className={styles.donationWho}>
              {d.who} {d.forLabel ? <span className={styles.donationFor}>{d.forLabel}</span> : null}
            </div>
            {d.message ? <p className={styles.donationMessage}>“{d.message}”</p> : null}
            <div className={styles.donationMeta}>
              {formatRelative(d.createdAt, nowDate)}
              {d.method === "cash" ? " · cash" : ""}
              {d.status && d.status !== "succeeded" ? ` · ${d.status}` : ""}
            </div>
          </div>
          {d.amountCents !== null ? <span className={styles.donationAmount}>{formatMoney(d.amountCents, { whole: true })}</span> : null}
        </li>
      ))}
    </ul>
  );
}
