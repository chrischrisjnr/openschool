/**
 * Open Schools database schema.
 *
 * One database serves the whole suite (Assemble, Quad and FETE) so that a
 * family has a single login and the same students, classes and houses are
 * shared by every app.
 *
 * Conventions
 * - Primary keys are short random strings (see `newId()` in ./ids.ts).
 * - Money is always stored as integer cents (AUD) — never floats.
 * - Timestamps are stored as milliseconds and surface as JS `Date`s.
 * - Calendar-day values (attendance dates, absence ranges) are ISO
 *   `YYYY-MM-DD` strings in the school's local timezone.
 * - "Audience" columns describe who can see something:
 *     audienceType = 'school' | 'staff' | 'year' | 'class' | 'house'
 *     audienceId   = null for school/staff, the year number as text for
 *                    'year', or the class / house id.
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

export type Role = "admin" | "staff" | "parent" | "student";
export type AudienceType = "school" | "staff" | "year" | "class" | "house";

/* ------------------------------------------------------------------ */
/* Core: schools, people, classes                                      */
/* ------------------------------------------------------------------ */

export const schools = sqliteTable("schools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  slug: text("slug").notNull().unique(),
  suburb: text("suburb"),
  state: text("state").notNull().default("VIC"),
  timezone: text("timezone").notNull().default("Australia/Melbourne"),
  phone: text("phone"),
  email: text("email"),
  /** ABN shown on receipts. */
  abn: text("abn"),
  createdAt: createdAt(),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** Optional display title e.g. "Principal", "Year 3 teacher". */
    title: text("title"),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: text("role").$type<Role>().notNull(),
    disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    /** SHA-256 hash of the session token (the raw token only lives in the cookie). */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const houses = sqliteTable("houses", {
  id: text("id").primaryKey(),
  schoolId: text("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** A Primer label colour scheme name e.g. "blue", "green", "red", "yellow". */
  color: text("color").notNull().default("blue"),
});

export const classes = sqliteTable(
  "classes",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    /** e.g. "3B" or "Foundation K". */
    name: text("name").notNull(),
    /** 0 = Foundation / Prep / Kindergarten, 1–12 = Year 1–12. */
    yearLevel: integer("year_level").notNull(),
    teacherId: text("teacher_id").references(() => users.id, {
      onDelete: "set null",
    }),
    room: text("room"),
  },
  (t) => [index("classes_school_idx").on(t.schoolId)],
);

export const students = sqliteTable(
  "students",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    /** Optional login for older students. */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    preferredName: text("preferred_name"),
    classId: text("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    houseId: text("house_id").references(() => houses.id, {
      onDelete: "set null",
    }),
    yearLevel: integer("year_level").notNull(),
    dateOfBirth: text("date_of_birth"),
    /** Medical / dietary notes visible to staff only. */
    medicalNotes: text("medical_notes"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("students_school_idx").on(t.schoolId),
    index("students_class_idx").on(t.classId),
  ],
);

/** Links parent/carer accounts to the students they are responsible for. */
export const guardians = sqliteTable(
  "guardians",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("Parent"),
    /** Receives formal correspondence and is the default payer. */
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.studentId] }),
    index("guardians_student_idx").on(t.studentId),
  ],
);

/* ------------------------------------------------------------------ */
/* Payments (shared by Assemble charges and FETE donations)            */
/* ------------------------------------------------------------------ */

export type PaymentStatus = "pending" | "succeeded" | "failed" | "cancelled";
export type PaymentPurpose = "charges" | "donation";

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    /** 'demo' (simulated, no money moves) or 'stripe'. */
    provider: text("provider").notNull(),
    /** Provider's reference, e.g. Stripe Checkout Session id. */
    providerRef: text("provider_ref"),
    purpose: text("purpose").$type<PaymentPurpose>().notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").$type<PaymentStatus>().notNull().default("pending"),
    payerUserId: text("payer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    payerName: text("payer_name"),
    payerEmail: text("payer_email"),
    /** Where to send the payer once the payment completes. */
    returnPath: text("return_path").notNull().default("/"),
    createdAt: createdAt(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("payments_school_idx").on(t.schoolId)],
);

/* ------------------------------------------------------------------ */
/* Assemble: notices, calendar, permission & payments, attendance      */
/* ------------------------------------------------------------------ */

export const notices = sqliteTable(
  "notices",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    /** Plain text with blank-line paragraphs; rendered safely (no HTML). */
    body: text("body").notNull(),
    category: text("category").notNull().default("general"),
    audienceType: text("audience_type").$type<AudienceType>().notNull(),
    audienceId: text("audience_id"),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    /** Families must tap "I've read this" — read receipts are tracked. */
    requiresAck: integer("requires_ack", { mode: "boolean" })
      .notNull()
      .default(false),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("notices_school_idx").on(t.schoolId, t.publishedAt)],
);

export const noticeReads = sqliteTable(
  "notice_reads",
  {
    noticeId: text("notice_id")
      .notNull()
      .references(() => notices.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: integer("read_at", { mode: "timestamp_ms" }).notNull(),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp_ms" }),
  },
  (t) => [primaryKey({ columns: [t.noticeId, t.userId] })],
);

export type EventCategory =
  | "event"
  | "excursion"
  | "sport"
  | "meeting"
  | "holiday"
  | "term";

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    category: text("category").$type<EventCategory>().notNull().default("event"),
    audienceType: text("audience_type").$type<AudienceType>().notNull(),
    audienceId: text("audience_id"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("events_school_idx").on(t.schoolId, t.startsAt)],
);

/**
 * Something families must respond to: an excursion that needs consent and
 * payment, a camp deposit, a levy, or a consent-only form (amount 0).
 */
export const paymentItems = sqliteTable(
  "payment_items",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull().default("excursion"),
    /** Per-student amount in cents. 0 = consent only. */
    amountCents: integer("amount_cents").notNull().default(0),
    requiresConsent: integer("requires_consent", { mode: "boolean" })
      .notNull()
      .default(false),
    dueAt: integer("due_at", { mode: "timestamp_ms" }),
    eventId: text("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    audienceType: text("audience_type").$type<AudienceType>().notNull(),
    audienceId: text("audience_id"),
    closed: integer("closed", { mode: "boolean" }).notNull().default(false),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("payment_items_school_idx").on(t.schoolId)],
);

export type ChargeStatus = "unpaid" | "paid" | "waived";
export type ConsentStatus = "pending" | "granted" | "declined";

/** One row per student a payment item applies to. */
export const studentCharges = sqliteTable(
  "student_charges",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => paymentItems.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").$type<ChargeStatus>().notNull().default("unpaid"),
    /** null when the item does not require consent. */
    consent: text("consent").$type<ConsentStatus>(),
    consentBy: text("consent_by").references(() => users.id, {
      onDelete: "set null",
    }),
    consentAt: integer("consent_at", { mode: "timestamp_ms" }),
    paymentId: text("payment_id").references(() => payments.id, {
      onDelete: "set null",
    }),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("student_charges_item_student_idx").on(t.itemId, t.studentId),
    index("student_charges_student_idx").on(t.studentId),
    index("student_charges_payment_idx").on(t.paymentId),
  ],
);

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export const attendance = sqliteTable(
  "attendance",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD in school local time. */
    date: text("date").notNull(),
    status: text("status").$type<AttendanceStatus>().notNull(),
    note: text("note"),
    recordedBy: text("recorded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("attendance_student_date_idx").on(t.studentId, t.date),
    index("attendance_date_idx").on(t.date),
  ],
);

export type AbsenceReason =
  | "illness"
  | "medical"
  | "family"
  | "holiday"
  | "other";

/** Parent-submitted absence notes (in advance or after the fact). */
export const absenceNotes = sqliteTable(
  "absence_notes",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    submittedBy: text("submitted_by")
      .notNull()
      .references(() => users.id),
    fromDate: text("from_date").notNull(),
    toDate: text("to_date").notNull(),
    reason: text("reason").$type<AbsenceReason>().notNull(),
    note: text("note"),
    status: text("status")
      .$type<"submitted" | "approved">()
      .notNull()
      .default("submitted"),
    reviewedBy: text("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("absence_notes_student_idx").on(t.studentId)],
);

/* ------------------------------------------------------------------ */
/* Quad: community spaces and messages                                 */
/* ------------------------------------------------------------------ */

export type SpaceKind = "announcements" | "school" | "year" | "class" | "group" | "direct";

export const quadSpaces = sqliteTable(
  "quad_spaces",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** A single emoji shown next to the space name. */
    emoji: text("emoji").notNull().default("💬"),
    kind: text("kind").$type<SpaceKind>().notNull(),
    /**
     * For school/year/class spaces membership is automatic from the
     * audience; group and direct spaces use explicit quad_members rows.
     */
    audienceType: text("audience_type").$type<AudienceType>(),
    audienceId: text("audience_id"),
    /** 'open' groups can be joined by anyone; 'private' are invite only. */
    visibility: text("visibility").$type<"open" | "private">().notNull().default("open"),
    /** 'staff' = only staff/moderators may post (announcement style). */
    postingPolicy: text("posting_policy")
      .$type<"everyone" | "staff">()
      .notNull()
      .default("everyone"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("quad_spaces_school_idx").on(t.schoolId)],
);

export const quadMembers = sqliteTable(
  "quad_members",
  {
    spaceId: text("space_id")
      .notNull()
      .references(() => quadSpaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<"member" | "moderator">().notNull().default("member"),
    /** Used for unread counts. Also present for auto-membership spaces. */
    lastReadAt: integer("last_read_at", { mode: "timestamp_ms" }),
    muted: integer("muted", { mode: "boolean" }).notNull().default(false),
    joinedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.spaceId, t.userId] }),
    index("quad_members_user_idx").on(t.userId),
  ],
);

export const quadMessages = sqliteTable(
  "quad_messages",
  {
    id: text("id").primaryKey(),
    spaceId: text("space_id")
      .notNull()
      .references(() => quadSpaces.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    /** Set for thread replies. */
    parentId: text("parent_id"),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    deletedBy: text("deleted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("quad_messages_space_idx").on(t.spaceId, t.createdAt),
    index("quad_messages_parent_idx").on(t.parentId),
  ],
);

export const quadReactions = sqliteTable(
  "quad_reactions",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => quadMessages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] })],
);

export const quadReports = sqliteTable("quad_reports", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => quadMessages.id, { onDelete: "cascade" }),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  status: text("status").$type<"open" | "resolved">().notNull().default("open"),
  resolvedBy: text("resolved_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* FETE: fundraising campaigns                                         */
/* ------------------------------------------------------------------ */

export const feteCampaigns = sqliteTable("fete_campaigns", {
  id: text("id").primaryKey(),
  schoolId: text("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  /** Used in public URLs: /give/<slug> */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  /** What the money will be spent on — shown to donors. */
  cause: text("cause"),
  eventDate: text("event_date"),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  goalCents: integer("goal_cents").notNull(),
  defaultStudentGoalCents: integer("default_student_goal_cents")
    .notNull()
    .default(10000),
  /** Points earned for every whole dollar raised. */
  pointsPerDollar: integer("points_per_dollar").notNull().default(1),
  status: text("status").$type<"draft" | "live" | "closed">().notNull().default("draft"),
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
});

/** Reward levels a student unlocks as they raise more. */
export const fetePrizeTiers = sqliteTable("fete_prize_tiers", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => feteCampaigns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🎁"),
  thresholdCents: integer("threshold_cents").notNull(),
  description: text("description"),
});

export const feteParticipants = sqliteTable(
  "fete_participants",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => feteCampaigns.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** Short, unguessable public code for the student's page & QR code. */
    code: text("code").notNull().unique(),
    goalCents: integer("goal_cents").notNull(),
    /** A short message from the student / family shown on their page. */
    pitch: text("pitch"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("fete_participants_campaign_student_idx").on(
      t.campaignId,
      t.studentId,
    ),
  ],
);

export const feteDonations = sqliteTable(
  "fete_donations",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => feteCampaigns.id, { onDelete: "cascade" }),
    /** null = donated to the school's general campaign page. */
    participantId: text("participant_id").references(() => feteParticipants.id, {
      onDelete: "set null",
    }),
    amountCents: integer("amount_cents").notNull(),
    donorName: text("donor_name").notNull(),
    donorEmail: text("donor_email"),
    message: text("message"),
    /** Hide the donor's name on public pages. */
    anonymous: integer("anonymous", { mode: "boolean" }).notNull().default(false),
    method: text("method").$type<"online" | "cash">().notNull().default("online"),
    status: text("status")
      .$type<"pending" | "succeeded" | "failed">()
      .notNull()
      .default("pending"),
    paymentId: text("payment_id").references(() => payments.id, {
      onDelete: "set null",
    }),
    recordedBy: text("recorded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("fete_donations_campaign_idx").on(t.campaignId, t.status),
    index("fete_donations_participant_idx").on(t.participantId),
    index("fete_donations_payment_idx").on(t.paymentId),
  ],
);

/** Manual bonus (or penalty) points, e.g. "Best costume — 3B +50". */
export const fetePointAwards = sqliteTable("fete_point_awards", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => feteCampaigns.id, { onDelete: "cascade" }),
  targetType: text("target_type")
    .$type<"student" | "class" | "year" | "house">()
    .notNull(),
  /** participant id, class id, year number (as text) or house id. */
  targetId: text("target_id").notNull(),
  points: integer("points").notNull(),
  reason: text("reason").notNull(),
  awardedBy: text("awarded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
});

export type School = typeof schools.$inferSelect;
export type User = typeof users.$inferSelect;
export type Student = typeof students.$inferSelect;
export type SchoolClass = typeof classes.$inferSelect;
export type House = typeof houses.$inferSelect;
export type Payment = typeof payments.$inferSelect;
