"use client";

import {
  CommentIcon,
  CopyIcon,
  KebabHorizontalIcon,
  PencilIcon,
  PinIcon,
  ReportIcon,
  TrashIcon,
  MailIcon,
} from "@primer/octicons-react";
import { ActionList, ActionMenu, Button, IconButton, Label, Textarea, Tooltip } from "@primer/react";
import { memo, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { InitialsAvatar } from "@/components/ui/Card";
import { formatTime } from "@/lib/format";
import { MAX_MESSAGE_LENGTH, REACTIONS, REACTION_LABELS, type MessageDTO, type PersonDTO } from "@/lib/quad/types";
import { MessageText } from "../MessageText";
import { RelativeTime } from "../time";
import { canMessage, useChat } from "./context";
import type { PendingMessage } from "./store";
import styles from "./chat.module.css";

const BADGE_VARIANT = {
  Principal: "done",
  Teacher: "accent",
  Staff: "secondary",
  Student: "attention",
} as const;

export function RoleBadge({ badge }: { badge: string | null }) {
  if (!badge) return null;
  return (
    <Label size="small" variant={BADGE_VARIANT[badge as keyof typeof BADGE_VARIANT] ?? "secondary"}>
      {badge}
    </Label>
  );
}

function reactionSummary(users: { name: string }[], emoji: string, viewerId: string, ids: string[]) {
  const names = users.map((u, i) => (ids[i] === viewerId ? "You" : u.name));
  const list = names.length > 6 ? `${names.slice(0, 6).join(", ")} and ${names.length - 6} others` : names.join(", ");
  return `${list} reacted with ${emoji}`;
}

const HONORIFICS = new Set(["Mr", "Ms", "Mrs", "Miss", "Dr", "Coach", "Mx"]);

/** "Sarah" for families, "Mr Reyes" for staff who go by a title. */
export function friendlyName(name: string): string {
  const parts = name.split(" ");
  if (HONORIFICS.has(parts[0] ?? "") && parts.length > 2) return `${parts[0]} ${parts.at(-1)}`;
  if (HONORIFICS.has(parts[0] ?? "")) return name;
  return parts[0] ?? name;
}

/** Name that opens a small menu, e.g. to send a direct message. */
function AuthorName({ person }: { person: PersonDTO }) {
  const { viewer, handlers } = useChat();
  if (!canMessage(viewer, person)) return <span className={styles.authorName}>{person.name}</span>;
  return (
    <ActionMenu>
      <ActionMenu.Anchor>
        <button type="button" className={`${styles.authorName} ${styles.authorButton}`}>
          {person.name}
        </button>
      </ActionMenu.Anchor>
      <ActionMenu.Overlay width="auto">
        <ActionList>
          <ActionList.Item onSelect={() => handlers.messagePerson(person)}>
            <ActionList.LeadingVisual>
              <MailIcon />
            </ActionList.LeadingVisual>
            Message {friendlyName(person.name)}
          </ActionList.Item>
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
}

function EditBox({ message, onDone }: { message: MessageDTO; onDone: () => void }) {
  const { handlers } = useChat();
  const [value, setValue] = useState(message.body);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value]);

  const save = async () => {
    const body = value.trim();
    if (!body || body.length > MAX_MESSAGE_LENGTH) return;
    if (body === message.body) return onDone();
    setSaving(true);
    const ok = await handlers.edit(message, body);
    setSaving(false);
    if (ok) onDone();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onDone();
    } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void save();
    }
  };

  return (
    <div className={styles.editBox}>
      <Textarea
        ref={ref}
        aria-label="Edit message"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={MAX_MESSAGE_LENGTH}
        resize="none"
        rows={1}
        block
        className={styles.editTextarea}
      />
      <div className={styles.editActions}>
        <span className={styles.hint}>Enter to save · Esc to cancel</span>
        <Button size="small" onClick={onDone}>
          Cancel
        </Button>
        <Button size="small" variant="primary" onClick={save} loading={saving} disabled={!value.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
}

type Props = {
  message: MessageDTO;
  /** Same author as the message above: hide the avatar and name. */
  collapsed?: boolean;
  /** Rendered inside the thread panel. */
  inThread?: boolean;
  highlighted?: boolean;
};

export const MessageItem = memo(function MessageItem({ message, collapsed = false, inThread = false, highlighted }: Props) {
  const { viewer, permissions, handlers, editingId, setEditingId } = useChat();
  const [selected, setSelected] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const mine = message.author.id === viewer.id;
  const editing = editingId === message.id;

  // Close the touch toolbar when tapping elsewhere.
  useEffect(() => {
    if (!selected) return;
    const close = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setSelected(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [selected]);

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button, textarea, [role=menu]")) return;
    setSelected((s) => !s);
  };

  if (message.deleted) {
    return (
      <article className={styles.message} data-collapsed={collapsed || undefined} data-deleted id={`m-${message.id}`}>
        <div className={styles.gutter}>{collapsed ? null : <span className={styles.deletedAvatar} aria-hidden />}</div>
        <div className={styles.content}>
          <p className={styles.deletedText}>
            {message.deleted === "moderator" ? "Message removed by a moderator" : "This message was deleted"}
          </p>
          {!inThread && message.replyCount > 0 ? <ReplySummary message={message} /> : null}
        </div>
      </article>
    );
  }

  const canDelete = mine || permissions.canModerate;
  const canPin = permissions.canPin && !message.parentId;
  const time = <RelativeTime at={message.createdAt} />;

  return (
    <article
      ref={rootRef}
      id={`m-${message.id}`}
      className={styles.message}
      data-collapsed={collapsed || undefined}
      data-selected={selected || undefined}
      data-highlighted={highlighted || undefined}
      data-pinned={message.pinned || undefined}
      aria-label={`${message.author.name}, ${formatTime(message.createdAt)}`}
      onPointerUp={onPointerUp}
    >
      <div className={styles.gutter}>
        {collapsed ? (
          <span className={styles.gutterTime} aria-hidden>
            {formatTime(message.createdAt)}
          </span>
        ) : (
          <InitialsAvatar name={message.author.name} size={36} />
        )}
      </div>

      <div className={styles.content}>
        {collapsed ? null : (
          <header className={styles.messageHeader}>
            <AuthorName person={message.author} />
            <RoleBadge badge={message.author.badge} />
            <span className={styles.time}>{time}</span>
          </header>
        )}
        {message.pinned && !inThread ? (
          <div className={styles.pinnedTag}>
            <PinIcon size={12} /> Pinned
          </div>
        ) : null}

        {editing ? (
          <EditBox message={message} onDone={() => setEditingId(null)} />
        ) : (
          <>
            <MessageText text={message.body} />
            {message.editedAt ? <span className={styles.edited}>(edited)</span> : null}
          </>
        )}

        {message.reactions.length ? (
          <div className={styles.reactions}>
            {message.reactions.map((r) => {
              const pressed = r.users.some((u) => u.id === viewer.id);
              const summary = reactionSummary(r.users, r.emoji, viewer.id, r.users.map((u) => u.id));
              return (
                <Tooltip key={r.emoji} text={summary} direction="n">
                  <button
                    type="button"
                    className={styles.reaction}
                    aria-pressed={pressed}
                    aria-label={`${summary}. ${pressed ? "Remove your reaction" : "Add your reaction"}`}
                    disabled={!permissions.canReact}
                    onClick={() => handlers.react(message, r.emoji)}
                  >
                    <span aria-hidden>{r.emoji}</span>
                    <span className={styles.reactionCount}>{r.users.length}</span>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        ) : null}

        {!inThread && message.replyCount > 0 ? <ReplySummary message={message} /> : null}
      </div>

      {editing ? null : (
        <div className={styles.toolbar} role="toolbar" aria-label="Message actions">
          {permissions.canReact
            ? REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={styles.toolEmoji}
                  aria-label={`React with ${REACTION_LABELS[emoji]}`}
                  title={REACTION_LABELS[emoji]}
                  onClick={() => {
                    handlers.react(message, emoji);
                    setSelected(false);
                  }}
                >
                  {emoji}
                </button>
              ))
            : null}
          {!inThread && (permissions.canPost || message.replyCount > 0) ? (
            <IconButton
              icon={CommentIcon}
              aria-label="Reply in thread"
              size="small"
              variant="invisible"
              onClick={() => handlers.openThread(message)}
            />
          ) : null}
          <ActionMenu>
            <ActionMenu.Anchor>
              <IconButton icon={KebabHorizontalIcon} aria-label="More actions" size="small" variant="invisible" />
            </ActionMenu.Anchor>
            <ActionMenu.Overlay width="small">
              <ActionList>
                {!inThread && (permissions.canPost || message.replyCount > 0) ? (
                  <ActionList.Item onSelect={() => handlers.openThread(message)}>
                    <ActionList.LeadingVisual>
                      <CommentIcon />
                    </ActionList.LeadingVisual>
                    Reply in thread
                  </ActionList.Item>
                ) : null}
                <ActionList.Item onSelect={() => void navigator.clipboard?.writeText(message.body)}>
                  <ActionList.LeadingVisual>
                    <CopyIcon />
                  </ActionList.LeadingVisual>
                  Copy text
                </ActionList.Item>
                {mine ? (
                  <ActionList.Item onSelect={() => setEditingId(message.id)}>
                    <ActionList.LeadingVisual>
                      <PencilIcon />
                    </ActionList.LeadingVisual>
                    Edit message
                  </ActionList.Item>
                ) : null}
                {canPin ? (
                  <ActionList.Item onSelect={() => handlers.pin(message, !message.pinned)}>
                    <ActionList.LeadingVisual>
                      <PinIcon />
                    </ActionList.LeadingVisual>
                    {message.pinned ? "Unpin" : "Pin to this space"}
                  </ActionList.Item>
                ) : null}
                {!mine ? (
                  <ActionList.Item onSelect={() => handlers.report(message)}>
                    <ActionList.LeadingVisual>
                      <ReportIcon />
                    </ActionList.LeadingVisual>
                    Report to staff
                  </ActionList.Item>
                ) : null}
                {canDelete ? (
                  <>
                    <ActionList.Divider />
                    <ActionList.Item variant="danger" onSelect={() => handlers.remove(message)}>
                      <ActionList.LeadingVisual>
                        <TrashIcon />
                      </ActionList.LeadingVisual>
                      {mine ? "Delete message" : "Remove message"}
                    </ActionList.Item>
                  </>
                ) : null}
              </ActionList>
            </ActionMenu.Overlay>
          </ActionMenu>
        </div>
      )}
    </article>
  );
});

function ReplySummary({ message }: { message: MessageDTO }) {
  const { handlers } = useChat();
  return (
    <button type="button" className={styles.replySummary} onClick={() => handlers.openThread(message)}>
      <CommentIcon size={14} />
      <span className={styles.replyCount}>
        {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
      </span>
      {message.lastReplyAt ? (
        <span className={styles.replyLast}>
          Last reply <RelativeTime at={message.lastReplyAt} />
        </span>
      ) : null}
    </button>
  );
}

/** An optimistic message while it's being sent (or after it failed). */
export function PendingItem({
  pending,
  collapsed,
  onRetry,
  onDiscard,
}: {
  pending: PendingMessage;
  collapsed: boolean;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { viewer } = useChat();
  return (
    <article className={styles.message} data-collapsed={collapsed || undefined} data-pending={pending.status}>
      <div className={styles.gutter}>{collapsed ? null : <InitialsAvatar name={viewer.name} size={36} />}</div>
      <div className={styles.content}>
        {collapsed ? null : (
          <header className={styles.messageHeader}>
            <span className={styles.authorName}>{viewer.name}</span>
            <RoleBadge badge={viewer.badge} />
          </header>
        )}
        <MessageText text={pending.body} />
        {pending.status === "sending" ? (
          <span className={styles.sending}>Sending…</span>
        ) : (
          <div className={styles.failed} role="alert">
            <span>{pending.error ?? "Couldn't send this message."}</span>
            <Button size="small" onClick={onRetry}>
              Try again
            </Button>
            <Button size="small" variant="invisible" onClick={onDiscard}>
              Discard
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
