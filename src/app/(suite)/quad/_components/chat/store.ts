"use client";

import { useMemo, useReducer } from "react";
import type { MessageDTO } from "@/lib/quad/types";

/** A message the viewer has sent that the server hasn't confirmed yet. */
export type PendingMessage = {
  nonce: string;
  parentId: string | null;
  body: string;
  createdAt: number;
  status: "sending" | "failed";
  error?: string;
};

type State = {
  byId: Record<string, MessageDTO>;
  pending: PendingMessage[];
};

type Action =
  | { type: "upsert"; messages: MessageDTO[] }
  | { type: "pending"; message: PendingMessage }
  | { type: "failed"; nonce: string; error: string }
  | { type: "settle"; nonce: string; message?: MessageDTO };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "upsert": {
      if (!action.messages.length) return state;
      const byId = { ...state.byId };
      for (const m of action.messages) byId[m.id] = m;
      return { ...state, byId };
    }
    case "pending":
      return { ...state, pending: [...state.pending.filter((p) => p.nonce !== action.message.nonce), action.message] };
    case "failed":
      return {
        ...state,
        pending: state.pending.map((p) => (p.nonce === action.nonce ? { ...p, status: "failed", error: action.error } : p)),
      };
    case "settle": {
      const pending = state.pending.filter((p) => p.nonce !== action.nonce);
      if (!action.message) return { ...state, pending };
      return { pending, byId: { ...state.byId, [action.message.id]: action.message } };
    }
  }
}

const byTime = (a: { createdAt: number }, b: { createdAt: number }) => a.createdAt - b.createdAt;

/** All messages for one space (top level and thread replies), keyed by id. */
export function useMessageStore(initial: MessageDTO[]) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    byId: Object.fromEntries(initial.map((m) => [m.id, m])),
    pending: [],
  }));

  const derived = useMemo(() => {
    const all = Object.values(state.byId);
    const topLevel = all.filter((m) => !m.parentId).sort(byTime);
    const replies = new Map<string, MessageDTO[]>();
    for (const m of all) {
      if (!m.parentId) continue;
      replies.set(m.parentId, [...(replies.get(m.parentId) ?? []), m]);
    }
    for (const list of replies.values()) list.sort(byTime);
    return { topLevel, replies };
  }, [state.byId]);

  return { state, dispatch, ...derived };
}

export type MessageStore = ReturnType<typeof useMessageStore>;

/** The message with the viewer's reaction toggled — for instant feedback. */
export function withToggledReaction(m: MessageDTO, emoji: string, viewer: { id: string; name: string }): MessageDTO {
  const existing = m.reactions.find((r) => r.emoji === emoji);
  const mine = existing?.users.some((u) => u.id === viewer.id);
  let reactions = m.reactions.map((r) =>
    r.emoji !== emoji
      ? r
      : { ...r, users: mine ? r.users.filter((u) => u.id !== viewer.id) : [...r.users, { id: viewer.id, name: viewer.name }] },
  );
  if (!existing) reactions = [...reactions, { emoji, users: [{ id: viewer.id, name: viewer.name }] }];
  return { ...m, reactions: reactions.filter((r) => r.users.length) };
}

export function newNonce(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
