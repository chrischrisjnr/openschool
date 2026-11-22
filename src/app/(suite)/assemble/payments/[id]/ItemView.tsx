"use client";

import { CalendarIcon, DownloadIcon, SearchIcon } from "@primer/octicons-react";
import { ActionList, ActionMenu, Banner, Button, FormControl, Label, LinkButton, Select, TextInput } from "@primer/react";
import NextLink from "next/link";
import { startTransition, useMemo, useState } from "react";
import { PageTitle } from "@/components/ui";
import { Card, Grid, InitialsAvatar, RichText, Stat } from "@/components/ui/Card";
import type { ItemRow, ItemSummary } from "@/lib/assemble/charges";
import { formatMoney, pluralise } from "@/lib/format";
import { ConfirmButton } from "../../_components/ConfirmButton";
import { ItemCategoryLabel, Meta, Row, RowList } from "../../_components/bits";
import shared from "../../_components/assemble.module.css";
import { markPaid, setItemClosed, setWaived } from "../actions";
import { ChargeRow, PayBar, usePaySelection, type ChargeView } from "../PaymentsView";
import styles from "../payments.module.css";

type EventLink = { id: string; title: string; when: string } | null;

function EventCallout({ event }: { event: EventLink }) {
  if (!event) return null;
  return (
    <NextLink href={`/assemble/calendar/${event.id}`} className={shared.cardLink}>
      <CalendarIcon /> {event.title} · {event.when}
    </NextLink>
  );
}

/* ------------------------------------------------------------------ */
/* Families                                                            */
/* ------------------------------------------------------------------ */

export function ItemFamilyView({
  info,
  event,
  canAct,
  kids,
  charges,
}: {
  info: { title: string; description: string | null; category: string; due: string | null; closed: boolean };
  event: EventLink;
  canAct: boolean;
  kids: { id: string; name: string; fullName: string; className: string | null }[];
  charges: ChargeView[];
}) {
  const { selected, toggle, payable, chosen, total } = usePaySelection(charges);
  return (
    <div className={`${shared.stack} ${shared.narrow}`}>
      <PageTitle back={{ href: "/assemble/payments", label: "Forms & payments" }} title={info.title} />
      <Card>
        <div className={styles.itemInfo}>
          <div className={shared.inlineActions}>
            <ItemCategoryLabel category={info.category} />
            {info.closed ? <Label variant="secondary">Closed</Label> : info.due ? <span className={shared.muted}>Due {info.due}</span> : null}
          </div>
          {info.description ? <RichText text={info.description} /> : null}
          <EventCallout event={event} />
        </div>
      </Card>
      {kids
        .filter((k) => charges.some((c) => c.studentId === k.id))
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
              {charges
                .filter((c) => c.studentId === k.id)
                .map((c) => (
                  <ChargeRow key={c.id} charge={c} canAct={canAct} selected={selected.has(c.id)} onToggle={toggle} />
                ))}
            </ul>
          </Card>
        ))}
      {canAct && payable.length ? <PayBar chosen={chosen} total={total} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Staff                                                               */
/* ------------------------------------------------------------------ */

type StudentRow = ItemRow & { paidOn: string | null; consentOn: string | null };
type Filter = "all" | "unpaid" | "paid" | "pending" | "declined" | "waived";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "unpaid", label: "Not paid" },
  { key: "paid", label: "Paid" },
  { key: "pending", label: "Awaiting permission" },
  { key: "declined", label: "Declined" },
  { key: "waived", label: "No charge" },
];

function matches(r: StudentRow, f: Filter) {
  switch (f) {
    case "all":
      return true;
    case "unpaid":
      return r.status === "unpaid" && r.amountCents > 0 && r.consent !== "declined";
    case "paid":
      return r.status === "paid";
    case "pending":
      return r.consent === "pending";
    case "declined":
      return r.consent === "declined";
    case "waived":
      return r.status === "waived";
  }
}

function ConsentCell({ r }: { r: StudentRow }) {
  if (!r.consent) return <span className={shared.muted}>—</span>;
  if (r.consent === "granted") return <Label variant="success">Given{r.consentOn ? ` ${r.consentOn}` : ""}</Label>;
  if (r.consent === "declined") return <Label variant="danger">Declined</Label>;
  return <Label variant="attention">Waiting</Label>;
}

function PaymentCell({ r, amountCents }: { r: StudentRow; amountCents: number }) {
  if (amountCents === 0) return <span className={shared.muted}>—</span>;
  if (r.status === "paid") {
    return (
      <span className={styles.studentCell}>
        <Label variant="success">Paid{r.paidOn ? ` ${r.paidOn}` : ""}</Label>
        {r.method ? (
          <span className={`${shared.small} ${shared.muted}`}>
            {r.paymentId ? <NextLink href={`/assemble/payments/receipts/${r.paymentId}`}>{r.method}</NextLink> : r.method}
          </span>
        ) : null}
      </span>
    );
  }
  if (r.status === "waived") return <Label variant="secondary">No charge</Label>;
  if (r.consent === "declined") return <span className={shared.muted}>Not attending</span>;
  return <Label variant="danger">Not paid</Label>;
}

function RowActions({ r, canManage, closed, amountCents }: { r: StudentRow; canManage: boolean; closed: boolean; amountCents: number }) {
  if (!canManage || closed || amountCents === 0 || r.status === "paid") return null;
  if (r.status === "waived") {
    return (
      <form action={setWaived}>
        <input type="hidden" name="chargeId" value={r.chargeId} />
        <input type="hidden" name="waive" value="0" />
        <Button type="submit" size="small" variant="invisible">
          Undo no charge
        </Button>
      </form>
    );
  }
  if (r.consent === "declined") return null;
  return (
    <ActionMenu>
      <ActionMenu.Button size="small">Record…</ActionMenu.Button>
      <ActionMenu.Overlay width="medium">
        <ActionList>
          {(["cash", "other"] as const).map((method) => (
            <ActionList.Item
              key={method}
              onSelect={() => {
                const fd = new FormData();
                fd.set("chargeId", r.chargeId);
                fd.set("method", method);
                startTransition(() => markPaid(fd));
              }}
            >
              {method === "cash" ? "Paid in cash at the office" : "Paid another way (EFT, CSEF…)"}
            </ActionList.Item>
          ))}
          <ActionList.Divider />
          <ActionList.Item
            onSelect={() => {
              const fd = new FormData();
              fd.set("chargeId", r.chargeId);
              fd.set("waive", "1");
              startTransition(() => setWaived(fd));
            }}
          >
            No charge for this student
            <ActionList.Description variant="block">Waive the cost, e.g. for hardship or a sibling discount.</ActionList.Description>
          </ActionList.Item>
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
}

export function ItemStaffView({
  item,
  summary,
  rows,
  event,
  classes,
  created,
  canManage,
  showMoney,
}: {
  item: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    amountCents: number;
    requiresConsent: boolean;
    due: string | null;
    closed: boolean;
    audience: string;
  };
  summary: ItemSummary;
  rows: StudentRow[];
  event: EventLink;
  classes: string[];
  created: boolean;
  canManage: boolean;
  showMoney: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [cls, setCls] = useState("");
  const [query, setQuery] = useState("");
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          matches(r, filter) &&
          (!cls || r.className === cls) &&
          (!query || r.studentName.toLowerCase().includes(query.trim().toLowerCase())),
      ),
    [rows, filter, cls, query],
  );
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((r) => matches(r, f.key)).length])), [rows]);
  const filters = FILTERS.filter(
    (f) =>
      f.key === "all" ||
      ((f.key === "unpaid" || f.key === "paid" || f.key === "waived") && item.amountCents > 0) ||
      ((f.key === "pending" || f.key === "declined") && item.requiresConsent),
  );
  const payers = summary.paid + summary.unpaid;

  return (
    <div className={shared.stack}>
      <PageTitle
        back={{ href: "/assemble/payments", label: "Forms & payments" }}
        title={item.title}
        description={
          <Meta
            parts={[
              item.audience,
              item.amountCents ? `${formatMoney(item.amountCents)} per student` : "Consent only",
              item.due ? `Due ${item.due}` : null,
            ]}
          />
        }
        actions={
          <>
            <LinkButton href={`/api/assemble/payments/${item.id}/csv`} leadingVisual={DownloadIcon} download="">
              Export CSV
            </LinkButton>
            {canManage ? (
              <ConfirmButton
                action={setItemClosed}
                fields={{ itemId: item.id, closed: item.closed ? "0" : "1" }}
                danger={!item.closed}
                title={item.closed ? "Reopen this item?" : "Close this item?"}
                body={
                  item.closed
                    ? "Families will be able to respond and pay again."
                    : "Families won't be able to give permission or pay any more. You can reopen it later."
                }
                confirmLabel={item.closed ? "Reopen" : "Close item"}
              >
                {item.closed ? "Reopen" : "Close"}
              </ConfirmButton>
            ) : null}
          </>
        }
      />
      {created ? (
        <Banner
          variant="success"
          title="Created"
          description={`Families of ${pluralise(summary.students, "student")} can now see “${item.title}” in Assemble.`}
        />
      ) : null}
      {item.closed ? <Banner variant="info" title="Closed" description="This item is closed. Families can no longer respond or pay online." /> : null}

      <Grid min={180}>
        {item.amountCents > 0 ? (
          <Stat label="Paid" value={`${summary.paid} of ${payers}`} hint={showMoney ? `${formatMoney(summary.collectedCents)} collected` : undefined} tone="success" />
        ) : null}
        {item.amountCents > 0 ? (
          <Stat
            label="Still to pay"
            value={summary.unpaid}
            hint={showMoney ? `${formatMoney(summary.outstandingCents)} outstanding` : undefined}
            tone={summary.unpaid ? "attention" : undefined}
          />
        ) : null}
        {item.requiresConsent ? (
          <Stat label="Permission given" value={`${summary.consentGranted} of ${summary.students}`} hint={`${summary.consentPending} waiting · ${summary.consentDeclined} declined`} tone="accent" />
        ) : null}
        {summary.waived ? <Stat label="No charge" value={summary.waived} /> : null}
      </Grid>

      {item.description || event ? (
        <Card>
          <div className={styles.itemInfo}>
            <ItemCategoryLabel category={item.category} />
            {item.description ? <RichText text={item.description} /> : null}
            <EventCallout event={event} />
          </div>
        </Card>
      ) : null}

      <div className={styles.filters}>
        <nav aria-label="Filter students" className={shared.chips}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              className={shared.chip}
              aria-current={filter === f.key ? "true" : undefined}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className={shared.chipCount}>{counts[f.key]}</span>
            </button>
          ))}
        </nav>
        <div className={shared.inlineActions}>
          {classes.length > 1 ? (
            <FormControl>
              <FormControl.Label visuallyHidden>Class</FormControl.Label>
              <Select value={cls} onChange={(e) => setCls(e.target.value)}>
                <Select.Option value="">All classes</Select.Option>
                {classes.map((c) => (
                  <Select.Option key={c} value={c}>
                    Class {c}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
          ) : null}
          <FormControl>
            <FormControl.Label visuallyHidden>Search students</FormControl.Label>
            <TextInput leadingVisual={SearchIcon} placeholder="Search students" value={query} onChange={(e) => setQuery(e.target.value)} />
          </FormControl>
        </div>
      </div>

      <Card padded={false}>
        {shown.length ? (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">Class</th>
                    {item.requiresConsent ? <th scope="col">Permission</th> : null}
                    {item.amountCents > 0 ? <th scope="col">Payment</th> : null}
                    {canManage && !item.closed && item.amountCents > 0 ? (
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.chargeId}>
                      <td>
                        <NextLink href={`/assemble/students/${r.studentId}`}>{r.studentName}</NextLink>
                        {r.consentByName && r.consent !== "pending" ? (
                          <span className={`${shared.small} ${shared.muted}`}> · {r.consentByName}</span>
                        ) : null}
                      </td>
                      <td>{r.className ?? "—"}</td>
                      {item.requiresConsent ? (
                        <td>
                          <ConsentCell r={r} />
                        </td>
                      ) : null}
                      {item.amountCents > 0 ? (
                        <td>
                          <PaymentCell r={r} amountCents={item.amountCents} />
                        </td>
                      ) : null}
                      {canManage && !item.closed && item.amountCents > 0 ? (
                        <td>
                          <div className={styles.rowActions}>
                            <RowActions r={r} canManage={canManage} closed={item.closed} amountCents={item.amountCents} />
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.mobileRows}>
              <RowList label="Students">
                {shown.map((r) => (
                  <Row
                    key={r.chargeId}
                    title={r.studentName}
                    meta={r.className ? `Class ${r.className}` : undefined}
                    trailing={
                      <>
                        {item.requiresConsent ? <ConsentCell r={r} /> : null}
                        {item.amountCents > 0 ? <PaymentCell r={r} amountCents={item.amountCents} /> : null}
                        <RowActions r={r} canManage={canManage} closed={item.closed} amountCents={item.amountCents} />
                      </>
                    }
                  />
                ))}
              </RowList>
            </div>
          </>
        ) : (
          <p className={shared.emptyLine}>No students match.</p>
        )}
      </Card>
    </div>
  );
}
