"use client";

import { PaperAirplaneIcon } from "@primer/octicons-react";
import { IconButton, Textarea } from "@primer/react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";
import { MAX_MESSAGE_LENGTH } from "@/lib/quad/types";
import styles from "./chat.module.css";

export type ComposerHandle = { focus: () => void };

function readDraft(key: string): string {
  try {
    return window.sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function writeDraft(key: string, value: string) {
  try {
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    /* private mode etc. */
  }
}

/**
 * Message box: Enter sends, Shift+Enter adds a new line, grows with the text
 * and keeps an unsent draft per conversation for this browser tab.
 */
export const Composer = forwardRef<
  ComposerHandle,
  {
    placeholder: string;
    label: string;
    draftKey: string;
    onSend: (body: string) => void;
    /** Up-arrow in an empty box edits your last message. */
    onEditLast?: () => void;
    autoFocus?: boolean;
  }
>(function Composer({ placeholder, label, draftKey, onSend, onEditLast, autoFocus }, ref) {
  const [value, setValue] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => textarea.current?.focus() }), []);

  // Restore the draft after hydration (sessionStorage isn't available on the server).
  useEffect(() => {
    const draft = readDraft(draftKey);
    if (draft) setValue(draft);
    if (autoFocus && window.matchMedia("(hover: hover)").matches) textarea.current?.focus();
  }, [draftKey, autoFocus]);

  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const remaining = MAX_MESSAGE_LENGTH - value.length;
  const trimmed = value.trim();

  const send = () => {
    if (!trimmed || remaining < 0) return;
    onSend(trimmed);
    setValue("");
    writeDraft(draftKey, "");
    textarea.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't send while an input method (e.g. Chinese or Vietnamese typing) is composing.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    } else if (e.key === "ArrowUp" && !value && onEditLast) {
      e.preventDefault();
      onEditLast();
    }
  };

  return (
    <form
      className={styles.composer}
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <div className={styles.composerBox}>
        <Textarea
          ref={textarea}
          aria-label={label}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            writeDraft(draftKey, e.target.value);
          }}
          onKeyDown={onKeyDown}
          rows={1}
          resize="none"
          block
          maxLength={MAX_MESSAGE_LENGTH + 200}
          className={styles.composerInput}
          enterKeyHint="send"
        />
        <IconButton
          type="submit"
          icon={PaperAirplaneIcon}
          aria-label="Send message"
          variant="primary"
          disabled={!trimmed || remaining < 0}
          className={styles.sendButton}
        />
      </div>
      <div className={styles.composerHint} aria-live="polite">
        {remaining < 200 ? (
          <span data-over={remaining < 0 || undefined}>
            {remaining < 0 ? `${-remaining} characters too long` : `${remaining} characters left`}
          </span>
        ) : (
          <span className={styles.keyHint}>
            <kbd>Enter</kbd> to send · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line
          </span>
        )}
      </div>
    </form>
  );
});
