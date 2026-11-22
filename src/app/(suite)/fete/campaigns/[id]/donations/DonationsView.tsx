"use client";

import { DownloadIcon } from "@primer/octicons-react";
import { FormControl, Label, LinkButton, Select, TextInput } from "@primer/react";
import { useActionState, useMemo, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { CampaignTotals } from "@/lib/fete/scoring";
import { recordCashDonation } from "../../../actions";
import type { ParticipantOption } from "../options";
import styles from "../campaign.module.css";

type Row = {
  id: string;
  createdAt: string;
  donorName: string;
  donorEmail: string | null;
  anonymous: boolean;
  message: string | null;
  amountCents: number;
  method: "online" | "cash";
  status: "pending" | "succeeded" | "failed";
  student: string | null;
  className: string | null;
};

export function ParticipantSelect({ options, name, label, includeGeneral }: { options: ParticipantOption[]; name: string; label: string; includeGeneral?: boolean }) {
  const groups = [...new Set(options.map((o) => o.group))];
  return (
    <FormControl>
      <FormControl.Label>{label}</FormControl.Label>
      <Select name={name} block defaultValue="">
        {includeGeneral ? <Select.Option value="">The school (general donation)</Select.Option> : <Select.Option value="">Choose a student…</Select.Option>}
        {groups.map((g) => (
          <Select.OptGroup key={g} label={g}>
            {options
              .filter((o) => o.group === g)
              .map((o) => (
                <Select.Option key={o.id} value={o.id}>
                  {o.label}
                </Select.Option>
              ))}
          </Select.OptGroup>
        ))}
      </Select>
    </FormControl>
  );
}

export function DonationsView({
  campaignId,
  closed,
  participants,
  donations,
  totals,
}: {
  campaignId: string;
  closed: boolean;
  participants: ParticipantOption[];
  donations: Row[];
  totals: CampaignTotals;
}) {
  const [state, action] = useActionState(recordCashDonation, undefined);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return donations.filter(
      (d) =>
        (showAll || d.status === "succeeded") &&
        (!q || [d.donorName, d.donorEmail, d.student, d.className, d.message].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [donations, query, showAll]);
  const hiddenCount = donations.filter((d) => d.status !== "succeeded").length;

  return (
    <div className={styles.stack}>
      <Card title="Record a cash or offline donation">
        <form action={action} id="record" className={styles.stackSmall} key={state?.ok ? state.message : "form"}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <div className={styles.formGrid}>
            <ParticipantSelect options={participants} name="participantId" label="For" includeGeneral />
            <FormControl required>
              <FormControl.Label>Amount</FormControl.Label>
              <TextInput name="amount" leadingVisual="$" inputMode="decimal" placeholder="20" block />
              {state?.fieldErrors?.amount ? <FormControl.Validation variant="error">{state.fieldErrors.amount}</FormControl.Validation> : null}
            </FormControl>
            <FormControl>
              <FormControl.Label>From</FormControl.Label>
              <TextInput name="donorName" placeholder="e.g. Grandpa Bill (cash in envelope)" block maxLength={80} />
            </FormControl>
            <FormControl>
              <FormControl.Label>Note</FormControl.Label>
              <TextInput name="message" placeholder="Optional" block maxLength={280} />
            </FormControl>
          </div>
          <FormMessage state={state} />
          <div>
            <SubmitButton disabled={closed} pendingLabel="Recording…">
              Record donation
            </SubmitButton>
            {closed ? <span className={styles.muted}> This campaign is closed.</span> : null}
          </div>
        </form>
      </Card>

      <Card
        title={`All donations · ${formatMoney(totals.raisedCents, { whole: true })} from ${totals.donationCount}`}
        action={
          <LinkButton href={`/api/fete/campaigns/${campaignId}/donations`} size="small" leadingVisual={DownloadIcon}>
            Download CSV
          </LinkButton>
        }
      >
        <div className={styles.stackSmall}>
          <div className={styles.between}>
            <FormControl>
              <FormControl.Label visuallyHidden>Search donations</FormControl.Label>
              <TextInput placeholder="Search donor, student or class…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </FormControl>
            {hiddenCount ? (
              <label className={styles.muted}>
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show {hiddenCount} pending / failed
              </label>
            ) : null}
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>From</th>
                  <th>For</th>
                  <th>Message</th>
                  <th className={styles.num}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 500).map((d) => (
                  <tr key={d.id} className={d.status !== "succeeded" ? styles.faded : undefined}>
                    <td className={styles.nowrap}>{formatDateTime(d.createdAt)}</td>
                    <td>
                      {d.donorName}
                      {d.anonymous ? <span className={styles.muted}> (hidden publicly)</span> : null}
                      {d.donorEmail ? <div className={styles.muted}>{d.donorEmail}</div> : null}
                    </td>
                    <td>
                      {d.student ? (
                        <>
                          {d.student}
                          {d.className ? <span className={styles.muted}> · {d.className}</span> : null}
                        </>
                      ) : (
                        <span className={styles.muted}>The school</span>
                      )}
                    </td>
                    <td>{d.message}</td>
                    <td className={styles.num}>
                      {formatMoney(d.amountCents)}
                      <div>
                        {d.method === "cash" ? <Label size="small">Cash</Label> : null}{" "}
                        {d.status !== "succeeded" ? <Label size="small" variant={d.status === "failed" ? "danger" : "attention"}>{d.status}</Label> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 500 ? <p className={styles.muted}>Showing the latest 500 — download the CSV for everything.</p> : null}
          {!rows.length ? <p className={styles.muted}>No donations match.</p> : null}
        </div>
      </Card>
    </div>
  );
}
