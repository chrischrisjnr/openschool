"use client";

import { PlusIcon, TrashIcon } from "@primer/octicons-react";
import { Button, FormControl, IconButton, TextInput, Textarea } from "@primer/react";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import type { FormState } from "@/lib/form";
import styles from "../campaigns/[id]/campaign.module.css";
import { keepValuesOnSubmit } from "./useKeepValues";

export type CampaignFormValues = {
  campaignId?: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  cause: string;
  eventDate: string;
  startDate: string;
  endDate: string;
  goal: string;
  studentGoal: string;
  pointsPerDollar: string;
  tiers: { emoji: string; name: string; threshold: string; description: string }[];
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

let tierKey = 0;
type TierRow = CampaignFormValues["tiers"][number] & { key: number };

function Field({
  label,
  name,
  error,
  caption,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  caption?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <FormControl required={required} id={`f-${name}`}>
      <FormControl.Label>{label}</FormControl.Label>
      {children}
      {caption ? <FormControl.Caption>{caption}</FormControl.Caption> : null}
      {error ? <FormControl.Validation variant="error">{error}</FormControl.Validation> : null}
    </FormControl>
  );
}

export function CampaignForm({
  initial,
  action,
  submitLabel,
  publicBase,
}: {
  initial: CampaignFormValues;
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  submitLabel: string;
  /** e.g. "school.org/give/" — shown next to the slug */
  publicBase: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugEdited, setSlugEdited] = useState(Boolean(initial.campaignId));
  const [tiers, setTiers] = useState<TierRow[]>(() => initial.tiers.map((t) => ({ ...t, key: tierKey++ })));
  const err = state?.fieldErrors ?? {};

  const updateTier = (key: number, patch: Partial<TierRow>) => setTiers((list) => list.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const tiersJson = JSON.stringify(
    tiers.map(({ emoji, name: n, threshold, description }) => ({ emoji, name: n, threshold: threshold.replace(/[$,\s]/g, ""), description })),
  );

  return (
    <form action={formAction} onSubmit={keepValuesOnSubmit(formAction)} className={styles.stack}>
      {initial.campaignId ? <input type="hidden" name="campaignId" value={initial.campaignId} /> : null}
      <input type="hidden" name="tiers" value={tiersJson} />

      <Card title="The basics">
        <div className={styles.formGrid}>
          <div className={styles.formFull}>
            <Field label="Campaign name" name="name" error={err.name} required>
              <TextInput
                name="name"
                block
                maxLength={80}
                value={name}
                placeholder="Colour Run 2027"
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugEdited) setSlug(slugify(e.target.value));
                }}
              />
            </Field>
          </div>
          <div className={styles.formFull}>
            <Field label="Web address" name="slug" error={err.slug} caption={
                initial.campaignId
                  ? "Careful: changing this breaks QR codes and links that have already been shared."
                  : "The link families share. Lowercase letters, numbers and dashes."
              }
              required
            >
              <TextInput
                name="slug"
                block
                leadingVisual={() => <span className={styles.muted}>{publicBase}</span>}
                value={slug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value));
                  setSlugEdited(true);
                }}
              />
            </Field>
          </div>
          <div className={styles.formFull}>
            <Field label="Tagline" name="tagline" error={err.tagline} caption="One cheerful sentence for the top of the page.">
              <TextInput name="tagline" block maxLength={140} defaultValue={initial.tagline} placeholder="Run, walk or dance through a rainbow!" />
            </Field>
          </div>
          <div className={styles.formFull}>
            <Field label="What the money is for" name="cause" error={err.cause} caption="Donors love knowing exactly what they’re helping with.">
              <TextInput name="cause" block maxLength={140} defaultValue={initial.cause} placeholder="New shade sails for the playground" />
            </Field>
          </div>
          <div className={styles.formFull}>
            <Field label="Description" name="description" error={err.description}>
              <Textarea name="description" block rows={5} maxLength={4000} defaultValue={initial.description} placeholder="What’s happening, when, and how families can help." />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Dates & goals">
        <div className={styles.formGrid}>
          <Field label="Event day" name="eventDate" error={err.eventDate}>
            <TextInput name="eventDate" type="date" block defaultValue={initial.eventDate} />
          </Field>
          <Field label="Donations open" name="startDate" error={err.startDate} required>
            <TextInput name="startDate" type="date" block defaultValue={initial.startDate} />
          </Field>
          <Field label="Donations close" name="endDate" error={err.endDate} required>
            <TextInput name="endDate" type="date" block defaultValue={initial.endDate} />
          </Field>
          <Field label="School goal" name="goal" error={err.goal} required>
            <TextInput name="goal" leadingVisual="$" inputMode="decimal" block defaultValue={initial.goal} />
          </Field>
          <Field label="Default goal per student" name="studentGoal" error={err.studentGoal} caption="Families can change their own." required>
            <TextInput name="studentGoal" leadingVisual="$" inputMode="decimal" block defaultValue={initial.studentGoal} />
          </Field>
          <Field label="Points per dollar" name="pointsPerDollar" error={err.pointsPerDollar} caption="Powers the class and house leaderboards." required>
            <TextInput name="pointsPerDollar" type="number" min={1} max={100} block defaultValue={initial.pointsPerDollar} />
          </Field>
        </div>
      </Card>

      <Card
        title="Prize tiers"
        action={
          <Button
            size="small"
            leadingVisual={PlusIcon}
            onClick={() => setTiers((list) => [...list, { key: tierKey++, emoji: "🎁", name: "", threshold: "", description: "" }])}
            disabled={tiers.length >= 12}
          >
            Add tier
          </Button>
        }
      >
        <div className={styles.stackSmall}>
          <p className={styles.muted} style={{ margin: 0 }}>
            Students unlock each prize when their total reaches the amount. Kids love them — keep them cheap and cheerful!
          </p>
          {err.tiers ? <FormMessage state={{ error: err.tiers }} /> : null}
          <div className={styles.tierRows}>
            {tiers.map((t, i) => (
              <div key={t.key} className={styles.tierRow}>
                <FormControl>
                  <FormControl.Label visuallyHidden={i > 0}>Emoji</FormControl.Label>
                  <TextInput value={t.emoji} maxLength={16} onChange={(e) => updateTier(t.key, { emoji: e.target.value })} block aria-label={i > 0 ? `Tier ${i + 1} emoji` : undefined} />
                </FormControl>
                <FormControl>
                  <FormControl.Label visuallyHidden={i > 0}>Name</FormControl.Label>
                  <TextInput value={t.name} maxLength={40} placeholder="Colour Crew" onChange={(e) => updateTier(t.key, { name: e.target.value })} block aria-label={i > 0 ? `Tier ${i + 1} name` : undefined} />
                </FormControl>
                <FormControl>
                  <FormControl.Label visuallyHidden={i > 0}>Raise</FormControl.Label>
                  <TextInput value={t.threshold} leadingVisual="$" inputMode="numeric" placeholder="20" onChange={(e) => updateTier(t.key, { threshold: e.target.value })} block aria-label={i > 0 ? `Tier ${i + 1} amount` : undefined} />
                </FormControl>
                <FormControl>
                  <FormControl.Label visuallyHidden={i > 0}>Prize</FormControl.Label>
                  <TextInput value={t.description} maxLength={120} placeholder="Sweatband" onChange={(e) => updateTier(t.key, { description: e.target.value })} block aria-label={i > 0 ? `Tier ${i + 1} prize` : undefined} />
                </FormControl>
                <IconButton icon={TrashIcon} aria-label={`Remove ${t.name || "tier"}`} variant="invisible" onClick={() => setTiers((list) => list.filter((x) => x.key !== t.key))} />
              </div>
            ))}
            {!tiers.length ? <p className={styles.muted}>No prize tiers.</p> : null}
          </div>
        </div>
      </Card>

      <FormMessage state={state} />
      <div>
        <Button type="submit" variant="primary" size="large" loading={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
