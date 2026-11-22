/**
 * Layout primitives that don't need client-side JavaScript, so they can be
 * used directly in server components. Styled only with Primer tokens.
 */
import type { CSSProperties, ReactNode } from "react";
import { initials } from "@/lib/format";
import styles from "./ui.module.css";

/** A bordered box with an optional header row. */
export function Card({
  title,
  action,
  children,
  padded = true,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return (
    <section className={`${styles.card} ${className ?? ""}`}>
      {title ? (
        <header className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>{title}</h2>
          {action}
        </header>
      ) : null}
      <div className={padded ? styles.cardBody : undefined}>{children}</div>
    </section>
  );
}

/** A big number with a label, for dashboards. */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "success" | "attention" | "danger" | "accent";
}) {
  return (
    <div className={styles.stat} data-tone={tone}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {hint ? <div className={styles.statHint}>{hint}</div> : null}
    </div>
  );
}

/** Responsive grid: as many columns of at least `min` px as fit. */
export function Grid({ children, min = 220, gap = 16 }: { children: ReactNode; min?: number; gap?: number }) {
  return (
    <div className={styles.grid} style={{ "--min": `${min}px`, gap } as CSSProperties}>
      {children}
    </div>
  );
}

/** Vertical stack with consistent spacing. */
export function VStack({ children, gap = 16 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "flex", flexDirection: "column", gap }}>{children}</div>;
}

const AVATAR_TONES = ["accent", "success", "attention", "severe", "done", "sponsors"] as const;

/** Circle with a person's initials, coloured consistently from their name. */
export function InitialsAvatar({ name, size = 32 }: { name: string; size?: number }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const tone = AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
  return (
    <span
      className={styles.avatar}
      data-tone={tone}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Renders plain text with blank-line paragraphs and line breaks. Never HTML. */
export function RichText({ text }: { text: string }) {
  return (
    <div className={styles.richText}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>
          {para.split("\n").map((line, j, arr) => (
            <span key={j}>
              {line}
              {j < arr.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
