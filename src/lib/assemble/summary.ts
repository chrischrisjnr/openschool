import "server-only";
import type { HomeSummary, SummaryProvider } from "@/lib/summary";
import { classesTaughtBy } from "./access";
import { notesAwaitingReview, rollProgress } from "./attendance";
import { upcomingEvents } from "./calendar";
import { familyCharges } from "./charges";
import { isWeekend, todayKey } from "./dates";
import { formatEventWhen } from "./format-event";
import { unreadNoticeCount } from "./notices";

/** Home-page card for Assemble: what needs doing, and what's next. */
export const assembleSummary: SummaryProvider = (viewer) => {
  const tz = viewer.school.timezone;
  const today = todayKey(tz);
  const highlights: HomeSummary["highlights"] = [];

  const unread = unreadNoticeCount(viewer);
  if (unread) highlights.push({ label: unread === 1 ? "notice to read" : "notices to read", count: unread, tone: "accent" });

  if (viewer.isStaff) {
    const mine = classesTaughtBy(viewer.id);
    const notes = notesAwaitingReview(viewer.schoolId, viewer.isAdmin && !mine.length ? undefined : mine.map((c) => c.id));
    if (notes.length) highlights.push({ label: notes.length === 1 ? "absence note to review" : "absence notes to review", count: notes.length, tone: "attention" });
    if (mine.length && !isWeekend(today)) {
      const progress = rollProgress(mine.map((c) => c.id), today);
      const unmarked = mine.filter((c) => (progress.get(c.id)?.marked ?? 0) === 0).length;
      if (unmarked) highlights.push({ label: unmarked === 1 ? "roll to mark today" : "rolls to mark today", count: unmarked, tone: "danger" });
    }
  } else {
    const charges = familyCharges(viewer).filter((c) => c.needsAction);
    const consent = charges.filter((c) => c.requiresConsent && c.consent === "pending").length;
    const pay = charges.filter((c) => c.payable).length;
    if (consent) highlights.push({ label: consent === 1 ? "permission form to sign" : "permission forms to sign", count: consent, tone: "attention" });
    if (pay) highlights.push({ label: pay === 1 ? "payment due" : "payments due", count: pay, tone: "danger" });
  }

  const next = upcomingEvents(viewer, 30).find((e) => e.startDay >= today);
  return {
    highlights,
    text: next ? `Next up: ${next.title} — ${formatEventWhen(next, tz)}` : undefined,
  };
};
