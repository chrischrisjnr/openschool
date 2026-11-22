"use client";

import { SegmentedControl } from "@primer/react";
import { useState } from "react";
import { formatMoney } from "@/lib/format";
import type { Board, BoardRow } from "@/lib/fete/boards";
import { rankBy, type Metric } from "@/lib/fete/ranking";
import styles from "./fete.module.css";
import { Swatch, swatchStyle } from "./Visuals";

export type { Board, BoardRow };

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * Ranked leaderboards with a switch between boards (students / classes /
 * years / houses) and between dollars raised and points.
 */
export function Leaderboard({
  boards,
  limit = 10,
  defaultMetric = "points",
  showMetricToggle = true,
  label = "Leaderboard",
}: {
  boards: Board[];
  limit?: number;
  defaultMetric?: Metric;
  showMetricToggle?: boolean;
  label?: string;
}) {
  const [boardIndex, setBoardIndex] = useState(0);
  const [metric, setMetric] = useState<Metric>(defaultMetric);
  const board = boards[boardIndex] ?? boards[0];
  if (!board) return null;

  const ranked = rankBy(board.rows, metric, (r) => r.name);
  // Always show a highlighted row (e.g. "your class") even if outside the top N.
  let shown = ranked.slice(0, limit);
  const mine = ranked.filter((r) => r.highlight && !shown.includes(r));
  shown = [...shown, ...mine];
  const max = Math.max(1, ...ranked.map((r) => (metric === "raised" ? r.raisedCents : r.points)));

  return (
    <div className={styles.board}>
      <div className={styles.boardControls}>
        {boards.length > 1 ? (
          <SegmentedControl aria-label={`${label}: choose a board`} onChange={setBoardIndex} size="small">
            {boards.map((b, i) => (
              <SegmentedControl.Button key={b.key} selected={i === boardIndex}>
                {b.label}
              </SegmentedControl.Button>
            ))}
          </SegmentedControl>
        ) : (
          <span />
        )}
        {showMetricToggle ? (
          <SegmentedControl
            aria-label={`${label}: rank by`}
            onChange={(i) => setMetric(i === 0 ? "points" : "raised")}
            size="small"
          >
            <SegmentedControl.Button selected={metric === "points"}>Points</SegmentedControl.Button>
            <SegmentedControl.Button selected={metric === "raised"}>$ raised</SegmentedControl.Button>
          </SegmentedControl>
        ) : null}
      </div>

      {shown.length ? (
        <ol className={styles.boardList} aria-label={`${board.label} ranked by ${metric === "points" ? "points" : "dollars raised"}`}>
          {shown.map((r) => {
            const value = metric === "raised" ? r.raisedCents : r.points;
            const medal = value > 0 ? MEDALS[r.rank - 1] : undefined;
            return (
              <li key={r.id} className={styles.boardRow} data-highlight={r.highlight ? "true" : undefined}>
                <span className={styles.boardRank} data-medal={medal ? "true" : undefined} aria-label={`Rank ${r.rank}`}>
                  {medal ?? r.rank}
                </span>
                <div className={styles.boardMain}>
                  <span className={styles.boardName}>
                    <Swatch color={r.color} />
                    {r.name}
                    {r.detail ? <span className={styles.boardDetail}>{r.detail}</span> : null}
                  </span>
                  <div className={styles.boardBar} aria-hidden style={swatchStyle(r.color)}>
                    <div className={styles.boardBarFill} style={{ width: `${Math.round((value / max) * 100)}%` }} />
                  </div>
                </div>
                <span className={styles.boardValue}>
                  {metric === "raised" ? formatMoney(r.raisedCents, { whole: true }) : `${r.points.toLocaleString("en-AU")} pts`}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className={styles.boardEmpty}>Nothing to show yet.</p>
      )}
    </div>
  );
}
