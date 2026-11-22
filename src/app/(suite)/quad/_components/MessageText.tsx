"use client";

import type { ReactNode } from "react";
import styles from "./chat/chat.module.css";

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING = /[.,!?;:'"\]]+$/;

/** Returns a safe http(s) URL for a candidate link, or null. */
export function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw.startsWith("www.") ? `https://${raw}` : raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Splits a URL match from trailing punctuation, keeping balanced brackets. */
function trimMatch(match: string): [string, string] {
  let url = match;
  let rest = "";
  const t = url.match(TRAILING);
  if (t) {
    rest = t[0];
    url = url.slice(0, -rest.length);
  }
  while (url.endsWith(")") && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) {
    url = url.slice(0, -1);
    rest = `)${rest}`;
  }
  return [url, rest];
}

/**
 * Plain text with web links turned into links. Text is rendered by React (so
 * it is always escaped) — messages can never inject HTML.
 */
export function MessageText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const [url, rest] = trimMatch(m[0]);
    const href = safeHref(url);
    if (!href) continue;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <a key={start} href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className={styles.link}>
        {url}
      </a>,
    );
    last = start + url.length;
    if (rest) {
      parts.push(rest);
      last += rest.length;
    }
  }
  if (last < text.length) parts.push(text.slice(last));
  return <div className={styles.messageText}>{parts}</div>;
}
