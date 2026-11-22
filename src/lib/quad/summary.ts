import "server-only";
import type { SummaryProvider } from "@/lib/summary";
import { openReportCount, listMySpaces } from "./spaces";

/** Home-page summary for Quad: unread messages in spaces and DMs. */
export const quadSummary: SummaryProvider = (viewer) => {
  const spaces = listMySpaces(viewer);
  const unreadSpaces = spaces.filter((s) => s.kind !== "direct" && s.unread > 0);
  const unreadDms = spaces.filter((s) => s.kind === "direct" && s.unread > 0);
  const highlights: { label: string; count: number; tone?: "accent" | "attention" | "danger" | "success" }[] = [];

  const messages = unreadSpaces.reduce((n, s) => n + s.unread, 0);
  if (messages) highlights.push({ label: messages === 1 ? "new message" : "new messages", count: messages, tone: "accent" });
  const dms = unreadDms.reduce((n, s) => n + s.unread, 0);
  if (dms) highlights.push({ label: dms === 1 ? "direct message" : "direct messages", count: dms, tone: "attention" });
  if (viewer.isStaff) {
    const reports = openReportCount(viewer.schoolId);
    if (reports) highlights.push({ label: reports === 1 ? "report to review" : "reports to review", count: reports, tone: "danger" });
  }

  const busiest = [...unreadSpaces].sort((a, b) => b.unread - a.unread)[0];
  const text = busiest
    ? `Most active: ${busiest.emoji} ${busiest.name}`
    : spaces.length
      ? "You're all caught up."
      : undefined;
  return { highlights, text };
};
