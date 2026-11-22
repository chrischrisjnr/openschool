"use client";

import { Banner, Dialog, FormControl, Radio, RadioGroup, Textarea } from "@primer/react";
import { useState, useTransition } from "react";
import { reportMessage } from "../../actions";
import type { MessageDTO } from "@/lib/quad/types";
import styles from "./chat.module.css";

const REASONS = [
  { value: "unkind", label: "Unkind or bullying" },
  { value: "inappropriate", label: "Inappropriate for a school community" },
  { value: "privacy", label: "Shares someone's private information" },
  { value: "spam", label: "Spam or advertising" },
  { value: "other", label: "Something else" },
] as const;

type Reason = (typeof REASONS)[number]["value"];

export function ReportDialog({
  message,
  onClose,
  onReported,
}: {
  message: MessageDTO;
  onClose: () => void;
  onReported: () => void;
}) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    if (!reason) {
      setError("Please choose a reason.");
      return;
    }
    start(async () => {
      const res = await reportMessage({ messageId: message.id, reason, details: details.trim() || undefined });
      if (res.ok) onReported();
      else setError(res.error);
    });
  };

  return (
    <Dialog
      title="Report this message"
      subtitle="School staff will review it privately. The person won't know who reported it."
      onClose={onClose}
      width="large"
      footerButtons={[
        { content: "Cancel", onClick: onClose },
        { content: "Send report", buttonType: "danger", onClick: submit, loading: pending },
      ]}
    >
      <div className={styles.reportBody}>
        <blockquote className={styles.reportQuote}>
          <strong>{message.author.name}:</strong> {message.body.length > 240 ? `${message.body.slice(0, 240)}…` : message.body}
        </blockquote>
        {error ? <Banner variant="critical" title="Report" description={error} hideTitle /> : null}
        <RadioGroup name="reason" onChange={(v) => setReason(v as Reason)} required>
          <RadioGroup.Label>What&apos;s wrong with it?</RadioGroup.Label>
          {REASONS.map((r) => (
            <FormControl key={r.value}>
              <Radio value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
              <FormControl.Label>{r.label}</FormControl.Label>
            </FormControl>
          ))}
        </RadioGroup>
        <FormControl>
          <FormControl.Label>Anything else staff should know? (optional)</FormControl.Label>
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={3} block resize="vertical" />
        </FormControl>
        <p className={styles.reportNote}>
          If someone is in danger, call 000. For worries about a child&apos;s safety, contact the school office directly.
        </p>
      </div>
    </Dialog>
  );
}
