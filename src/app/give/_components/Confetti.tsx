import type { CSSProperties } from "react";
import styles from "../give.module.css";

const COLOURS = ["pink", "orange", "yellow", "green", "teal", "blue", "purple", "coral"];

/** A short burst of CSS confetti. Hidden for people who prefer reduced motion. */
export function Confetti({ pieces = 42 }: { pieces?: number }) {
  return (
    <div className={styles.confetti} aria-hidden>
      {Array.from({ length: pieces }, (_, i) => {
        // Deterministic "randomness" so server and client render the same.
        const a = (i * 37) % 100;
        const b = (i * 53) % 100;
        const style = {
          left: `${a}%`,
          background: `var(--display-${COLOURS[i % COLOURS.length]}-bgColor-emphasis)`,
          "--d": `${(b / 100) * 0.9}s`,
          "--x": `${((i * 29) % 120) - 60}px`,
          "--r": `${((i * 71) % 720) - 360}deg`,
          width: i % 3 === 0 ? 6 : 9,
          height: i % 2 === 0 ? 14 : 9,
          borderRadius: i % 4 === 0 ? 999 : 2,
        } as CSSProperties;
        return <i key={i} style={style} />;
      })}
    </div>
  );
}
