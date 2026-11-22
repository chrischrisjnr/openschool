"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { newId } from "@/db/ids";
import { quadMembers, quadMessages, quadReactions, quadReports, quadSpaces } from "@/db/schema";
import { zodToFormState, type FormState } from "@/lib/form";
import { canPairMessage, getSpaceAccess, isAudienceKind, type SpaceAccess } from "@/lib/quad/access";
import { publish } from "@/lib/quad/events";
import {
  getMessageDTO,
  getMessageRow,
  loadPinned,
  loadSpaceMessages,
  loadThread,
  type MessageRow,
} from "@/lib/quad/messages";
import { findDirectSpace, listRecipients, spaceHref } from "@/lib/quad/spaces";
import {
  MAX_MESSAGE_LENGTH,
  REACTIONS,
  type ActionResult,
  type MessageDTO,
} from "@/lib/quad/types";
import { getViewer, type Viewer } from "@/lib/viewer";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const ok = <T,>(data: T): { ok: true; data: T } => ({ ok: true, data });

const id = z.string().trim().min(1).max(64);
const body = z
  .string()
  .transform((s) => s.replace(/\r\n/g, "\n").trim())
  .pipe(
    z
      .string()
      .min(1, "Write a message first.")
      .max(MAX_MESSAGE_LENGTH, `Messages can be up to ${MAX_MESSAGE_LENGTH} characters.`),
  );

/** Loads a message and the viewer's access to its space, or explains why not. */
function messageWithAccess(
  viewer: Viewer,
  messageId: string,
): { row: MessageRow; access: SpaceAccess } | { error: string } {
  const row = getMessageRow(messageId);
  const access = row ? getSpaceAccess(viewer, row.spaceId) : null;
  if (!row || !access?.canView) return { error: "That message isn't available any more." };
  return { row, access };
}

function broadcastUpdate(messageId: string): MessageDTO | null {
  const dto = getMessageDTO(messageId);
  if (dto) publish({ type: "update", spaceId: dto.spaceId, message: dto });
  return dto;
}

/** A gentle limit so a stuck key or a script can't flood a space. */
const recentSends = new Map<string, number[]>();
function tooFast(userId: string): boolean {
  const now = Date.now();
  const list = (recentSends.get(userId) ?? []).filter((t) => now - t < 30_000);
  list.push(now);
  recentSends.set(userId, list);
  return list.length > 20;
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

const sendSchema = z.object({
  spaceId: id,
  body,
  parentId: id.optional(),
  nonce: z.string().max(64).optional(),
});

export async function sendMessage(input: z.input<typeof sendSchema>): Promise<ActionResult<MessageDTO>> {
  const viewer = await getViewer();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check your message.");
  const { spaceId, parentId, nonce } = parsed.data;

  const access = getSpaceAccess(viewer, spaceId);
  if (!access?.canView) return fail("You can't see this space.");
  if (!access.canPost) return fail(access.postingNote ?? "You can't post here.");
  if (tooFast(viewer.id)) return fail("You're sending messages very quickly. Please wait a moment.");

  if (parentId) {
    const parent = getMessageRow(parentId);
    if (!parent || parent.spaceId !== spaceId || parent.parentId || parent.deletedAt) {
      return fail("That conversation isn't available any more.");
    }
  }

  const messageId = newId();
  const now = new Date();
  db.insert(quadMessages)
    .values({ id: messageId, spaceId, authorId: viewer.id, body: parsed.data.body, parentId: parentId ?? null, createdAt: now })
    .run();
  // Sending a message means you've read the space.
  touchRead(access, viewer.id, now);

  const dto = getMessageDTO(messageId)!;
  publish({ type: "message", spaceId, message: dto, nonce });
  if (parentId) broadcastUpdate(parentId);
  return ok(dto);
}

const editSchema = z.object({ messageId: id, body });

export async function editMessage(input: z.input<typeof editSchema>): Promise<ActionResult<MessageDTO>> {
  const viewer = await getViewer();
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check your message.");
  const found = messageWithAccess(viewer, parsed.data.messageId);
  if ("error" in found) return fail(found.error);
  const { row, access } = found;
  if (row.authorId !== viewer.id) return fail("You can only edit your own messages.");
  if (row.deletedAt) return fail("This message has been deleted.");
  if (access.space.archived) return fail("This space has been archived.");

  if (row.body !== parsed.data.body) {
    db.update(quadMessages)
      .set({ body: parsed.data.body, editedAt: new Date() })
      .where(eq(quadMessages.id, row.id))
      .run();
  }
  return ok(broadcastUpdate(row.id)!);
}

export async function deleteMessage(input: { messageId: string }): Promise<ActionResult<MessageDTO>> {
  const viewer = await getViewer();
  const parsed = z.object({ messageId: id }).safeParse(input);
  if (!parsed.success) return fail("That message isn't available any more.");
  const found = messageWithAccess(viewer, parsed.data.messageId);
  if ("error" in found) return fail(found.error);
  const { row, access } = found;
  const own = row.authorId === viewer.id;
  if (!own && !access.canModerate) return fail("You can only delete your own messages.");
  if (row.deletedAt) return ok(getMessageDTO(row.id)!);

  removeMessage(row, viewer.id);
  const dto = broadcastUpdate(row.id)!;
  if (row.parentId) broadcastUpdate(row.parentId);
  if (!own) revalidatePath("/quad/moderation");
  return ok(dto);
}

/** Soft-deletes a message (keeping a placeholder) and closes its open reports. */
function removeMessage(row: MessageRow, byUserId: string) {
  db.transaction((tx) => {
    tx.update(quadMessages)
      .set({ deletedAt: new Date(), deletedBy: byUserId, pinned: false })
      .where(eq(quadMessages.id, row.id))
      .run();
    tx.delete(quadReactions).where(eq(quadReactions.messageId, row.id)).run();
    tx.update(quadReports)
      .set({ status: "resolved", resolvedBy: byUserId })
      .where(and(eq(quadReports.messageId, row.id), eq(quadReports.status, "open")))
      .run();
  });
}

const reactSchema = z.object({ messageId: id, emoji: z.enum(REACTIONS) });

export async function toggleReaction(input: z.input<typeof reactSchema>): Promise<ActionResult<MessageDTO>> {
  const viewer = await getViewer();
  const parsed = reactSchema.safeParse(input);
  if (!parsed.success) return fail("Please pick one of the reactions.");
  const found = messageWithAccess(viewer, parsed.data.messageId);
  if ("error" in found) return fail(found.error);
  const { row, access } = found;
  if (!access.canReact) return fail(access.postingNote ?? "You can't react here.");
  if (row.deletedAt) return fail("This message has been deleted.");

  const key = and(
    eq(quadReactions.messageId, row.id),
    eq(quadReactions.userId, viewer.id),
    eq(quadReactions.emoji, parsed.data.emoji),
  );
  const existing = db.select().from(quadReactions).where(key).get();
  if (existing) db.delete(quadReactions).where(key).run();
  else db.insert(quadReactions).values({ messageId: row.id, userId: viewer.id, emoji: parsed.data.emoji }).run();
  return ok(broadcastUpdate(row.id)!);
}

export async function setPinned(input: { messageId: string; pinned: boolean }): Promise<ActionResult<MessageDTO>> {
  const viewer = await getViewer();
  const parsed = z.object({ messageId: id, pinned: z.boolean() }).safeParse(input);
  if (!parsed.success) return fail("That message isn't available any more.");
  const found = messageWithAccess(viewer, parsed.data.messageId);
  if ("error" in found) return fail(found.error);
  const { row, access } = found;
  if (!access.canPin) return fail("Only staff and moderators can pin messages.");
  if (row.deletedAt || row.parentId) return fail("This message can't be pinned.");
  db.update(quadMessages).set({ pinned: parsed.data.pinned }).where(eq(quadMessages.id, row.id)).run();
  return ok(broadcastUpdate(row.id)!);
}

const REPORT_REASONS = ["unkind", "inappropriate", "privacy", "spam", "other"] as const;
const reportSchema = z.object({
  messageId: id,
  reason: z.enum(REPORT_REASONS, { message: "Please choose a reason." }),
  details: z.string().trim().max(500, "Please keep it under 500 characters.").optional(),
});

export async function reportMessage(input: z.input<typeof reportSchema>): Promise<ActionResult> {
  const viewer = await getViewer();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please choose a reason.");
  const found = messageWithAccess(viewer, parsed.data.messageId);
  if ("error" in found) return fail(found.error);
  const { row } = found;
  if (row.deletedAt) return fail("This message has already been removed.");
  if (row.authorId === viewer.id) return fail("You can delete your own message instead.");

  const already = db
    .select({ id: quadReports.id })
    .from(quadReports)
    .where(and(eq(quadReports.messageId, row.id), eq(quadReports.reporterId, viewer.id), eq(quadReports.status, "open")))
    .get();
  if (!already) {
    const reason = REPORT_LABELS[parsed.data.reason] + (parsed.data.details ? ` — ${parsed.data.details}` : "");
    db.insert(quadReports).values({ id: newId(), messageId: row.id, reporterId: viewer.id, reason }).run();
  }
  revalidatePath("/quad/moderation");
  return ok(undefined);
}

const REPORT_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  unkind: "Unkind or bullying",
  inappropriate: "Inappropriate content",
  privacy: "Shares private information",
  spam: "Spam or advertising",
  other: "Something else",
};

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/** Upserts the viewer's lastReadAt. Group/DM rows are only updated, never created. */
function touchRead(access: SpaceAccess, userId: string, at = new Date()) {
  const spaceId = access.space.id;
  if (isAudienceKind(access.space.kind)) {
    db.insert(quadMembers)
      .values({ spaceId, userId, lastReadAt: at })
      .onConflictDoUpdate({ target: [quadMembers.spaceId, quadMembers.userId], set: { lastReadAt: at } })
      .run();
  } else if (access.memberRole) {
    db.update(quadMembers)
      .set({ lastReadAt: at })
      .where(and(eq(quadMembers.spaceId, spaceId), eq(quadMembers.userId, userId)))
      .run();
  }
}

export async function markRead(input: { spaceId: string }): Promise<ActionResult> {
  const viewer = await getViewer();
  const parsed = z.object({ spaceId: id }).safeParse(input);
  if (!parsed.success) return fail("Unknown space.");
  const access = getSpaceAccess(viewer, parsed.data.spaceId);
  if (!access?.canView) return fail("You can't see this space.");
  touchRead(access, viewer.id);
  publish({ type: "read", spaceId: access.space.id, userId: viewer.id });
  return ok(undefined);
}

export async function fetchThread(input: { messageId: string }): Promise<ActionResult<MessageDTO[]>> {
  const viewer = await getViewer();
  const parsed = z.object({ messageId: id }).safeParse(input);
  if (!parsed.success) return fail("That conversation isn't available.");
  const found = messageWithAccess(viewer, parsed.data.messageId);
  if ("error" in found) return fail(found.error);
  if (found.row.parentId) return fail("That conversation isn't available.");
  return ok(loadThread(found.row.id));
}

export async function fetchMessages(input: {
  spaceId: string;
  before?: number;
}): Promise<ActionResult<{ messages: MessageDTO[]; hasMore: boolean }>> {
  const viewer = await getViewer();
  const parsed = z.object({ spaceId: id, before: z.number().int().positive().optional() }).safeParse(input);
  if (!parsed.success) return fail("Unknown space.");
  const access = getSpaceAccess(viewer, parsed.data.spaceId);
  if (!access?.canView) return fail("You can't see this space.");
  return ok(loadSpaceMessages(access.space.id, { before: parsed.data.before }));
}

export async function fetchPinned(input: { spaceId: string }): Promise<ActionResult<MessageDTO[]>> {
  const viewer = await getViewer();
  const parsed = z.object({ spaceId: id }).safeParse(input);
  if (!parsed.success) return fail("Unknown space.");
  const access = getSpaceAccess(viewer, parsed.data.spaceId);
  if (!access?.canView) return fail("You can't see this space.");
  return ok(loadPinned(access.space.id));
}

/* ------------------------------------------------------------------ */
/* Spaces and groups                                                   */
/* ------------------------------------------------------------------ */

export async function joinSpace(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const spaceId = id.safeParse(formData.get("spaceId"));
  if (!spaceId.success) return;
  const access = getSpaceAccess(viewer, spaceId.data);
  if (!access?.canJoin) return;
  db.insert(quadMembers)
    .values({ spaceId: access.space.id, userId: viewer.id, lastReadAt: new Date() })
    .onConflictDoNothing()
    .run();
  revalidatePath("/quad", "layout");
  if (formData.get("open") === "1") redirect(spaceHref(access.space.id));
}

export async function leaveSpace(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const spaceId = id.safeParse(formData.get("spaceId"));
  if (!spaceId.success) return;
  const access = getSpaceAccess(viewer, spaceId.data);
  if (!access?.canLeave) return;
  db.delete(quadMembers)
    .where(and(eq(quadMembers.spaceId, access.space.id), eq(quadMembers.userId, viewer.id)))
    .run();
  revalidatePath("/quad", "layout");
  redirect(access.space.visibility === "open" ? "/quad/browse" : "/quad");
}

const EMOJI = z
  .string()
  .trim()
  .min(1, "Pick an emoji.")
  .max(16, "Pick a single emoji.")
  .refine((s) => !/[\p{L}\p{N}]/u.test(s), "Pick a single emoji.");

const spaceFields = {
  name: z.string().trim().min(2, "Give it a name.").max(60, "Keep the name under 60 characters."),
  emoji: EMOJI,
  description: z.string().trim().max(280, "Keep the description under 280 characters.").optional(),
  visibility: z.enum(["open", "private"]).default("open"),
  postingPolicy: z.enum(["everyone", "staff"]).default("everyone"),
};

export async function createSpace(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (viewer.role === "student") return { error: "Students can't create groups." };
  const parsed = z.object(spaceFields).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToFormState(parsed.error);
  // Families can create open community groups; staff can also make private
  // or announcement-style groups.
  const visibility = viewer.isStaff ? parsed.data.visibility : "open";
  const postingPolicy = viewer.isStaff ? parsed.data.postingPolicy : "everyone";

  const spaceId = newId();
  db.transaction((tx) => {
    tx.insert(quadSpaces)
      .values({
        id: spaceId,
        schoolId: viewer.schoolId,
        name: parsed.data.name,
        emoji: parsed.data.emoji,
        description: parsed.data.description || null,
        kind: "group",
        visibility,
        postingPolicy,
        createdBy: viewer.id,
      })
      .run();
    tx.insert(quadMembers)
      .values({ spaceId, userId: viewer.id, role: "moderator", lastReadAt: new Date() })
      .run();
  });
  revalidatePath("/quad", "layout");
  redirect(spaceHref(spaceId));
}

export async function updateSpace(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  const spaceId = id.safeParse(formData.get("spaceId"));
  const access = spaceId.success ? getSpaceAccess(viewer, spaceId.data) : null;
  if (!access?.canModerate) return { error: "Only staff and moderators can change this space." };
  const parsed = z.object(spaceFields).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToFormState(parsed.error);

  const { space } = access;
  const isGroup = space.kind === "group";
  db.update(quadSpaces)
    .set({
      // Automatic spaces keep their names so families can always find them.
      name: isAudienceKind(space.kind) && space.kind !== "school" ? space.name : parsed.data.name,
      emoji: parsed.data.emoji,
      description: parsed.data.description || null,
      visibility: isGroup && viewer.isStaff ? parsed.data.visibility : space.visibility,
      postingPolicy: space.kind === "announcements" ? "staff" : parsed.data.postingPolicy,
    })
    .where(eq(quadSpaces.id, space.id))
    .run();
  revalidatePath("/quad", "layout");
  return { ok: true, message: "Saved." };
}

export async function setArchived(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const spaceId = id.safeParse(formData.get("spaceId"));
  const access = spaceId.success ? getSpaceAccess(viewer, spaceId.data) : null;
  if (!access?.canModerate || access.space.kind !== "group") return;
  const archived = formData.get("archived") === "1";
  db.update(quadSpaces).set({ archived }).where(eq(quadSpaces.id, access.space.id)).run();
  revalidatePath("/quad", "layout");
}

export async function addMembers(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  const spaceId = id.safeParse(formData.get("spaceId"));
  const access = spaceId.success ? getSpaceAccess(viewer, spaceId.data) : null;
  if (!access?.canModerate || access.space.kind !== "group") return { error: "Only moderators can add people." };
  const ids = z.array(id).min(1, "Choose at least one person.").max(50).safeParse(formData.getAll("userId"));
  if (!ids.success) return { error: ids.error.issues[0]?.message };
  const allowed = new Set(listRecipients(viewer).filter((r) => r.role !== "student").map((r) => r.id));
  const toAdd = ids.data.filter((u) => allowed.has(u));
  if (!toAdd.length) return { error: "Those people can't be added." };
  db.insert(quadMembers)
    .values(toAdd.map((userId) => ({ spaceId: access.space.id, userId })))
    .onConflictDoNothing()
    .run();
  revalidatePath("/quad", "layout");
  return { ok: true, message: toAdd.length === 1 ? "Added 1 person." : `Added ${toAdd.length} people.` };
}

export async function updateMember(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const spaceId = id.safeParse(formData.get("spaceId"));
  const userId = id.safeParse(formData.get("userId"));
  const op = z.enum(["remove", "moderator", "member"]).safeParse(formData.get("op"));
  const access = spaceId.success ? getSpaceAccess(viewer, spaceId.data) : null;
  if (!access?.canModerate || access.space.kind !== "group" || !userId.success || !op.success) return;
  if (userId.data === viewer.id && op.data !== "moderator") return; // use "Leave" for yourself
  const where = and(eq(quadMembers.spaceId, access.space.id), eq(quadMembers.userId, userId.data));
  if (op.data === "remove") db.delete(quadMembers).where(where).run();
  else db.update(quadMembers).set({ role: op.data }).where(where).run();
  revalidatePath("/quad", "layout");
}

/* ------------------------------------------------------------------ */
/* Direct messages                                                     */
/* ------------------------------------------------------------------ */

/**
 * Finds or creates the direct-message space for the viewer and these people.
 * Everyone must be someone the viewer may message, and every pair of people
 * must be allowed to talk (a student only ever with staff).
 */
function openDirectSpace(viewer: Viewer, userIds: string[]): { spaceId: string } | { error: string } {
  const ids = z
    .array(id)
    .min(1, "Choose who you'd like to message.")
    .max(8, "Group messages can include up to 8 people.")
    .safeParse([...new Set(userIds)].filter((u) => u !== viewer.id));
  if (!ids.success) return { error: ids.error.issues[0]?.message ?? "Choose who you'd like to message." };

  const recipients = new Map(listRecipients(viewer).map((r) => [r.id, r]));
  const people = ids.data.map((u) => recipients.get(u));
  if (people.some((p) => !p)) return { error: "You can't message one of those people." };
  const roles = people.map((p) => p!.role);
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      if (!canPairMessage(roles[i]!, roles[j]!)) return { error: "Students can only be in conversations with staff." };
    }
  }

  const memberIds = [viewer.id, ...ids.data];
  const existing = findDirectSpace(viewer.schoolId, memberIds);
  if (existing) return { spaceId: existing };

  const spaceId = newId();
  db.transaction((tx) => {
    tx.insert(quadSpaces)
      .values({
        id: spaceId,
        schoolId: viewer.schoolId,
        name: "Direct message",
        emoji: "✉️",
        kind: "direct",
        visibility: "private",
        createdBy: viewer.id,
      })
      .run();
    tx.insert(quadMembers)
      .values(memberIds.map((userId) => ({ spaceId, userId, lastReadAt: userId === viewer.id ? new Date() : null })))
      .run();
  });
  return { spaceId };
}

/** The "New message" form: one or more people. */
export async function startDirectMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  const result = openDirectSpace(viewer, formData.getAll("to").map(String));
  if ("error" in result) return { error: result.error };
  redirect(spaceHref(result.spaceId));
}

/** "Message Mr Reyes" buttons: returns where to go. */
export async function messagePerson(input: { userId: string }): Promise<ActionResult<{ href: string }>> {
  const viewer = await getViewer();
  const result = openDirectSpace(viewer, [String(input?.userId ?? "")]);
  if ("error" in result) return fail(result.error);
  return ok({ href: spaceHref(result.spaceId) });
}


/* ------------------------------------------------------------------ */
/* Moderation                                                          */
/* ------------------------------------------------------------------ */

export async function resolveReport(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!viewer.isStaff) return;
  const reportId = id.safeParse(formData.get("reportId"));
  const op = z.enum(["remove", "dismiss"]).safeParse(formData.get("op"));
  if (!reportId.success || !op.success) return;
  const report = db.select().from(quadReports).where(eq(quadReports.id, reportId.data)).get();
  if (!report) return;
  const row = getMessageRow(report.messageId);
  const access = row ? getSpaceAccess(viewer, row.spaceId) : null;
  // Reports can come from DMs, which staff can't otherwise open; a report is
  // an explicit request for staff to look, so school membership is enough.
  if (!row || !access) return;

  if (op.data === "remove") {
    removeMessage(row, viewer.id);
    broadcastUpdate(row.id);
    if (row.parentId) broadcastUpdate(row.parentId);
  } else {
    db.update(quadReports)
      .set({ status: "resolved", resolvedBy: viewer.id })
      .where(and(eq(quadReports.messageId, row.id), eq(quadReports.status, "open")))
      .run();
  }
  revalidatePath("/quad", "layout");
}

/* ------------------------------------------------------------------ */
/* Guidelines                                                          */
/* ------------------------------------------------------------------ */

export async function dismissGuidelines(): Promise<void> {
  await getViewer();
  (await cookies()).set("quad_guidelines", "seen", {
    httpOnly: true,
    sameSite: "lax",
    path: "/quad",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/quad");
}
