"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/db/schema";
import type { MessageDTO, PersonDTO } from "@/lib/quad/types";

export type ChatViewer = PersonDTO;

export type ChatPermissions = {
  canPost: boolean;
  canReact: boolean;
  canModerate: boolean;
  canPin: boolean;
};

export type ChatHandlers = {
  react: (message: MessageDTO, emoji: string) => void;
  openThread: (message: MessageDTO) => void;
  edit: (message: MessageDTO, body: string) => Promise<boolean>;
  remove: (message: MessageDTO) => void;
  pin: (message: MessageDTO, pinned: boolean) => void;
  report: (message: MessageDTO) => void;
  messagePerson: (person: PersonDTO) => void;
};

export type ChatContextValue = {
  viewer: ChatViewer;
  permissions: ChatPermissions;
  handlers: ChatHandlers;
  /** The message currently being edited (only one at a time). */
  editingId: string | null;
  setEditingId: (id: string | null) => void;
};

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatContext>");
  return ctx;
}

const isStaff = (r: Role) => r === "admin" || r === "staff";

/** Mirrors the server's rule: students only ever talk privately with staff. */
export function canMessage(viewer: { id: string; role: Role }, person: { id: string; role: Role }): boolean {
  if (viewer.id === person.id) return false;
  if (viewer.role === "student") return isStaff(person.role);
  if (person.role === "student") return isStaff(viewer.role);
  return true;
}
