/** zod schemas for every Fete form. Server-side validation is authoritative. */
import { z } from "zod";
import { parseMoneyToCents } from "@/lib/format";

import { MAX_DONATION_CENTS, MIN_DONATION_CENTS } from "./constants";

const trimmed = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .optional()
    .transform((v) => (v ? v : null));

/** "$25" / "25.50" → cents, with friendly messages and bounds. */
export const money = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}`)
    .transform((v, ctx) => {
      const cents = parseMoneyToCents(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} in dollars, like 25 or 25.50` });
        return z.NEVER;
      }
      return cents;
    })
    .pipe(
      z
        .number()
        .int()
        .min(min, `${label[0]!.toUpperCase()}${label.slice(1)} must be at least $${(min / 100).toLocaleString("en-AU")}`)
        .max(max, `${label[0]!.toUpperCase()}${label.slice(1)} can be at most $${(max / 100).toLocaleString("en-AU")}`),
    );

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === "1");

/* ---------- Public donation form ---------- */

export const donationSchema = z.object({
  amount: money("the amount", MIN_DONATION_CENTS, MAX_DONATION_CENTS),
  donorName: trimmed(80, "Your name").min(1, "Please tell us your name"),
  donorEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .email("Enter a valid email so we can send your receipt"),
  message: optionalText(280, "Your message"),
  anonymous: checkbox,
  /** Honeypot: real people never see or fill this in. */
  website: z.string().max(0).optional(),
});

/* ---------- Staff: campaigns ---------- */

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

export const tierSchema = z.object({
  emoji: z.string().trim().min(1, "Each prize needs an emoji").max(16),
  name: z.string().trim().min(1, "Each prize needs a name").max(40),
  threshold: z.coerce.number().int("Prize amounts are whole dollars").min(1, "Prize amounts must be at least $1").max(100_000),
  description: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
});

export const campaignSchema = z
  .object({
    name: trimmed(80, "Name").min(3, "Give the campaign a name"),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "The web address needs at least 3 characters")
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes only"),
    tagline: optionalText(140, "Tagline"),
    description: optionalText(4000, "Description"),
    cause: optionalText(140, "What the money is for"),
    eventDate: z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .pipe(day.nullable()),
    startDate: day,
    endDate: day,
    goal: money("the goal", 10_000, 100_000_000),
    studentGoal: money("the student goal", 500, 1_000_000),
    pointsPerDollar: z.coerce.number().int().min(1, "At least 1 point per dollar").max(100),
    tiers: z
      .string()
      .transform((v, ctx) => {
        try {
          return JSON.parse(v || "[]") as unknown;
        } catch {
          ctx.addIssue({ code: "custom", message: "Prize tiers couldn't be read" });
          return z.NEVER;
        }
      })
      .pipe(z.array(tierSchema).max(12, "Up to 12 prize tiers")),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "The end date must be after the start date", path: ["endDate"] });

export const statusSchema = z.object({
  campaignId: z.string().min(1),
  status: z.enum(["draft", "live", "closed"]),
});

export const enrolSchema = z.object({
  campaignId: z.string().min(1),
  scope: z.enum(["all", "years"]),
  years: z.array(z.coerce.number().int().min(0).max(12)).default([]),
});

export const cashSchema = z.object({
  campaignId: z.string().min(1),
  participantId: z.string().optional().transform((v) => (v ? v : null)),
  amount: money("the amount", 100, MAX_DONATION_CENTS),
  donorName: trimmed(80, "Name").optional().transform((v) => v || "Cash donation"),
  message: optionalText(280, "Note"),
});

export const awardSchema = z.object({
  campaignId: z.string().min(1),
  targetType: z.enum(["student", "class", "year", "house"]),
  targetId: z.string().min(1, "Choose who gets the points"),
  points: z.coerce
    .number({ message: "Enter a number of points" })
    .int("Points are whole numbers")
    .min(-10_000)
    .max(10_000)
    .refine((n) => n !== 0, "Points can't be zero"),
  reason: trimmed(120, "Reason").min(2, "Say what the points are for"),
});

/* ---------- Families ---------- */

export const participationSchema = z.object({
  participantId: z.string().min(1),
  pitch: optionalText(500, "Your message"),
  goal: money("the goal", 500, 1_000_000),
});
