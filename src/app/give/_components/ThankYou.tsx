"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";
import { ShareActions } from "../../(suite)/fete/_components/ShareActions";
import styles from "../give.module.css";
import { Confetti } from "./Confetti";

/** Shown when a donor returns from checkout. */
export function ThankYou({
  name,
  amountCents,
  confirmed,
  recipient,
  shareUrl,
  shareMessage,
}: {
  name: string | null;
  amountCents: number;
  /** false while the payment provider is still confirming */
  confirmed: boolean;
  recipient: string;
  /** relative path; made absolute on the client */
  shareUrl: string;
  shareMessage: string;
}) {
  const [url, setUrl] = useState(shareUrl);
  useEffect(() => setUrl(new URL(shareUrl, window.location.origin).toString()), [shareUrl]);

  return (
    <section className={`${styles.panel} ${styles.thanks}`} aria-live="polite" tabIndex={-1}>
      {confirmed ? <Confetti /> : null}
      <div className={styles.thanksEmoji} aria-hidden>
        {confirmed ? "🎉" : "⏳"}
      </div>
      <h2 className={styles.thanksTitle}>{confirmed ? `Thank you${name ? `, ${name}` : ""}!` : "Almost there…"}</h2>
      <p className={styles.thanksText}>
        {confirmed
          ? `Your ${formatMoney(amountCents, { whole: true })} donation is helping ${recipient}. A receipt is on its way to your inbox.`
          : `We're confirming your ${formatMoney(amountCents, { whole: true })} payment. It'll appear here in a minute or two.`}
      </p>
      {confirmed ? (
        <div style={{ width: "100%", maxWidth: 520, textAlign: "left" }}>
          <ShareActions url={url} message={shareMessage} title="Share" showUrl={false} />
        </div>
      ) : null}
    </section>
  );
}
