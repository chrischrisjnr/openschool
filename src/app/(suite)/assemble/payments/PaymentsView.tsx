"use client";

import { CheckCircleFillIcon, ShieldCheckIcon, XCircleFillIcon } from "@primer/octicons-react";
import { Banner, Button, Checkbox, Label } from "@primer/react";
import NextLink from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ButtonLink, EmptyState, FormMessage, PageTitle } from "@/components/ui";
import { Card, InitialsAvatar } from "@/components/ui/Card";
import type { FamilyCharge, HistoryEntry, ItemSummary } from "@/lib/assemble/charges";
import { formatMoney, pluralise } from "@/lib/format";
import { FilterChips, ItemCategoryLabel, Meta, Meter, Row, RowList } from "../_components/bits";
import shared from "../_components/assemble.module.css";
import { useFormAction } from "../_components/useFormAction";
import { payCharges, setConsent } from "./actions";
import styles from "./payments.module.css";

export type ChargeView = FamilyCharge & { due: string | null; overdue: boolean; paidOn: string | null };

const STATUS_BANNERS = {
  success: { variant: "success", title: "Payment received — thank you!", description: "Your receipt is in Payment history below." },
  processing: { variant: "info", title: "Payment processing", description: "We'll update your items as soon as the payment is confirmed." },
  cancelled: { variant: "warning", title: "Payment cancelled", description: "No money was taken. You can try again whenever you're ready." },
} as const;

/* ------------------------------------------------------------------ */
/* Families                                                            */
/* ------------------------------------------------------------------ */

export function ConsentControls({ charge, canAct }: { charge: ChargeView; canAct: boolean }) {
  if (!charge.requiresConsent) return null;
  if (charge.consent === "granted") {
    return (
      <span className={styles.consent}>
        <Label variant="success">
          <CheckCircleFillIcon size={12} /> Permission given
        </Label>
        {canAct && !charge.closed && charge.status !== "paid" ? (
          <form action={setConsent}>
            <input type="hidden" name="chargeId" value={charge.id} />
            <input type="hidden" name="decision" value="declined" />
            <Button type="submit" size="small" variant="invisible">
              Change
            </Button>
          </form>
        ) : null}
      </span>
    );
  }
  if (charge.consent === "declined") {
    return (
      <span className={styles.consent}>
        <Label variant="secondary">
          <XCircleFillIcon size={12} /> Permission declined
        </Label>
        {canAct && !charge.closed ? (
          <form action={setConsent}>
            <input type="hidden" name="chargeId" value={charge.id} />
            <input type="hidden" name="decision" value="granted" />
            <Button type="submit" size="small" variant="invisible">
              Change
            </Button>
          </form>
        ) : null}
      </span>
    );
  }
  if (!canAct || charge.closed) return <Label variant="attention">Permission needed</Label>;
  return (
    <div className={styles.consentAsk}>
      <span className={styles.consentQuestion}>
        <ShieldCheckIcon /> Do you give permission?
      </span>
      <div className={styles.consentButtons}>
        <form action={setConsent}>
          <input type="hidden" name="chargeId" value={charge.id} />
          <input type="hidden" name="decision" value="granted" />
          <Button type="submit" size="small" variant="primary">
            Yes, I give permission
          </Button>
        </form>
        <form action={setConsent}>
          <input type="hidden" name="chargeId" value={charge.id} />
          <input type="hidden" name="decision" value="declined" />
          <Button type="submit" size="small">
            No
          </Button>
        </form>
      </div>
    </div>
  );
}

export function ChargeRow({
  charge: c,
  canAct,
  selected,
  onToggle,
  childName,
}: {
  charge: ChargeView;
  canAct: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  /** Shown in the meta line when rows for several children are mixed together. */
  childName?: string;
}) {
  const checkId = `pay-${c.id}`;
  const amount = c.amountCents > 0 ? formatMoney(c.amountCents) : "No cost";
  let status: ReactNode = null;
  if (c.status === "paid") status = <Label variant="success">Paid{c.paidOn ? ` ${c.paidOn}` : ""}</Label>;
  else if (c.status === "waived") status = <Label variant="secondary">No charge</Label>;
  else if (c.closed) status = <Label variant="secondary">Closed</Label>;
  else if (c.amountCents > 0 && c.requiresConsent && c.consent === "pending") status = <span className={`${shared.small} ${shared.muted}`}>Give permission to pay</span>;

  return (
    <li className={styles.charge} data-selected={selected || undefined}>
      <div className={styles.chargeSelect}>
        {canAct && c.payable ? (
          <Checkbox id={checkId} checked={selected} onChange={() => onToggle(c.id)} aria-label={`Pay ${c.title} (${amount})`} />
        ) : (
          <span className={styles.chargeSpacer} />
        )}
      </div>
      <div className={styles.chargeMain}>
        <label htmlFor={canAct && c.payable ? checkId : undefined} className={styles.chargeTitle}>
          <NextLink href={`/assemble/payments/${c.itemId}`}>{c.title}</NextLink>
        </label>
        <span className={styles.chargeMeta}>
          <ItemCategoryLabel category={c.category} />
          <Meta
            parts={[
              childName,
              c.due && c.needsAction ? (
                <span className={c.overdue ? styles.overdue : undefined}>{c.overdue ? `Overdue — was due ${c.due}` : `Due ${c.due}`}</span>
              ) : null,
            ]}
          />
        </span>
        <ConsentControls charge={c} canAct={canAct} />
      </div>
      <div className={styles.chargeEnd}>
        <span className={styles.amount}>{amount}</span>
        {status}
      </div>
    </li>
  );
}

/** Which payable charges are ticked. New payable items are ticked automatically. */
export function usePaySelection(charges: ChargeView[]) {
  const payable = useMemo(() => charges.filter((c) => c.payable), [charges]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(payable.map((c) => c.id)));
  const payKey = payable.map((c) => c.id).join(",");
  const [prevKey, setPrevKey] = useState(payKey);
  if (payKey !== prevKey) {
    const before = new Set(prevKey.split(","));
    setPrevKey(payKey);
    setSelected((prev) => new Set(payable.filter((c) => prev.has(c.id) || !before.has(c.id)).map((c) => c.id)));
  }
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const chosen = payable.filter((c) => selected.has(c.id));
  const total = chosen.reduce((sum, c) => sum + c.amountCents, 0);
  return { selected, toggle, payable, chosen, total };
}

/** Sticky "Pay $X" bar: one checkout for every ticked item. */
export function PayBar({ chosen, total }: { chosen: ChargeView[]; total: number }) {
  const { state, pending, onSubmit } = useFormAction(payCharges);
  return (
    <>
      <form onSubmit={onSubmit} className={styles.payBar}>
        {chosen.map((c) => (
          <input key={c.id} type="hidden" name="chargeId" value={c.id} />
        ))}
        <div className={styles.payBarText}>
          <strong>{formatMoney(total)}</strong>
          <span className={shared.muted}>
            {chosen.length ? `${pluralise(chosen.length, "item")} selected` : "Tick the items you'd like to pay"}
          </span>
        </div>
        <Button type="submit" variant="primary" size="large" disabled={!chosen.length} loading={pending}>
          {chosen.length ? `Pay ${formatMoney(total)}` : "Pay"}
        </Button>
      </form>
      <FormMessage state={state} />
    </>
  );
}

export function FamilyPayments({
  status,
  canAct,
  kids,
  charges,
  history,
}: {
  status: keyof typeof STATUS_BANNERS | null;
  canAct: boolean;
  kids: { id: string; name: string; fullName: string; className: string | null }[];
  charges: ChargeView[];
  history: (HistoryEntry & { dateLabel: string })[];
}) {
  const { selected, toggle, payable, chosen, total } = usePaySelection(charges);
  const todo = charges.filter((c) => c.needsAction);
  const done = charges.filter((c) => !c.needsAction);
  const banner = status ? STATUS_BANNERS[status] : null;
  const names = kids.map((k) => k.name);
  const kidName = new Map(kids.map((k) => [k.id, k.name]));

  return (
    <div className={shared.stack}>
      <PageTitle
        title="Forms & payments"
        description={`Permission forms, excursions and school payments${names.length ? ` for ${names.join(" and ")}` : ""}.`}
      />
      {banner ? <Banner variant={banner.variant} title={banner.title} description={banner.description} /> : null}

      <section aria-labelledby="todo-heading" className={shared.stackTight}>
        <h2 id="todo-heading" className={shared.sectionTitle}>
          To do {todo.length ? <Label variant="attention">{todo.length}</Label> : null}
        </h2>
        {todo.length ? (
          kids
            .filter((k) => todo.some((c) => c.studentId === k.id))
            .map((k) => (
              <Card
                key={k.id}
                title={
                  <span className={styles.kidTitle}>
                    <InitialsAvatar name={k.fullName} size={24} /> {k.name}
                    {k.className ? <span className={shared.muted}> · {k.className}</span> : null}
                  </span>
                }
                padded={false}
              >
                <ul className={styles.charges}>
                  {todo
                    .filter((c) => c.studentId === k.id)
                    .map((c) => (
                      <ChargeRow key={c.id} charge={c} canAct={canAct} selected={selected.has(c.id)} onToggle={toggle} />
                    ))}
                </ul>
              </Card>
            ))
        ) : (
          <Card>
            <div className={styles.allDone}>
              <CheckCircleFillIcon size={20} /> Nothing to do — every form is signed and everything is paid.
            </div>
          </Card>
        )}

        {canAct && payable.length ? <PayBar chosen={chosen} total={total} /> : null}
      </section>

      {done.length ? (
        <Card title="Done & up to date" padded={false}>
          <ul className={styles.charges}>
            {done.map((c) => (
              <ChargeRow key={c.id} charge={c} canAct={canAct} selected={false} onToggle={toggle} childName={kidName.get(c.studentId)} />
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="Payment history" padded={false}>
        {history.length ? (
          <RowList label="Payment history">
            {history.map((h) => (
              <Row
                key={h.id}
                href={h.paymentId ? `/assemble/payments/receipts/${h.paymentId}` : undefined}
                title={[...new Set(h.lines.map((l) => l.title))].join(", ")}
                meta={
                  <Meta
                    parts={[
                      h.dateLabel,
                      h.method,
                      [...new Set(h.lines.map((l) => l.student))].join(" & "),
                    ]}
                  />
                }
                trailing={
                  <>
                    <span className={styles.amount}>{formatMoney(h.amountCents)}</span>
                    <span className={shared.cardLink}>Receipt</span>
                  </>
                }
              />
            ))}
          </RowList>
        ) : (
          <p className={shared.emptyLine}>No payments yet.</p>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Staff                                                               */
/* ------------------------------------------------------------------ */

type StaffItem = ItemSummary & { due: string | null; overdue: boolean };

export function StaffPayments({
  show,
  openCount,
  closedCount,
  items,
  showMoney,
}: {
  show: "open" | "closed";
  openCount: number;
  closedCount: number;
  items: StaffItem[];
  showMoney: boolean;
}) {
  return (
    <div className={shared.stack}>
      <PageTitle
        title="Forms & payments"
        description="Permission forms, excursions, camps and levies. Families respond and pay in Assemble."
        actions={
          <ButtonLink href="/assemble/payments/new" variant="primary" leadingIcon="plus">
            New form or payment
          </ButtonLink>
        }
      />
      <FilterChips
        label="Show"
        items={[
          { href: "/assemble/payments", label: "Open", current: show === "open", count: openCount },
          { href: "/assemble/payments?show=closed", label: "Closed", current: show === "closed", count: closedCount },
        ]}
      />
      {items.length ? (
        <ul className={styles.itemGrid} aria-label="Forms and payments">
          {items.map((i) => {
            const payers = i.amountCents > 0 ? i.paid + i.unpaid : 0;
            return (
              <li key={i.id}>
                <NextLink href={`/assemble/payments/${i.id}`} className={styles.itemCard}>
                  <span className={styles.itemTop}>
                    <ItemCategoryLabel category={i.category} />
                    {i.closed ? <Label variant="secondary">Closed</Label> : i.due ? (
                      <span className={i.overdue ? styles.overdue : shared.muted}>{i.overdue ? `Was due ${i.due}` : `Due ${i.due}`}</span>
                    ) : null}
                  </span>
                  <span className={styles.itemTitle}>{i.title}</span>
                  <span className={`${shared.muted} ${shared.small}`}>
                    <Meta parts={[i.audience, i.amountCents ? `${formatMoney(i.amountCents)} each` : "Consent only", pluralise(i.students, "student")]} />
                  </span>
                  {i.amountCents > 0 ? (
                    <span className={styles.itemStat}>
                      <span>
                        Paid <strong>{i.paid}</strong> of {payers}
                        {showMoney ? <span className={shared.muted}> · {formatMoney(i.collectedCents)} collected</span> : null}
                      </span>
                      <Meter value={i.paid} max={payers} label="Paid" tone="success" />
                    </span>
                  ) : null}
                  {i.requiresConsent ? (
                    <span className={styles.itemStat}>
                      <span>
                        Permission <strong>{i.consentGranted}</strong> of {i.students}
                        {i.consentDeclined ? <span className={shared.muted}> · {i.consentDeclined} declined</span> : null}
                      </span>
                      <Meter value={i.consentGranted} max={i.students} label="Permission given" />
                    </span>
                  ) : null}
                </NextLink>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon="card"
          title={show === "closed" ? "Nothing closed yet" : "No open forms or payments"}
          description="Create a permission form, excursion payment or levy and every family in the group will see it."
          action={{ href: "/assemble/payments/new", label: "New form or payment" }}
        />
      )}
    </div>
  );
}
