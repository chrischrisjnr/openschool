import type { Scoreboard } from "@/lib/fete/scoring";

export type ParticipantOption = { id: string; label: string; group: string };

/** Participants as select options, grouped by class (staff only — full names). */
export function participantOptions(board: Scoreboard): ParticipantOption[] {
  return [...board.participants]
    .sort((a, b) => a.yearLevel - b.yearLevel || (a.className ?? "").localeCompare(b.className ?? "") || a.firstName.localeCompare(b.firstName))
    .map((p) => ({
      id: p.participantId,
      label: `${p.preferredName ?? p.firstName} ${p.lastName}`,
      group: p.className ? `Class ${p.className}` : "No class",
    }));
}
