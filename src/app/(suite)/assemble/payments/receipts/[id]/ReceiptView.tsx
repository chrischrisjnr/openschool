"use client";

import { CheckCircleFillIcon } from "@primer/octicons-react";
import { Button } from "@primer/react";
import NextLink from "next/link";
import type { Receipt } from "@/lib/assemble/charges";
import { formatMoney } from "@/lib/format";
import styles from "./receipt.module.css";

export function ReceiptView({
  school,
  receipt: r,
  backHref,
}: {
  school: { name: string; suburb: string | null; state: string; abn: string | null; phone: string | null; email: string | null };
  receipt: Receipt & { dateLabel: string };
  backHref: string;
}) {
  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <NextLink href={backHref} className={styles.back}>
          ← Forms & payments
        </NextLink>
        <Button onClick={() => window.print()}>Print or save as PDF</Button>
      </div>
      <article className={styles.receipt} aria-labelledby="receipt-title">
        <div className={styles.head}>
          <div>
            <div className={styles.school}>{school.name}</div>
            <div className={styles.schoolMeta}>
              {[school.suburb && `${school.suburb} ${school.state}`, school.phone, school.email].filter(Boolean).join(" · ")}
            </div>
            {school.abn ? <div className={styles.schoolMeta}>ABN {school.abn}</div> : null}
          </div>
          <div className={styles.titleBlock}>
            <h1 id="receipt-title" className={styles.title}>
              Receipt
            </h1>
            <div className={styles.number}>No. {r.number}</div>
          </div>
        </div>

        <div className={styles.paid}>
          <CheckCircleFillIcon size={20} />
          <span>
            Paid <strong>{formatMoney(r.amountCents)}</strong> — thank you
          </span>
        </div>

        <dl className={styles.facts}>
          <div>
            <dt>Date</dt>
            <dd>{r.dateLabel}</dd>
          </div>
          <div>
            <dt>Paid by</dt>
            <dd>
              {r.payerName}
              {r.payerEmail ? <span className={styles.email}>{r.payerEmail}</span> : null}
            </dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd>{r.method}</dd>
          </div>
        </dl>

        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Student</th>
              <th scope="col" className={styles.num}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {r.lines.map((l, i) => (
              <tr key={i}>
                <td>{l.title}</td>
                <td>
                  {l.student}
                  {l.className ? <span className={styles.muted}> · {l.className}</span> : null}
                </td>
                <td className={styles.num}>{formatMoney(l.amountCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>
                Total paid (AUD)
              </th>
              <td className={styles.num}>
                <strong>{formatMoney(r.amountCents)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
        <p className={styles.footnote}>
          No GST is included in this amount. Please keep this receipt for your records. Questions? Contact the school office
          {school.phone ? ` on ${school.phone}` : ""}.
        </p>
      </article>
    </div>
  );
}
