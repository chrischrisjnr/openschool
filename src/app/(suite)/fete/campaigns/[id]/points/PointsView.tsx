"use client";

import { TrashIcon } from "@primer/octicons-react";
import { FormControl, IconButton, Select, TextInput } from "@primer/react";
import { useActionState, useEffect, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { formatRelative } from "@/lib/format";
import type { Board } from "@/lib/fete/boards";
import { awardPoints, deleteAward } from "../../../actions";
import { Leaderboard } from "../../../_components/Leaderboard";
import type { ParticipantOption } from "../options";
import styles from "../campaign.module.css";

type TargetType = "student" | "class" | "year" | "house";
type Award = {
  id: string;
  targetType: TargetType;
  targetLabel: string;
  points: number;
  reason: string;
  awardedByName: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<TargetType, string> = { student: "A student", class: "A class", year: "A year level", house: "A house" };
const SUGGESTIONS = ["Best costume 🎭", "Loudest cheering 📣", "Most colourful 🌈", "Sponsor forms returned ✅", "Great sportsmanship 🤝"];

export function PointsView({
  campaignId,
  pointsPerDollar,
  targets,
  awards,
  boards,
  now: nowIso,
}: {
  campaignId: string;
  pointsPerDollar: number;
  targets: Record<TargetType, ParticipantOption[]>;
  awards: Award[];
  boards: Board[];
  now: string;
}) {
  const [state, action] = useActionState(awardPoints, undefined);
  const [type, setType] = useState<TargetType>("class");
  const [reason, setReason] = useState("");
  const options = targets[type];
  const groups = [...new Set(options.map((o) => o.group))];
  const now = new Date(nowIso);
  useEffect(() => {
    if (state?.ok) setReason("");
  }, [state]);

  return (
    <div className={styles.stack}>
      <Card title="Award bonus points">
        <form action={action} className={styles.stackSmall} key={state?.ok ? state.message : "award"}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <p className={styles.muted}>
            Everyone earns {pointsPerDollar} {pointsPerDollar === 1 ? "point" : "points"} per dollar raised. Add bonus points for spirit, costumes or helping out — use a minus number to correct a mistake.
          </p>
          <div className={styles.formGrid}>
            <FormControl>
              <FormControl.Label>Who</FormControl.Label>
              <Select name="targetType" value={type} onChange={(e) => setType(e.target.value as TargetType)} block>
                {(Object.keys(TYPE_LABEL) as TargetType[]).map((t) => (
                  <Select.Option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
            <FormControl required>
              <FormControl.Label>{type === "student" ? "Student" : type === "class" ? "Class" : type === "year" ? "Year level" : "House"}</FormControl.Label>
              <Select name="targetId" block defaultValue="" key={type}>
                <Select.Option value="" disabled>
                  Choose…
                </Select.Option>
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
              {state?.fieldErrors?.targetId ? <FormControl.Validation variant="error">{state.fieldErrors.targetId}</FormControl.Validation> : null}
            </FormControl>
            <FormControl required>
              <FormControl.Label>Points</FormControl.Label>
              <TextInput name="points" type="number" step={1} placeholder="50" block />
              {state?.fieldErrors?.points ? <FormControl.Validation variant="error">{state.fieldErrors.points}</FormControl.Validation> : null}
            </FormControl>
            <FormControl required>
              <FormControl.Label>Reason</FormControl.Label>
              <TextInput name="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Best costume" block maxLength={120} />
              {state?.fieldErrors?.reason ? <FormControl.Validation variant="error">{state.fieldErrors.reason}</FormControl.Validation> : null}
            </FormControl>
          </div>
          <div className={styles.row}>
            <span className={styles.muted}>Ideas:</span>
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className={styles.chip} onClick={() => setReason(s)}>
                {s}
              </button>
            ))}
          </div>
          <FormMessage state={state} />
          <div>
            <SubmitButton pendingLabel="Awarding…">Award points</SubmitButton>
          </div>
        </form>
      </Card>

      <div className={styles.main2}>
        <Card title={`History (${awards.length})`}>
          {awards.length ? (
            <ul className={styles.awardList}>
              {awards.map((a) => (
                <li key={a.id} className={styles.award}>
                  <span className={styles.awardPoints} data-negative={a.points < 0}>
                    {a.points > 0 ? "+" : ""}
                    {a.points}
                  </span>
                  <div>
                    <div>
                      <strong>{a.targetLabel}</strong> — {a.reason}
                    </div>
                    <div className={styles.muted}>
                      {a.awardedByName ?? "Staff"} · {formatRelative(a.createdAt, now)}
                    </div>
                  </div>
                  <form action={deleteAward}>
                    <input type="hidden" name="awardId" value={a.id} />
                    <IconButton type="submit" icon={TrashIcon} aria-label={`Remove award: ${a.reason}`} variant="invisible" size="small" />
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>No bonus points yet.</p>
          )}
        </Card>
        <Card title="Standings">
          <Leaderboard boards={boards} defaultMetric="points" showMetricToggle={false} />
        </Card>
      </div>
    </div>
  );
}
