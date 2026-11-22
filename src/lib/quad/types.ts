/**
 * Quad types and constants shared by the server and the browser.
 * Everything here must stay serialisable (plain objects, numbers, strings).
 */
import type { Role, SpaceKind } from "@/db/schema";

/** The friendly, fixed set of reactions. Kept small on purpose. */
export const REACTIONS = ["👍", "❤️", "😂", "🎉", "🙏", "👀"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const REACTION_LABELS: Record<Reaction, string> = {
  "👍": "Thumbs up",
  "❤️": "Love",
  "😂": "Laugh",
  "🎉": "Celebrate",
  "🙏": "Thank you",
  "👀": "Looking",
};

/** Longest message we accept, in characters. */
export const MAX_MESSAGE_LENGTH = 2000;

/** How many top-level messages a space loads at a time. */
export const PAGE_SIZE = 150;

export type PersonDTO = {
  id: string;
  name: string;
  role: Role;
  /** Short role badge such as "Teacher", "Principal" or "Staff". */
  badge: string | null;
};

export type ReactionDTO = {
  emoji: string;
  users: { id: string; name: string }[];
};

/**
 * A message as the browser sees it. It is the same for every viewer, so it
 * can be broadcast as-is over the real-time stream.
 */
export type MessageDTO = {
  id: string;
  spaceId: string;
  parentId: string | null;
  author: PersonDTO;
  /** Empty once deleted — the original text never leaves the server. */
  body: string;
  createdAt: number;
  editedAt: number | null;
  deleted: null | "author" | "moderator";
  pinned: boolean;
  reactions: ReactionDTO[];
  replyCount: number;
  lastReplyAt: number | null;
};

export type SpaceSummaryDTO = {
  id: string;
  name: string;
  emoji: string;
  kind: SpaceKind;
  description: string | null;
  href: string;
  unread: number;
  lastMessageAt: number | null;
  /** "Sarah: See you at pick-up!" */
  preview: string | null;
  archived: boolean;
  /** For direct messages: the other people in the conversation. */
  people?: PersonDTO[];
};

/** Events sent down the real-time stream. */
export type QuadEvent =
  | { type: "message"; spaceId: string; message: MessageDTO; nonce?: string }
  | { type: "update"; spaceId: string; message: MessageDTO }
  | { type: "read"; spaceId: string; userId: string };

/** Result returned by the chat server actions. */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
