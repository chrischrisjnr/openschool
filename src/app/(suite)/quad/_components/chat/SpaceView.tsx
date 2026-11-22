"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  GearIcon,
  KebabHorizontalIcon,
  MailIcon,
  PinIcon,
  SignOutIcon,
  XIcon,
} from "@primer/octicons-react";
import { ActionList, ActionMenu, Button, IconButton, useConfirm } from "@primer/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { InitialsAvatar } from "@/components/ui/Card";
import type { SpaceKind } from "@/db/schema";
import type { MessageDTO, PersonDTO } from "@/lib/quad/types";
import {
  deleteMessage,
  editMessage,
  fetchMessages,
  fetchPinned,
  fetchThread,
  joinSpace,
  leaveSpace,
  markRead,
  messagePerson,
  sendMessage,
  setPinned,
  toggleReaction,
} from "../../actions";
import { useConnection, useQuadEvents } from "../realtime";
import { Composer, type ComposerHandle } from "./Composer";
import { ChatContext, type ChatContextValue, type ChatPermissions } from "./context";
import { friendlyName, MessageItem, RoleBadge } from "./MessageItem";
import { ReportDialog } from "./ReportDialog";
import { newNonce, useMessageStore, withToggledReaction, type PendingMessage } from "./store";
import { buildDays, Timeline } from "./Timeline";
import styles from "./chat.module.css";

export type SpaceViewProps = {
  space: {
    id: string;
    name: string;
    emoji: string;
    kind: SpaceKind;
    description: string | null;
    archived: boolean;
  };
  /** Direct messages: the other people. */
  people?: PersonDTO[];
  /** Class spaces: the teacher, for a "Message Mr Reyes" shortcut. */
  contact?: PersonDTO | null;
  permissions: ChatPermissions & {
    canJoin: boolean;
    canLeave: boolean;
    canManage: boolean;
    postingNote: string | null;
  };
  viewer: PersonDTO;
  initial: { messages: MessageDTO[]; hasMore: boolean };
  lastReadAt: number | null;
  pinnedIds: string[];
  targetId?: string | null;
  threadId?: string | null;
  serverNow: number;
};

type Panel = { type: "thread"; id: string } | { type: "pinned" } | null;
type Notice = { tone: "success" | "danger"; text: string } | null;

const NEAR_BOTTOM_PX = 120;

export function SpaceView(props: SpaceViewProps) {
  const { space, viewer, permissions, serverNow } = props;
  const router = useRouter();
  const confirm = useConfirm();
  const { status, epoch } = useConnection();
  const store = useMessageStore(props.initial.messages);
  const { dispatch, topLevel, replies, state } = store;

  const [hasMore, setHasMore] = useState(props.initial.hasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [panel, setPanel] = useState<Panel>(props.threadId ? { type: "thread", id: props.threadId } : null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<MessageDTO | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [newBelow, setNewBelow] = useState(0);
  const [highlightId, setHighlightId] = useState<string | null>(props.targetId ?? null);
  const [pinned, setPinnedIds] = useState(() => new Set(props.pinnedIds));

  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const restoreScroll = useRef<{ height: number; top: number } | null>(null);
  const composer = useRef<ComposerHandle>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The first unread message when the page opened — fixed for this visit.
  const [firstUnreadId] = useState(() => {
    if (props.lastReadAt === null) return null;
    return (
      props.initial.messages.find((m) => m.createdAt > props.lastReadAt! && m.author.id !== viewer.id && !m.deleted)?.id ??
      null
    );
  });

  /* ---------- reading ---------- */

  const scheduleRead = useCallback(() => {
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      if (document.visibilityState === "visible") void markRead({ spaceId: space.id });
    }, 800);
  }, [space.id]);

  useEffect(() => {
    scheduleRead();
    const onVisible = () => {
      if (document.visibilityState === "visible" && atBottom.current) scheduleRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(readTimer.current);
    };
  }, [scheduleRead]);

  /* ---------- notices ---------- */

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  /* ---------- live updates ---------- */

  const trackPinned = useCallback((messages: MessageDTO[]) => {
    setPinnedIds((prev) => {
      let next = prev;
      for (const m of messages) {
        if (m.parentId) continue;
        if (m.pinned && !prev.has(m.id)) next = new Set(next).add(m.id);
        if (!m.pinned && prev.has(m.id)) {
          next = new Set(next);
          next.delete(m.id);
        }
      }
      return next;
    });
  }, []);

  const upsert = useCallback(
    (messages: MessageDTO[]) => {
      dispatch({ type: "upsert", messages });
      trackPinned(messages);
    },
    [dispatch, trackPinned],
  );

  useQuadEvents((event) => {
    if (event.type === "read" || event.spaceId !== space.id) return;
    if (event.type === "message" && event.nonce && state.pending.some((p) => p.nonce === event.nonce)) {
      dispatch({ type: "settle", nonce: event.nonce, message: event.message });
    } else {
      upsert([event.message]);
    }
    if (event.type === "message" && !event.message.parentId && event.message.author.id !== viewer.id) {
      if (atBottom.current) scheduleRead();
      else setNewBelow((n) => n + 1);
    }
  });

  // After a reconnect, catch up on anything we missed while offline.
  const firstEpoch = useRef(epoch);
  useEffect(() => {
    if (epoch === firstEpoch.current || epoch === 0) return;
    void fetchMessages({ spaceId: space.id }).then((res) => res.ok && upsert(res.data.messages));
    if (panel?.type === "thread") void fetchThread({ messageId: panel.id }).then((res) => res.ok && upsert(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch]);

  /* ---------- scrolling ---------- */

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottom.current = true;
    setNewBelow(0);
  }, []);

  // Initial position: the linked message, the first unread message, or the end.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = props.targetId && !props.threadId ? document.getElementById(`m-${props.targetId}`) : null;
    const divider = document.getElementById("new-messages");
    if (target) {
      target.scrollIntoView({ block: "center" });
    } else if (divider && divider.offsetTop > el.clientHeight * 0.5) {
      el.scrollTop = divider.offsetTop - 64;
    } else {
      el.scrollTop = el.scrollHeight;
    }
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 4000);
    return () => clearTimeout(t);
  }, [highlightId]);

  const mainPending = state.pending.filter((p) => !p.parentId);
  const lastId = topLevel.at(-1)?.id;
  const lastMine = topLevel.at(-1)?.author.id === viewer.id;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (restoreScroll.current) {
      el.scrollTop = el.scrollHeight - restoreScroll.current.height + restoreScroll.current.top;
      restoreScroll.current = null;
      return;
    }
    if (atBottom.current || lastMine) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId, mainPending.length]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (bottom && !atBottom.current && newBelow) {
      setNewBelow(0);
      scheduleRead();
    }
    atBottom.current = bottom;
  };

  const loadOlder = async () => {
    const oldest = topLevel[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    const res = await fetchMessages({ spaceId: space.id, before: oldest.createdAt });
    setLoadingOlder(false);
    if (!res.ok) return setNotice({ tone: "danger", text: res.error });
    const el = scroller.current;
    if (el) restoreScroll.current = { height: el.scrollHeight, top: el.scrollTop };
    upsert(res.data.messages);
    setHasMore(res.data.hasMore);
  };

  /* ---------- sending ---------- */

  const send = useCallback(
    async (body: string, parentId: string | null = null, nonce = newNonce()) => {
      dispatch({ type: "pending", message: { nonce, parentId, body, createdAt: Date.now(), status: "sending" } });
      if (!parentId) atBottom.current = true;
      try {
        const res = await sendMessage({ spaceId: space.id, body, parentId: parentId ?? undefined, nonce });
        if (res.ok) dispatch({ type: "settle", nonce, message: res.data });
        else dispatch({ type: "failed", nonce, error: res.error });
      } catch {
        dispatch({ type: "failed", nonce, error: "Couldn't send — check your internet connection." });
      }
    },
    [dispatch, space.id],
  );

  const retry = (p: PendingMessage) => void send(p.body, p.parentId, p.nonce);
  const discard = (p: PendingMessage) => dispatch({ type: "settle", nonce: p.nonce });

  /* ---------- message actions ---------- */

  const handlers = useMemo<ChatContextValue["handlers"]>(
    () => ({
      react: (m, emoji) => {
        upsert([withToggledReaction(m, emoji, viewer)]);
        void toggleReaction({ messageId: m.id, emoji: emoji as never }).then((res) => {
          if (res.ok) upsert([res.data]);
          else {
            upsert([m]);
            setNotice({ tone: "danger", text: res.error });
          }
        });
      },
      openThread: (m) => {
        setPanel({ type: "thread", id: m.id });
      },
      edit: async (m, body) => {
        upsert([{ ...m, body, editedAt: Date.now() }]);
        const res = await editMessage({ messageId: m.id, body });
        if (res.ok) {
          upsert([res.data]);
          return true;
        }
        upsert([m]);
        setNotice({ tone: "danger", text: res.error });
        return false;
      },
      remove: async (m) => {
        const mine = m.author.id === viewer.id;
        const ok = await confirm({
          title: mine ? "Delete this message?" : "Remove this message?",
          content: mine
            ? "It will be replaced with “This message was deleted”. This can't be undone."
            : "Everyone will see “Message removed by a moderator” instead. This can't be undone.",
          confirmButtonContent: mine ? "Delete" : "Remove",
          confirmButtonType: "danger",
        });
        if (!ok) return;
        upsert([{ ...m, deleted: mine ? "author" : "moderator", body: "", reactions: [], pinned: false }]);
        const res = await deleteMessage({ messageId: m.id });
        if (res.ok) upsert([res.data]);
        else {
          upsert([m]);
          setNotice({ tone: "danger", text: res.error });
        }
      },
      pin: async (m, value) => {
        const res = await setPinned({ messageId: m.id, pinned: value });
        if (res.ok) {
          upsert([res.data]);
          setNotice({ tone: "success", text: value ? "Pinned to this space." : "Unpinned." });
        } else setNotice({ tone: "danger", text: res.error });
      },
      report: (m) => setReportTarget(m),
      messagePerson: async (person) => {
        const res = await messagePerson({ userId: person.id });
        if (res.ok) router.push(res.data.href);
        else setNotice({ tone: "danger", text: res.error });
      },
    }),
    [confirm, router, upsert, viewer],
  );

  const ctx = useMemo<ChatContextValue>(
    () => ({ viewer, permissions, handlers, editingId, setEditingId }),
    [viewer, permissions, handlers, editingId],
  );

  const editLast = () => {
    const mine = [...topLevel].reverse().find((m) => m.author.id === viewer.id && !m.deleted);
    if (mine) setEditingId(mine.id);
  };

  /* ---------- thread panel data ---------- */

  const threadId = panel?.type === "thread" ? panel.id : null;
  useEffect(() => {
    if (!threadId) return;
    void fetchThread({ messageId: threadId }).then((res) => {
      if (res.ok) upsert(res.data);
      else {
        setPanel(null);
        setNotice({ tone: "danger", text: res.error });
      }
    });
  }, [threadId, upsert]);

  useEffect(() => {
    if (panel?.type !== "pinned") return;
    void fetchPinned({ spaceId: space.id }).then((res) => res.ok && upsert(res.data));
  }, [panel?.type, space.id, upsert]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]")) setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const jumpTo = (id: string) => {
    const el = document.getElementById(`m-${id}`);
    if (window.matchMedia("(max-width: 1011px)").matches) setPanel(null);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setHighlightId(id);
    } else {
      router.push(`/quad/s/${space.id}?m=${id}`);
    }
  };

  /* ---------- render ---------- */

  const now = serverNow;
  const days = buildDays(topLevel, mainPending, { now, firstUnreadId, viewerId: viewer.id });
  const isDirect = space.kind === "direct";
  const title = isDirect ? (props.people ?? []).map((p) => p.name).join(", ") || "Just you" : space.name;
  const pinnedCount = pinned.size;
  const backHref = isDirect ? "/quad/dm" : "/quad";

  return (
    <ChatContext.Provider value={ctx}>
      <div className={styles.frame}>
      <div className={styles.chat} data-panel={panel ? panel.type : undefined}>
        <header className={styles.chatHeader}>
          <IconButton
            as={NextLink}
            href={backHref}
            icon={ArrowLeftIcon}
            aria-label={isDirect ? "Back to direct messages" : "Back to Quad"}
            variant="invisible"
            className={styles.backButton}
          />
          {isDirect && props.people?.[0] ? (
            <InitialsAvatar name={props.people[0].name} size={36} />
          ) : (
            <span className={styles.headerEmoji} aria-hidden>
              {space.emoji}
            </span>
          )}
          <div className={styles.headerText}>
            <h1 className={styles.headerTitle}>{title}</h1>
            <p className={styles.headerSub}>
              {isDirect ? (
                <>
                  {(props.people ?? []).map((p) => (
                    <RoleBadge key={p.id} badge={p.badge} />
                  ))}
                  <span>Direct message</span>
                </>
              ) : (
                <span className={styles.headerDescription}>{space.description}</span>
              )}
              {props.contact && props.contact.id !== viewer.id ? (
                <button type="button" className={styles.contactLink} onClick={() => handlers.messagePerson(props.contact!)}>
                  <MailIcon size={14} /> Message {friendlyName(props.contact.name)}
                </button>
              ) : null}
            </p>
          </div>
          <div className={styles.headerActions}>
            {status === "offline" ? <span className={styles.offline}>Reconnecting…</span> : null}
            {pinnedCount || permissions.canPin ? (
              <Button
                size="small"
                variant={panel?.type === "pinned" ? "default" : "invisible"}
                leadingVisual={PinIcon}
                count={pinnedCount || undefined}
                aria-pressed={panel?.type === "pinned"}
                onClick={() => setPanel(panel?.type === "pinned" ? null : { type: "pinned" })}
                className={styles.pinnedButton}
              >
                <span className={styles.pinnedLabel}>Pinned</span>
              </Button>
            ) : null}
            {permissions.canManage || permissions.canLeave ? (
              <ActionMenu>
                <ActionMenu.Anchor>
                  <IconButton icon={KebabHorizontalIcon} aria-label="Space options" variant="invisible" />
                </ActionMenu.Anchor>
                <ActionMenu.Overlay width="medium">
                  <ActionList>
                    {permissions.canManage ? (
                      <ActionList.LinkItem as={NextLink} href={`/quad/s/${space.id}/settings`}>
                        <ActionList.LeadingVisual>
                          <GearIcon />
                        </ActionList.LeadingVisual>
                        Settings and members
                      </ActionList.LinkItem>
                    ) : null}
                    {permissions.canLeave ? (
                      <ActionList.Item
                        variant="danger"
                        onSelect={async () => {
                          const ok = await confirm({
                            title: `Leave ${space.name}?`,
                            content: "You can join again any time from Browse groups.",
                            confirmButtonContent: "Leave group",
                            confirmButtonType: "danger",
                          });
                          if (!ok) return;
                          const fd = new FormData();
                          fd.set("spaceId", space.id);
                          await leaveSpace(fd);
                        }}
                      >
                        <ActionList.LeadingVisual>
                          <SignOutIcon />
                        </ActionList.LeadingVisual>
                        Leave group
                      </ActionList.Item>
                    ) : null}
                  </ActionList>
                </ActionMenu.Overlay>
              </ActionMenu>
            ) : null}
          </div>
        </header>

        <div className={styles.chatBody}>
          <div className={styles.chatMain}>
            {notice ? (
              <div className={styles.notice} data-tone={notice.tone} role="status">
                {notice.text}
              </div>
            ) : null}
            <div
              ref={scroller}
              className={styles.scroller}
              onScroll={onScroll}
              role="log"
              aria-label={`Messages in ${title}`}
              tabIndex={0}
            >
              {topLevel.length === 0 && !mainPending.length ? (
                <div className={styles.emptyChat}>
                  <span className={styles.emptyEmoji} aria-hidden>
                    {isDirect ? "👋" : space.emoji}
                  </span>
                  <p className={styles.emptyTitle}>{isDirect ? `Say hello to ${title}` : "No messages yet"}</p>
                  <p className={styles.muted}>
                    {permissions.canPost ? "Be the first to say something friendly." : "Messages will appear here."}
                  </p>
                </div>
              ) : (
                <Timeline
                  days={days}
                  highlightId={highlightId}
                  hasMore={hasMore}
                  loadingOlder={loadingOlder}
                  onLoadOlder={loadOlder}
                  onRetry={retry}
                  onDiscard={discard}
                />
              )}
            </div>
            {newBelow > 0 ? (
              <button type="button" className={styles.jumpPill} onClick={() => scrollToBottom(true)}>
                <ArrowDownIcon size={14} /> {newBelow === 1 ? "1 new message" : `${newBelow} new messages`}
              </button>
            ) : null}

            <footer className={styles.chatFooter}>
              {permissions.canPost ? (
                <Composer
                  ref={composer}
                  label={`Message ${title}`}
                  placeholder={`Message ${isDirect ? friendlyName(title) : space.name}`}
                  draftKey={`quad-draft:${space.id}`}
                  onSend={(body) => void send(body)}
                  onEditLast={editLast}
                  autoFocus
                />
              ) : permissions.canJoin ? (
                <form action={joinSpace} className={styles.joinBar}>
                  <input type="hidden" name="spaceId" value={space.id} />
                  <span>You&apos;re looking at {space.name}. Join to post and react.</span>
                  <Button type="submit" variant="primary">
                    Join group
                  </Button>
                </form>
              ) : permissions.postingNote ? (
                <p className={styles.postingNote}>{permissions.postingNote}</p>
              ) : null}
            </footer>
          </div>

          {panel?.type === "thread" ? (
            <ThreadPanel
              parent={state.byId[panel.id] ?? null}
              replies={replies.get(panel.id) ?? []}
              pending={state.pending.filter((p) => p.parentId === panel.id)}
              canReply={permissions.canPost}
              now={now}
              viewerId={viewer.id}
              highlightId={highlightId}
              onClose={() => setPanel(null)}
              onSend={(body) => void send(body, panel.id)}
              onRetry={retry}
              onDiscard={discard}
              onJump={() => jumpTo(panel.id)}
            />
          ) : panel?.type === "pinned" ? (
            <aside className={styles.panel} aria-label="Pinned messages">
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>
                  <PinIcon /> Pinned messages
                </h2>
                <IconButton icon={XIcon} aria-label="Close pinned messages" variant="invisible" onClick={() => setPanel(null)} />
              </div>
              <div className={styles.panelScroll}>
                {pinnedCount === 0 ? (
                  <p className={styles.panelEmpty}>
                    Nothing pinned yet.
                    {permissions.canPin ? " Use the ⋯ menu on a message to pin important information here." : ""}
                  </p>
                ) : (
                  [...pinned]
                    .map((id) => state.byId[id])
                    .filter((m): m is MessageDTO => !!m)
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((m) => (
                      <div key={m.id} className={styles.pinnedItem}>
                        <MessageItem message={m} inThread />
                        <Button size="small" variant="invisible" onClick={() => jumpTo(m.id)} className={styles.jumpButton}>
                          Show in conversation
                        </Button>
                      </div>
                    ))
                )}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
      </div>

      {reportTarget ? (
        <ReportDialog
          message={reportTarget}
          onClose={() => setReportTarget(null)}
          onReported={() => {
            setReportTarget(null);
            setNotice({ tone: "success", text: "Thanks for letting us know. School staff will review it." });
          }}
        />
      ) : null}
    </ChatContext.Provider>
  );
}

function ThreadPanel({
  parent,
  replies,
  pending,
  canReply,
  now,
  viewerId,
  highlightId,
  onClose,
  onSend,
  onRetry,
  onDiscard,
  onJump,
}: {
  parent: MessageDTO | null;
  replies: MessageDTO[];
  pending: PendingMessage[];
  canReply: boolean;
  now: number;
  viewerId: string;
  highlightId: string | null;
  onClose: () => void;
  onSend: (body: string) => void;
  onRetry: (p: PendingMessage) => void;
  onDiscard: (p: PendingMessage) => void;
  onJump: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const days = buildDays(replies, pending, { now, viewerId });

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = highlightId ? document.getElementById(`m-${highlightId}`) : null;
    if (target && el.contains(target)) target.scrollIntoView({ block: "center" });
    else el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replies.length, pending.length]);

  return (
    <aside className={styles.panel} aria-label="Thread" data-thread>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Thread</h2>
        <IconButton icon={XIcon} aria-label="Close thread" variant="invisible" onClick={onClose} />
      </div>
      <div className={styles.panelScroll} ref={scroller}>
        {parent ? (
          <>
            <div className={styles.threadParent}>
              <MessageItem message={parent} inThread />
              <Button size="small" variant="invisible" onClick={onJump} className={styles.jumpButton}>
                Show in conversation
              </Button>
            </div>
            <div className={styles.threadCount} role="separator">
              <span>
                {parent.replyCount === 0
                  ? "No replies yet"
                  : parent.replyCount === 1
                    ? "1 reply"
                    : `${parent.replyCount} replies`}
              </span>
            </div>
            <Timeline days={days} onRetry={onRetry} onDiscard={onDiscard} highlightId={highlightId} inThread />
          </>
        ) : (
          <p className={styles.panelEmpty}>Loading…</p>
        )}
      </div>
      {canReply && parent && !parent.deleted ? (
        <div className={styles.panelFooter}>
          <Composer label="Reply in thread" placeholder="Reply…" draftKey={`quad-draft:thread:${parent.id}`} onSend={onSend} autoFocus />
        </div>
      ) : null}
    </aside>
  );
}
