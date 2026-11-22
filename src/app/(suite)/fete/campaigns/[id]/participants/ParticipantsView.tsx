"use client";

import { Banner, Checkbox, FormControl, ProgressBar, Radio, RadioGroup, TextInput } from "@primer/react";
import NextLink from "next/link";
import { useActionState, useMemo, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format";
import { percentOf } from "@/lib/fete/tiers";
import { enrolParticipants } from "../../../actions";
import { Swatch } from "../../../_components/Visuals";
import styles from "../campaign.module.css";

type Year = { yearLevel: number; label: string; total: number; enrolled: number };
type Participant = {
  id: string;
  name: string;
  className: string | null;
  yearLevel: number;
  houseName: string | null;
  houseColor: string | null;
  raisedCents: number;
  goalCents: number;
  points: number;
  donationCount: number;
  code: string;
  publicPath: string;
};

export function ParticipantsView({
  campaignId,
  justCreated,
  closed,
  years,
  participants,
}: {
  campaignId: string;
  justCreated: boolean;
  closed: boolean;
  years: Year[];
  participants: Participant[];
}) {
  const [state, action] = useActionState(enrolParticipants, undefined);
  const [scope, setScope] = useState<"all" | "years">("all");
  const [query, setQuery] = useState("");
  const total = years.reduce((s, y) => s + y.total, 0);
  const enrolled = participants.length;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? participants.filter((p) => [p.name, p.className, p.houseName, p.code].some((v) => v?.toLowerCase().includes(q))) : participants;
  }, [participants, query]);

  return (
    <div className={styles.stack}>
      {justCreated ? (
        <Banner variant="success" title="Campaign created 🎉" description="Next, enrol students so each one gets a personal page and QR code." />
      ) : null}

      <Card title={`Enrol students · ${enrolled} of ${total} enrolled`}>
        {enrolled >= total && total > 0 ? (
          <p className={styles.muted}>Every student is enrolled. New students can be added here any time.</p>
        ) : (
          <form action={action} className={styles.stackSmall}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <RadioGroup name="scope" onChange={(v) => setScope((v as "all" | "years") ?? "all")}>
              <RadioGroup.Label>Who’s taking part?</RadioGroup.Label>
              <FormControl>
                <Radio value="all" checked={scope === "all"} onChange={() => setScope("all")} />
                <FormControl.Label>The whole school</FormControl.Label>
              </FormControl>
              <FormControl>
                <Radio value="years" checked={scope === "years"} onChange={() => setScope("years")} />
                <FormControl.Label>Chosen year levels</FormControl.Label>
              </FormControl>
            </RadioGroup>
            {scope === "years" ? (
              <fieldset className={styles.yearChecks} style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="sr-only">Year levels</legend>
                {years.map((y) => (
                  <FormControl key={y.yearLevel} disabled={y.enrolled >= y.total}>
                    <Checkbox name="years" value={String(y.yearLevel)} />
                    <FormControl.Label>
                      {y.label} <span className={styles.muted}>({y.enrolled}/{y.total})</span>
                    </FormControl.Label>
                  </FormControl>
                ))}
              </fieldset>
            ) : null}
            <p className={styles.muted}>Each student gets a private, unguessable link and QR code. Already-enrolled students are skipped.</p>
            <FormMessage state={state} />
            <div>
              <SubmitButton disabled={closed} pendingLabel="Enrolling…">
                Enrol students
              </SubmitButton>
            </div>
          </form>
        )}
        {enrolled >= total && total > 0 ? <FormMessage state={state} /> : null}
      </Card>

      <Card title="Students">
        {participants.length ? (
          <div className={styles.stackSmall}>
            <FormControl>
              <FormControl.Label visuallyHidden>Search students</FormControl.Label>
              <TextInput placeholder="Search by name, class or house…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </FormControl>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>House</th>
                    <th style={{ minWidth: 160 }}>Raised</th>
                    <th className={styles.num}>Points</th>
                    <th>Page</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.className ?? "—"}</td>
                      <td className={styles.nowrap}>
                        <Swatch color={p.houseColor} /> {p.houseName ?? "—"}
                      </td>
                      <td>
                        <div className={styles.between}>
                          <span>{formatMoney(p.raisedCents, { whole: true })}</span>
                          <span className={styles.muted}>of {formatMoney(p.goalCents, { whole: true })}</span>
                        </div>
                        <ProgressBar progress={percentOf(p.raisedCents, p.goalCents)} barSize="small" aria-label={`${p.name}: ${percentOf(p.raisedCents, p.goalCents)}% of goal`} />
                      </td>
                      <td className={styles.num}>{p.points.toLocaleString("en-AU")}</td>
                      <td>
                        <NextLink href={p.publicPath} className={styles.code} target="_blank">
                          {p.code}
                        </NextLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className={styles.muted}>Nobody enrolled yet.</p>
        )}
      </Card>
    </div>
  );
}
