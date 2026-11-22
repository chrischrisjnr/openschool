"use client";

import { FormControl, Radio, RadioGroup, TextInput, Textarea } from "@primer/react";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import styles from "./quad.module.css";

const EMOJI = ["💬", "🤝", "🙋", "⚽", "🏉", "🏊", "📚", "🎨", "🎵", "🌱", "🍳", "🧺", "🎉", "🚲", "🧩", "❤️"];

export type SpaceFormValues = {
  spaceId?: string;
  name: string;
  emoji: string;
  description: string;
  visibility: "open" | "private";
  postingPolicy: "everyone" | "staff";
};

/** Create / edit form for a space. Fields a person can't change are hidden. */
export function SpaceForm({
  action,
  initial,
  submitLabel,
  canRename = true,
  showVisibility,
  showPostingPolicy,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: SpaceFormValues;
  submitLabel: string;
  canRename?: boolean;
  showVisibility: boolean;
  showPostingPolicy: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const emojiChoices = EMOJI.includes(initial.emoji) ? EMOJI : [initial.emoji, ...EMOJI];
  return (
    <form action={formAction} className={styles.form}>
      {initial.spaceId ? <input type="hidden" name="spaceId" value={initial.spaceId} /> : null}
      <FormMessage state={state} />

      <FormControl required={canRename} disabled={!canRename}>
        <FormControl.Label>Name</FormControl.Label>
        <TextInput name="name" defaultValue={initial.name} block size="large" maxLength={60} placeholder="e.g. Under 10s netball" />
        {!canRename ? <FormControl.Caption>Class and year spaces keep their names so families can find them.</FormControl.Caption> : null}
        {state?.fieldErrors?.name ? <FormControl.Validation variant="error">{state.fieldErrors.name}</FormControl.Validation> : null}
      </FormControl>
      {!canRename ? <input type="hidden" name="name" value={initial.name} /> : null}

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Icon</legend>
        <div className={styles.emojiRow}>
          {emojiChoices.map((e) => (
            <label key={e} className={styles.emojiChoice}>
              <input type="radio" name="emoji" value={e} defaultChecked={e === initial.emoji} aria-label={e} />
              <span aria-hidden>{e}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormControl>
        <FormControl.Label>Description</FormControl.Label>
        <Textarea
          name="description"
          defaultValue={initial.description}
          block
          rows={3}
          maxLength={280}
          resize="vertical"
          placeholder="What's this group for? Who should join?"
        />
        {state?.fieldErrors?.description ? (
          <FormControl.Validation variant="error">{state.fieldErrors.description}</FormControl.Validation>
        ) : null}
      </FormControl>

      {showVisibility ? (
        <RadioGroup name="visibility">
          <RadioGroup.Label>Who can join?</RadioGroup.Label>
          <FormControl>
            <Radio value="open" defaultChecked={initial.visibility === "open"} />
            <FormControl.Label>Anyone in the school community</FormControl.Label>
            <FormControl.Caption>Listed in Browse groups. Families can join and leave.</FormControl.Caption>
          </FormControl>
          <FormControl>
            <Radio value="private" defaultChecked={initial.visibility === "private"} />
            <FormControl.Label>Invite only</FormControl.Label>
            <FormControl.Caption>Hidden from Browse. Moderators add people.</FormControl.Caption>
          </FormControl>
        </RadioGroup>
      ) : (
        <input type="hidden" name="visibility" value={initial.visibility} />
      )}

      {showPostingPolicy ? (
        <RadioGroup name="postingPolicy">
          <RadioGroup.Label>Who can post?</RadioGroup.Label>
          <FormControl>
            <Radio value="everyone" defaultChecked={initial.postingPolicy === "everyone"} />
            <FormControl.Label>Everyone</FormControl.Label>
          </FormControl>
          <FormControl>
            <Radio value="staff" defaultChecked={initial.postingPolicy === "staff"} />
            <FormControl.Label>Only staff and moderators</FormControl.Label>
            <FormControl.Caption>Good for announcements. Everyone can still react.</FormControl.Caption>
          </FormControl>
        </RadioGroup>
      ) : (
        <input type="hidden" name="postingPolicy" value={initial.postingPolicy} />
      )}

      <div className={styles.formActions}>
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
