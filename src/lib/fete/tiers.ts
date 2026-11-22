/** Prize tiers: which rewards a student has unlocked, and what's next. Pure. */

export type PrizeTier = {
  id: string;
  name: string;
  emoji: string;
  thresholdCents: number;
  description: string | null;
};

export type TierProgress = {
  unlocked: PrizeTier[];
  /** The highest tier reached, if any. */
  current: PrizeTier | null;
  next: PrizeTier | null;
  /** Cents still needed to reach `next` (0 when every tier is unlocked). */
  toNextCents: number;
};

export function sortTiers<T extends { thresholdCents: number }>(tiers: readonly T[]): T[] {
  return [...tiers].sort((a, b) => a.thresholdCents - b.thresholdCents);
}

export function tierProgress(raisedCents: number, tiers: readonly PrizeTier[]): TierProgress {
  const sorted = sortTiers(tiers);
  const unlocked = sorted.filter((t) => raisedCents >= t.thresholdCents);
  const next = sorted.find((t) => raisedCents < t.thresholdCents) ?? null;
  return {
    unlocked,
    current: unlocked.at(-1) ?? null,
    next,
    toNextCents: next ? next.thresholdCents - raisedCents : 0,
  };
}

/** 0–100, capped. Goals of 0 count as reached. */
export function percentOf(raisedCents: number, goalCents: number): number {
  if (goalCents <= 0) return 100;
  return Math.min(100, Math.floor((raisedCents / goalCents) * 100));
}
