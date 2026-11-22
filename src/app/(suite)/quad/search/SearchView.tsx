"use client";

import { SearchIcon } from "@primer/octicons-react";
import { Button, FormControl, TextInput } from "@primer/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { EmptyState, PageTitle } from "@/components/ui";
import { InitialsAvatar } from "@/components/ui/Card";
import type { SearchResult } from "@/lib/quad/search";
import { RoleBadge } from "../_components/chat/MessageItem";
import { RelativeTime } from "../_components/time";
import styles from "../_components/quad.module.css";

/** Highlights each match of `query` (case-insensitive) — text only, no HTML. */
function highlight(text: string, query: string): ReactNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [text];
  const out: ReactNode[] = [];
  const lower = text.toLowerCase();
  let i = 0;
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, i)) {
    if (at > i) out.push(text.slice(i, at));
    out.push(
      <mark key={at} className={styles.mark}>
        {text.slice(at, at + q.length)}
      </mark>,
    );
    i = at + q.length;
  }
  out.push(text.slice(i));
  return out;
}

/** Trims long messages to a window around the first match. */
function excerpt(text: string, query: string): string {
  const flat = text.replace(/\s+/g, " ");
  const at = flat.toLowerCase().indexOf(query.trim().toLowerCase());
  if (flat.length <= 220 || at < 80) return flat.length > 220 ? `${flat.slice(0, 220)}…` : flat;
  return `…${flat.slice(at - 60, at + 160)}…`;
}

export function SearchView({ query, results }: { query: string; results: SearchResult[] }) {
  return (
    <div className={styles.narrow}>
      <PageTitle title="Search messages" description="Search everything in the spaces and conversations you can see." />
      <form action="/quad/search" role="search" className={styles.searchForm}>
        <FormControl>
          <FormControl.Label visuallyHidden>Search messages</FormControl.Label>
          <TextInput
            name="q"
            defaultValue={query}
            leadingVisual={SearchIcon}
            placeholder="e.g. hat, excursion, BBQ"
            block
            size="large"
            autoFocus={!query}
            type="search"
          />
        </FormControl>
        <Button type="submit" size="large" variant="primary">
          Search
        </Button>
      </form>

      {query.trim().length >= 2 ? (
        results.length ? (
          <>
            <p className={styles.lead}>
              {results.length === 1 ? "1 message" : `${results.length}${results.length === 50 ? "+" : ""} messages`} mentioning “{query}”
            </p>
            <ul className={styles.results}>
              {results.map(({ message, space }) => (
                <li key={message.id}>
                  <NextLink href={`${space.href}?m=${message.id}`} className={styles.activityItem}>
                    <InitialsAvatar name={message.author.name} size={32} />
                    <span className={styles.activityText}>
                      <span className={styles.activityMeta}>
                        <span className={styles.activityAuthor}>{message.author.name}</span>
                        <RoleBadge badge={message.author.badge} />
                        <span>
                          in {space.emoji} {space.name}
                          {message.parentId ? " (thread)" : ""} · <RelativeTime at={message.createdAt} short />
                        </span>
                      </span>
                      <span className={styles.activityBody}>{highlight(excerpt(message.body, query), query)}</span>
                    </span>
                  </NextLink>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState icon="search" title={`Nothing found for “${query}”`} description="Try a different word, or check the spelling." />
        )
      ) : query ? (
        <p className={styles.muted}>Type at least two letters.</p>
      ) : null}
    </div>
  );
}
