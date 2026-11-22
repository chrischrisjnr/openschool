import type { Metadata } from "next";
import { searchMessages } from "@/lib/quad/search";
import { getViewer } from "@/lib/viewer";
import { SearchView } from "./SearchView";

export const metadata: Metadata = { title: "Search · Quad" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const viewer = await getViewer();
  const query = String(q).slice(0, 100);
  return <SearchView query={query} results={searchMessages(viewer, query)} />;
}
