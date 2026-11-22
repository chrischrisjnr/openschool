"use client";

import { LockIcon } from "@primer/octicons-react";
import { Banner, Button, FormControl, TextInput } from "@primer/react";
import { SubmitButton } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { cancelDemoPayment, confirmDemoPayment } from "./actions";
import styles from "./checkout.module.css";

export function DemoCheckout({
  paymentId,
  description,
  amountCents,
  schoolName,
  payerEmail,
}: {
  paymentId: string;
  description: string;
  amountCents: number;
  schoolName: string;
  payerEmail: string;
}) {
  return (
    <main id="main" className={styles.page}>
      <div className={styles.card}>
        <div className={styles.summary}>
          <div className={styles.school}>{schoolName}</div>
          <div className={styles.amount}>{formatMoney(amountCents)}</div>
          <div className={styles.description}>{description}</div>
        </div>

        <form action={confirmDemoPayment} className={styles.form}>
          <input type="hidden" name="paymentId" value={paymentId} />
          <Banner
            variant="info"
            title="Demo mode"
            description="This is a practice checkout — no card is charged. Your school can switch on real payments with Stripe."
          />
          <FormControl disabled>
            <FormControl.Label>Email</FormControl.Label>
            <TextInput block defaultValue={payerEmail || "you@example.com"} />
          </FormControl>
          <FormControl disabled>
            <FormControl.Label>Card number</FormControl.Label>
            <TextInput block defaultValue="4242 4242 4242 4242" />
          </FormControl>
          <div className={styles.row}>
            <FormControl disabled>
              <FormControl.Label>Expiry</FormControl.Label>
              <TextInput block defaultValue="12 / 30" />
            </FormControl>
            <FormControl disabled>
              <FormControl.Label>CVC</FormControl.Label>
              <TextInput block defaultValue="123" />
            </FormControl>
          </div>
          <SubmitButton block size="large" leadingVisual={LockIcon} pendingLabel="Processing…">
            Pay {formatMoney(amountCents)}
          </SubmitButton>
        </form>
        <form action={cancelDemoPayment} className={styles.cancel}>
          <input type="hidden" name="paymentId" value={paymentId} />
          <Button type="submit" variant="invisible" block>
            Cancel and go back
          </Button>
        </form>
      </div>
    </main>
  );
}
