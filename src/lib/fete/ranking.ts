/** Pure scoring maths shared by the server (scoring.ts) and client leaderboards. */

export type Metric = "raised" | "points";

/** Points earned by a dollar amount: whole dollars only, never negative. */
export function pointsForCents(cents: number, pointsPerDollar: number): number {
  return Math.floor(Math.max(0, cents) / 100) * pointsPerDollar;
}

export type Ranked<T> = T & { rank: number };

const metricValue = (x: { raisedCents: number; points: number }, metric: Metric) =>
  metric === "raised" ? x.raisedCents : x.points;

/**
 * Sorts highest first and assigns competition ranks (ties share a rank:
 * 1, 2, 2, 4). Ties are listed alphabetically.
 */
export function rankBy<T extends { raisedCents: number; points: number }>(
  items: readonly T[],
  metric: Metric,
  nameOf: (item: T) => string = (i) => (i as { name?: string }).name ?? "",
): Ranked<T>[] {
  const sorted = [...items].sort(
    (a, b) => metricValue(b, metric) - metricValue(a, metric) || nameOf(a).localeCompare(nameOf(b)),
  );
  let rank = 0;
  let prev: number | null = null;
  return sorted.map((item, i) => {
    const v = metricValue(item, metric);
    if (v !== prev) rank = i + 1;
    prev = v;
    return { ...item, rank };
  });
}

/** Rank of one item within a list (1 = top), or null if it isn't there. */
export function rankOf<T extends { raisedCents: number; points: number }>(
  items: readonly T[],
  metric: Metric,
  match: (item: T) => boolean,
): { rank: number; of: number } | null {
  const ranked = rankBy(items, metric, () => "");
  const found = ranked.find((r) => match(r));
  return found ? { rank: found.rank, of: ranked.length } : null;
}
