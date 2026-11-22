import "server-only";
import type { SummaryProvider } from "@/lib/summary";

/** Home-page summary for Fete. TODO: implemented by the Fete app. */
export const feteSummary: SummaryProvider = () => ({ highlights: [] });
