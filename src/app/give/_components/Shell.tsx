import NextLink from "next/link";
import type { ReactNode } from "react";
import { ProductMark } from "@/components/shell/ProductMark";
import styles from "../give.module.css";

export function PublicBar({ schoolName, homeHref }: { schoolName: string; homeHref: string }) {
  return (
    <header className={styles.bar}>
      <NextLink href={homeHref} className={styles.brand}>
        <ProductMark product="fete" size={28} />
        <span>
          {schoolName} <span className={styles.brandSub}>· Fundraising</span>
        </span>
      </NextLink>
      <span className={styles.secure}>🔒 Secure</span>
    </header>
  );
}

export function Hero({ eyebrow, title, tagline, chips }: { eyebrow: string; title: string; tagline?: string | null; chips?: ReactNode[] }) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.school}>{eyebrow}</div>
        <h1 className={styles.title}>{title}</h1>
        {tagline ? <p className={styles.tagline}>{tagline}</p> : null}
        {chips?.length ? (
          <div className={styles.chips}>
            {chips.filter(Boolean).map((c, i) => (
              <span key={i} className={styles.chip}>
                {c}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PublicFooter({ schoolName, abn }: { schoolName: string; abn: string | null }) {
  return (
    <footer className={styles.footer}>
      <span>
        All donations go to {schoolName}
        {abn ? ` (ABN ${abn})` : ""}. Thank you for supporting our school community! 💛
      </span>
      <span>
        Powered by Fete, part of <strong>Open Schools</strong> — free, open-source software for Australian schools.
      </span>
    </footer>
  );
}
