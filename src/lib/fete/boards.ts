/** Turns a scoreboard into plain leaderboard rows for the <Leaderboard> component. Pure. */
import type { GroupScore, ParticipantScore, Scoreboard } from "./scoring";

export type BoardRow = {
  id: string;
  name: string;
  detail?: string;
  raisedCents: number;
  points: number;
  color?: string | null;
  highlight?: boolean;
};

export type Board = { key: string; label: string; rows: BoardRow[] };

export function groupRows(groups: GroupScore[], highlightId?: string | null, opts: { hideEmpty?: boolean } = {}): BoardRow[] {
  return groups
    .filter((g) => !opts.hideEmpty || g.participantCount > 0)
    .map((g) => ({
      id: g.id,
      name: g.type === "class" ? `Class ${g.name}` : g.name,
      raisedCents: g.raisedCents,
      points: g.points,
      color: g.color,
      highlight: highlightId ? g.id === highlightId : undefined,
    }));
}

/** Staff only: includes full student names. */
export function studentRows(participants: ParticipantScore[]): BoardRow[] {
  return participants.map((p) => ({
    id: p.participantId,
    name: `${p.preferredName ?? p.firstName} ${p.lastName}`,
    detail: p.className ?? undefined,
    raisedCents: p.raisedCents,
    points: p.points,
  }));
}

export function staffBoards(board: Scoreboard): Board[] {
  return [
    { key: "students", label: "Students", rows: studentRows(board.participants) },
    { key: "classes", label: "Classes", rows: groupRows(board.classes, null, { hideEmpty: true }) },
    { key: "years", label: "Years", rows: groupRows(board.years, null, { hideEmpty: true }) },
    { key: "houses", label: "Houses", rows: groupRows(board.houses) },
  ];
}

/** Public pages: classes and houses only — never individual children. */
export function publicBoards(board: Scoreboard): Board[] {
  return [
    { key: "classes", label: "Classes", rows: groupRows(board.classes, null, { hideEmpty: true }) },
    { key: "houses", label: "Houses", rows: groupRows(board.houses) },
  ];
}
