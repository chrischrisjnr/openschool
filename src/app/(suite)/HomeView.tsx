"use client";

import { ArrowRightIcon } from "@primer/octicons-react";
import { CounterLabel, Label } from "@primer/react";
import NextLink from "next/link";
import { InitialsAvatar } from "@/components/ui/Card";
import { ProductMark } from "@/components/shell/ProductMark";
import { PRODUCTS, type ProductKey } from "@/components/shell/products";
import type { HomeSummary } from "@/lib/summary";
import styles from "./home.module.css";

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeView({
  firstName,
  schoolName,
  role,
  students,
  summaries,
}: {
  firstName: string;
  schoolName: string;
  role: string;
  students: { id: string; name: string; detail: string }[];
  summaries: Record<ProductKey, HomeSummary>;
}) {
  return (
    <main id="main" className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title} suppressHydrationWarning>
          {greeting()}, {firstName}
        </h1>
        <p className={styles.subtitle}>
          Welcome to {schoolName} on Open Schools.
          {role === "parent" ? " Here's what's happening for your family." : null}
        </p>
      </section>

      {students.length > 0 ? (
        <section aria-label="Your children" className={styles.students}>
          {students.map((s) => (
            <div key={s.id} className={styles.student}>
              <InitialsAvatar name={s.name} size={40} />
              <div>
                <div className={styles.studentName}>{s.name}</div>
                <div className={styles.studentDetail}>{s.detail}</div>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className={styles.products} aria-label="Apps">
        {(Object.keys(PRODUCTS) as ProductKey[]).map((key) => {
          const p = PRODUCTS[key];
          const summary = summaries[key];
          return (
            <NextLink key={key} href={p.href} className={styles.product} data-product={key}>
              <div className={styles.productHead}>
                <ProductMark product={key} size={44} />
                <div>
                  <div className={styles.productName}>{p.name}</div>
                  <Label variant="secondary">{p.tagline}</Label>
                </div>
              </div>
              <p className={styles.productDescription}>{p.description}</p>
              {summary.highlights.length > 0 ? (
                <ul className={styles.highlights}>
                  {summary.highlights.map((h) => (
                    <li key={h.label} data-tone={h.tone}>
                      <CounterLabel>{h.count}</CounterLabel> {h.label}
                    </li>
                  ))}
                </ul>
              ) : null}
              {summary.text ? <p className={styles.summaryText}>{summary.text}</p> : null}
              <span className={styles.open}>
                Open {p.name} <ArrowRightIcon />
              </span>
            </NextLink>
          );
        })}
      </section>

      <footer className={styles.footer}>
        Open Schools is free, open-source software made for Australian school communities.
      </footer>
    </main>
  );
}
