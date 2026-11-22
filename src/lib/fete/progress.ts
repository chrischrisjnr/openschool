/** A single student's progress, ranks and prize tiers, derived from a scoreboard. Pure. */
import { rankOf } from "./ranking";
import type { Scoreboard } from "./scoring";
import { tierProgress, type PrizeTier } from "./tiers";

export type ChildProgress = {
  participantId: string;
  code: string;
  raisedCents: number;
  goalCents: number;
  points: number;
  donationCount: number;
  pitch: string | null;
  className: string | null;
  houseName: string | null;
  houseColor: string | null;
  /** Rank among classmates, by points. */
  classRank: { rank: number; of: number } | null;
  /** Rank of the student's class among all classes, by points. */
  classPlace: { rank: number; of: number } | null;
  /** Rank of the student's house among all houses, by points. */
  housePlace: { rank: number; of: number } | null;
  currentTier: PrizeTier | null;
  nextTier: PrizeTier | null;
  toNextCents: number;
  unlockedCount: number;
};

export function childProgress(board: Scoreboard, participantId: string, tiers: PrizeTier[]): ChildProgress | null {
  const me = board.participants.find((p) => p.participantId === participantId);
  if (!me) return null;
  const classmates = board.participants.filter((p) => p.classId && p.classId === me.classId);
  const tp = tierProgress(me.raisedCents, tiers);
  return {
    participantId,
    code: me.code,
    raisedCents: me.raisedCents,
    goalCents: me.goalCents,
    points: me.points,
    donationCount: me.donationCount,
    pitch: me.pitch,
    className: me.className,
    houseName: me.houseName,
    houseColor: me.houseColor,
    // Ranks only mean something once there are points on the board.
    classRank: me.classId && me.points > 0 ? rankOf(classmates, "points", (p) => p.participantId === participantId) : null,
    classPlace:
      me.classId && (board.classes.find((c) => c.id === me.classId)?.points ?? 0) > 0
        ? rankOf(board.classes, "points", (c) => c.id === me.classId)
        : null,
    housePlace:
      me.houseId && (board.houses.find((h) => h.id === me.houseId)?.points ?? 0) > 0
        ? rankOf(board.houses, "points", (h) => h.id === me.houseId)
        : null,
    currentTier: tp.current,
    nextTier: tp.next,
    toNextCents: tp.toNextCents,
    unlockedCount: tp.unlocked.length,
  };
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
