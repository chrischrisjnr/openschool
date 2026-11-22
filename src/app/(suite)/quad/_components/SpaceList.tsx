"use client";

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SpaceSummaryDTO } from "@/lib/quad/types";
import { InitialsAvatar } from "@/components/ui/Card";
import { useConnection, useQuadEvents } from "./realtime";
import { RelativeTime } from "./time";
import styles from "./quad.module.css";

/**
 * Live unread counters: start from the server's numbers, add one for each
 * new message from someone else, and clear for the space that's open.
 */
export function useLiveUnread(spaces: SpaceSummaryDTO[]) {
  const pathname = usePathname();
  const router = useRouter();
  const { viewerId } = useConnection();
  const [counts, setCounts] = useState(() => new Map(spaces.map((s) => [s.id, s.unread])));
  const [latest, setLatest] = useState(() => new Map<string, { at: number; preview: string }>());
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // New data from the server (e.g. after navigating) wins.
  useEffect(() => {
    setCounts(new Map(spaces.map((s) => [s.id, s.unread])));
    setLatest(new Map());
  }, [spaces]);

  const activeId = pathname.match(/^\/quad\/s\/([^/]+)/)?.[1] ?? null;
  useEffect(() => {
    if (!activeId) return;
    setCounts((c) => (c.get(activeId) ? new Map(c).set(activeId, 0) : c));
  }, [activeId]);

  useQuadEvents((event) => {
    if (event.type === "read" && event.userId === viewerId) {
      setCounts((c) => new Map(c).set(event.spaceId, 0));
      return;
    }
    if (event.type !== "message" || event.message.parentId) return;
    const known = spaces.some((s) => s.id === event.spaceId);
    if (!known) {
      // Someone started a conversation with us: fetch the new list.
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 800);
      return;
    }
    const m = event.message;
    const who = m.author.id === viewerId ? "You" : m.author.name.split(" ")[0];
    setLatest((l) => new Map(l).set(event.spaceId, { at: m.createdAt, preview: `${who}: ${m.body}` }));
    if (m.author.id === viewerId || event.spaceId === activeId) return;
    setCounts((c) => new Map(c).set(event.spaceId, (c.get(event.spaceId) ?? 0) + 1));
  });

  return useMemo(
    () =>
      spaces.map((s) => {
        const live = latest.get(s.id);
        return {
          ...s,
          unread: counts.get(s.id) ?? 0,
          lastMessageAt: live?.at ?? s.lastMessageAt,
          preview: live?.preview ?? s.preview,
          active: s.id === activeId,
        };
      }),
    [spaces, counts, latest, activeId],
  );
}

type LiveSpace = ReturnType<typeof useLiveUnread>[number];

const GROUPS: { title: string; match: (s: SpaceSummaryDTO) => boolean }[] = [
  { title: "School", match: (s) => s.kind === "announcements" || s.kind === "school" },
  { title: "Classes & year levels", match: (s) => s.kind === "class" || s.kind === "year" },
  { title: "Groups", match: (s) => s.kind === "group" },
  { title: "Direct messages", match: (s) => s.kind === "direct" },
];

function SpaceIcon({ space, size = 28 }: { space: SpaceSummaryDTO; size?: number }) {
  if (space.kind === "direct" && space.people?.length) {
    return <InitialsAvatar name={space.people[0]!.name} size={size} />;
  }
  return (
    <span className={styles.spaceEmoji} style={{ width: size, height: size, fontSize: Math.round(size * 0.55) }} aria-hidden>
      {space.emoji}
    </span>
  );
}

function unreadLabel(n: number) {
  return n === 1 ? "1 unread message" : `${n > 99 ? "99+" : n} unread messages`;
}

/** Compact list for the desktop sidebar. */
export function SidebarSpaces({ spaces }: { spaces: SpaceSummaryDTO[] }) {
  const live = useLiveUnread(spaces);
  return (
    <nav aria-label="Your spaces" className={styles.sidebarSpaces}>
      {GROUPS.map((g) => {
        let items = live.filter(g.match);
        if (g.title === "Direct messages") items = items.slice(0, 6);
        if (!items.length) return null;
        return (
          <div key={g.title} className={styles.sidebarGroup}>
            <h2 className={styles.sidebarHeading}>{g.title}</h2>
            <ul className={styles.sidebarList}>
              {items.map((s) => (
                <li key={s.id}>
                  <NextLink
                    href={s.href}
                    className={styles.sidebarItem}
                    aria-current={s.active ? "page" : undefined}
                    data-unread={s.unread > 0 || undefined}
                  >
                    <SpaceIcon space={s} size={22} />
                    <span className={styles.sidebarName}>{s.name}</span>
                    {s.unread > 0 ? (
                      <span className={styles.unreadPill} aria-label={unreadLabel(s.unread)}>
                        {s.unread > 99 ? "99+" : s.unread}
                      </span>
                    ) : null}
                  </NextLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** Roomy list for the Quad home page (and the only list on phones). */
export function SpaceCards({
  spaces,
  kinds,
  emptyText,
}: {
  spaces: SpaceSummaryDTO[];
  kinds?: SpaceSummaryDTO["kind"][];
  emptyText?: string;
}) {
  const live = useLiveUnread(spaces);
  const shown = kinds ? live.filter((s) => kinds.includes(s.kind)) : live;
  const groups = GROUPS.map((g) => ({ ...g, items: shown.filter(g.match) })).filter((g) => g.items.length);
  if (!shown.length) return emptyText ? <p className={styles.muted}>{emptyText}</p> : null;
  return (
    <div className={styles.spaceCards}>
      {groups.map((g) => (
        <section key={g.title} aria-labelledby={`sg-${g.title}`}>
          {groups.length > 1 ? (
            <h3 id={`sg-${g.title}`} className={styles.groupHeading}>
              {g.title}
            </h3>
          ) : null}
          <ul className={styles.cardList}>
            {g.items.map((s) => (
              <SpaceRow key={s.id} space={s} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SpaceRow({ space }: { space: LiveSpace }) {
  return (
    <li>
      <NextLink href={space.href} className={styles.spaceRow} data-unread={space.unread > 0 || undefined}>
        <SpaceIcon space={space} size={40} />
        <span className={styles.spaceRowText}>
          <span className={styles.spaceRowTop}>
            <span className={styles.spaceRowName}>{space.name}</span>
            {space.lastMessageAt ? (
              <span className={styles.spaceRowTime}>
                <RelativeTime at={space.lastMessageAt} short />
              </span>
            ) : null}
          </span>
          <span className={styles.spaceRowBottom}>
            <span className={styles.spaceRowPreview}>{space.preview ?? space.description ?? "No messages yet"}</span>
            {space.unread > 0 ? (
              <span className={styles.unreadPill} aria-label={unreadLabel(space.unread)}>
                {space.unread > 99 ? "99+" : space.unread}
              </span>
            ) : null}
          </span>
        </span>
      </NextLink>
    </li>
  );
}
