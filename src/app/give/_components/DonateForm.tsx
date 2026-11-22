"use client";

import { HeartFillIcon, LockIcon } from "@primer/octicons-react";
import { Button, Checkbox, FormControl, TextInput, Textarea } from "@primer/react";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/ui";
import { formatMoney, parseMoneyToCents } from "@/lib/format";
import { PRESET_AMOUNTS } from "@/lib/fete/constants";
import { keepValuesOnSubmit } from "../../(suite)/fete/_components/useKeepValues";
import { donate } from "../actions";
import styles from "../give.module.css";

/**
 * The public donation form. Preset amounts + custom, donor details and an
 * optional message. A hidden honeypot field catches naive bots.
 */
export function DonateForm({
  campaignSlug,
  code,
  recipient,
  demoMode,
}: {
  campaignSlug: string;
  code?: string;
  /** "Mia" or "Wattle Creek PS" */
  recipient: string;
  demoMode: boolean;
}) {
  const [state, dispatch, pending] = useActionState(donate, undefined);
  const [preset, setPreset] = useState<string>("20");
  const [custom, setCustom] = useState("");
  const amount = preset === "custom" ? custom : preset;
  const cents = parseMoneyToCents(amount);
  const err = state?.fieldErrors ?? {};

  return (
    <form action={dispatch} onSubmit={keepValuesOnSubmit(dispatch)} className={styles.formGrid} noValidate>
      <input type="hidden" name="campaign" value={campaignSlug} />
      {code ? <input type="hidden" name="code" value={code} /> : null}
      <input type="hidden" name="amount" value={amount} />

      <fieldset className={styles.amounts}>
        <legend>Choose an amount</legend>
        {PRESET_AMOUNTS.map((a) => (
          <label key={a} className={styles.amount}>
            <input type="radio" name="preset" value={String(a)} checked={preset === String(a)} onChange={() => setPreset(String(a))} />
            <span>${a}</span>
          </label>
        ))}
      </fieldset>
      <FormControl>
        <FormControl.Label>Or enter your own amount</FormControl.Label>
        <TextInput
          leadingVisual="$"
          inputMode="decimal"
          placeholder="35"
          value={custom}
          block
          size="large"
          onFocus={() => setPreset("custom")}
          onChange={(e) => {
            setCustom(e.target.value);
            setPreset(e.target.value ? "custom" : "20");
          }}
          aria-describedby="amount-hint"
        />
        <FormControl.Caption id="amount-hint">Between $2 and $5,000.</FormControl.Caption>
        {err.amount ? <FormControl.Validation variant="error">{err.amount}</FormControl.Validation> : null}
      </FormControl>

      <FormControl required>
        <FormControl.Label>Your name</FormControl.Label>
        <TextInput name="donorName" autoComplete="name" maxLength={80} block size="large" placeholder="e.g. Grandma Jo" />
        {err.donorName ? <FormControl.Validation variant="error">{err.donorName}</FormControl.Validation> : null}
      </FormControl>
      <FormControl required>
        <FormControl.Label>Email</FormControl.Label>
        <TextInput name="donorEmail" type="email" autoComplete="email" maxLength={200} block size="large" placeholder="you@example.com" />
        <FormControl.Caption>For your receipt. Never shown publicly.</FormControl.Caption>
        {err.donorEmail ? <FormControl.Validation variant="error">{err.donorEmail}</FormControl.Validation> : null}
      </FormControl>
      <FormControl>
        <FormControl.Label>Message for {recipient} (optional)</FormControl.Label>
        <Textarea name="message" maxLength={280} rows={3} block placeholder="Good luck! Have the best time 🌈" />
        {err.message ? <FormControl.Validation variant="error">{err.message}</FormControl.Validation> : null}
      </FormControl>
      <FormControl>
        <Checkbox name="anonymous" value="on" />
        <FormControl.Label>Hide my name on the page</FormControl.Label>
        <FormControl.Caption>You’ll show as “A kind supporter”.</FormControl.Caption>
      </FormControl>

      {/* Honeypot — leave empty. Hidden from people and screen readers. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <FormMessage state={state} />
      <Button type="submit" variant="primary" size="large" block loading={pending} leadingVisual={HeartFillIcon}>
        {pending ? "Just a moment…" : cents && cents >= 200 ? `Donate ${formatMoney(cents, { whole: true })}` : "Donate"}
      </Button>
      <p className={styles.fine}>
        <LockIcon size={12} /> {demoMode ? "Demo mode — no real money changes hands." : "Secure payment by Stripe."} Your donation goes to the school.
      </p>
    </form>
  );
}
