import "server-only";
import type { Viewer } from "./viewer";

/**
 * Each app contributes a short summary to the Open Schools home page,
 * e.g. "2 notices to read · 1 payment due". Highlights render as small
 * coloured counters; keep `text` short and friendly.
 */
export type HomeSummary = {
  highlights: { label: string; count: number; tone?: "accent" | "attention" | "danger" | "success" }[];
  /** One line of context, e.g. the next calendar event. */
  text?: string;
};

export type SummaryProvider = (viewer: Viewer) => HomeSummary | Promise<HomeSummary>;
