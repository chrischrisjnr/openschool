import "server-only";
import type { SummaryProvider } from "@/lib/summary";

/** Home-page summary for FETE. TODO: implemented by the FETE app. */
export const feteSummary: SummaryProvider = () => ({ highlights: [] });
