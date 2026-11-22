"use client";

import { CheckIcon, CommentIcon, CopyIcon, MailIcon, ShareAndroidIcon } from "@primer/octicons-react";
import { Button, FormControl, LinkButton, TextInput } from "@primer/react";
import { useEffect, useState } from "react";
import { shareLinks } from "@/lib/fete/share";
import styles from "./fete.module.css";

/** Copy / SMS / email / WhatsApp / native share for a sponsorship link. */
export function ShareActions({
  url,
  message,
  title,
  showUrl = true,
}: {
  url: string;
  /** Text that goes before the link, e.g. "Please sponsor Mia in the Colour Run!" */
  message: string;
  title: string;
  showUrl?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const links = shareLinks(url, message);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };
  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: message, url });
    } catch {
      /* cancelled */
    }
  };

  return (
    <div style={{ display: "grid", gap: "var(--base-size-12)" }}>
      {showUrl ? (
        <FormControl>
          <FormControl.Label>Sponsorship link</FormControl.Label>
          <div className={styles.shareUrl}>
            <TextInput value={url} readOnly block monospace onFocus={(e) => e.currentTarget.select()} />
            <Button onClick={copy} leadingVisual={copied ? CheckIcon : CopyIcon} aria-live="polite">
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </FormControl>
      ) : null}
      <div className={styles.share}>
        {canShare ? (
          <Button variant="primary" leadingVisual={ShareAndroidIcon} onClick={nativeShare}>
            Share…
          </Button>
        ) : null}
        {!showUrl ? (
          <Button onClick={copy} leadingVisual={copied ? CheckIcon : CopyIcon}>
            {copied ? "Link copied!" : "Copy link"}
          </Button>
        ) : null}
        <LinkButton href={links.whatsapp} target="_blank" rel="noopener noreferrer" leadingVisual={WhatsAppIcon}>
          WhatsApp
        </LinkButton>
        <LinkButton href={links.sms} leadingVisual={CommentIcon}>
          Text message
        </LinkButton>
        <LinkButton href={links.email} leadingVisual={MailIcon}>
          Email
        </LinkButton>
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3c.2-.4.2-.9.1-1-.1 0-.3-.1-.5-.2Z" />
    </svg>
  );
}
