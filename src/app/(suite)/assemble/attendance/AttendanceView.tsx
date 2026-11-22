"use client";

import { AlertIcon, CheckCircleFillIcon, HeartIcon } from "@primer/octicons-react";
import { Banner, Button, FormControl, Label, Select, TextInput } from "@primer/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AttendanceStatus } from "@/db/schema";
import { ButtonLink, FormMessage, PageTitle } from "@/components/ui";
import { Card, InitialsAvatar } from "@/components/ui/Card";
import type { AttendanceStats, RollStudent, UnexplainedAbsence } from "@/lib/assemble/attendance";
import { ABSENCE_REASONS, ATTENDANCE_STATUS } from "@/lib/assemble/constants";
import { pluralise } from "@/lib/format";
import { Meta, Row, RowList } from "../_components/bits";
import shared from "../_components/assemble.module.css";
import { useFormAction } from "../_components/useFormAction";
import { approveNote, saveRoll } from "./actions";
import styles from "./attendance.module.css";

type NoteSummary = { id: string; student: string; className?: string | null; when: string; reason: string; note: string | null; by: string };

function ApproveButton({ id }: { id: string }) {
  return (
    <form action={approveNote}>
      <input type="hidden" name="noteId" value={id} />
      <Button type="submit" size="small">
        Approve
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Staff: the roll                                                     */
/* ------------------------------------------------------------------ */

const ROLL_OPTIONS: AttendanceStatus[] = ["present", "late", "absent", "excused"];

function RollForm({ classId, className, date, roll }: { classId: string; className: string; date: string; roll: RollStudent[] }) {
  const initial = Object.fromEntries(roll.map((s) => [s.id, s.status ?? (s.noteReason ? "excused" : null)])) as Record<string, AttendanceStatus | null>;
  const [marks, setMarks] = useState(initial);
  // When the saved roll changes on the server (after saving, or approving a note), start from it again.
  const signature = roll.map((s) => `${s.id}=${s.status ?? ""}:${s.noteReason ?? ""}`).join(",");
  const [prevSignature, setPrevSignature] = useState(signature);
  if (signature !== prevSignature) {
    setPrevSignature(signature);
    setMarks(initial);
  }
  const { state, pending, onSubmit } = useFormAction(saveRoll);
  const marked = Object.values(marks).filter(Boolean).length;
  const alreadySaved = roll.some((s) => s.status);
  const dirty = roll.some((s) => marks[s.id] !== s.status);
  const counts = ROLL_OPTIONS.map((k) => [k, Object.values(marks).filter((m) => m === k).length] as const);

  const markAllPresent = () =>
    setMarks((prev) => Object.fromEntries(roll.map((s) => [s.id, prev[s.id] ?? (s.noteReason ? "excused" : "present")])));

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="date" value={date} />
      {roll.map((s) => (s.note && marks[s.id] === s.status ? <input key={`n${s.id}`} type="hidden" name={`note:${s.id}`} value={s.note} /> : null))}

      <div className={styles.rollHead}>
        <span className={styles.rollCount}>
          <strong>
            {marked} of {roll.length}
          </strong>{" "}
          marked
          <span className={styles.rollTally}>
            {counts
              .filter(([, n]) => n > 0)
              .map(([k, n]) => (
                <span key={k} data-status={k}>
                  {n} {ATTENDANCE_STATUS[k].label.toLowerCase()}
                </span>
              ))}
          </span>
        </span>
        <Button type="button" size="small" onClick={markAllPresent} disabled={marked === roll.length}>
          Mark everyone else present
        </Button>
      </div>

      <ul className={styles.roll} aria-label={`Roll for ${className}`}>
        {roll.map((s) => {
          const value = marks[s.id];
          return (
            <li key={s.id} className={styles.rollRow} data-status={value ?? "unmarked"}>
              <span className={styles.rollStudent}>
                <InitialsAvatar name={s.name} size={32} />
                <span>
                  <span className={styles.rollName}>{s.name}</span>
                  <span className={styles.rollHints}>
                    {s.noteReason ? <Label variant="accent">Note: {ABSENCE_REASONS[s.noteReason]}</Label> : null}
                    {s.medical ? (
                      <span className={styles.medical} title="Has medical notes — see the student's profile">
                        <HeartIcon size={12} /> Medical
                      </span>
                    ) : null}
                  </span>
                </span>
              </span>
              <fieldset className={styles.toggle}>
                <legend className="sr-only">Attendance for {s.name}</legend>
                {ROLL_OPTIONS.map((o) => (
                  <label key={o} className={styles.toggleOption} data-status={o}>
                    <input
                      type="radio"
                      name={`status:${s.id}`}
                      value={o}
                      checked={value === o}
                      onChange={() => setMarks((prev) => ({ ...prev, [s.id]: o }))}
                    />
                    <span>{ATTENDANCE_STATUS[o].label}</span>
                  </label>
                ))}
              </fieldset>
            </li>
          );
        })}
      </ul>
      <div className={styles.saveBar}>
        <FormMessage state={dirty ? undefined : state} />
        <span className={styles.saveButton}>
          <Button type="submit" variant="primary" loading={pending} disabled={!marked}>
            {alreadySaved ? "Save changes" : "Save roll"}
          </Button>
        </span>
      </div>
    </form>
  );
}

export function StaffAttendance({
  classes,
  classId,
  date,
  dateLabel,
  today,
  weekend,
  roll,
  notes,
  unexplained,
  scopeLabel,
  termLabel,
}: {
  classes: { id: string; name: string; mine: boolean }[];
  classId: string;
  date: string;
  dateLabel: string;
  today: string;
  weekend: boolean;
  roll: RollStudent[];
  notes: NoteSummary[];
  unexplained: (UnexplainedAbsence & { dateLabel: string })[];
  scopeLabel: string;
  termLabel: string;
}) {
  const router = useRouter();
  const go = (c: string, d: string) => router.push(`/assemble/attendance?class=${c}&date=${d}`, { scroll: false });
  const current = classes.find((c) => c.id === classId);
  const mine = classes.filter((c) => c.mine);
  const others = classes.filter((c) => !c.mine);

  return (
    <div className={shared.stack}>
      <PageTitle title="Attendance" description="Mark the roll, review absence notes and follow up unexplained absences." />
      <div className={shared.columns}>
        <Card title={current ? `Roll · ${current.name}` : "Roll"} action={<span className={shared.small}>{dateLabel}</span>} padded={false}>
          <div className={styles.picker}>
            <FormControl>
              <FormControl.Label>Class</FormControl.Label>
              <Select value={classId} onChange={(e) => go(e.target.value, date)}>
                {mine.length ? (
                  <Select.OptGroup label="Your class">
                    {mine.map((c) => (
                      <Select.Option key={c.id} value={c.id}>
                        {c.name}
                      </Select.Option>
                    ))}
                  </Select.OptGroup>
                ) : null}
                <Select.OptGroup label={mine.length ? "Other classes" : "Classes"}>
                  {others.map((c) => (
                    <Select.Option key={c.id} value={c.id}>
                      {c.name}
                    </Select.Option>
                  ))}
                </Select.OptGroup>
              </Select>
            </FormControl>
            <FormControl>
              <FormControl.Label>Date</FormControl.Label>
              <TextInput type="date" value={date} max={today} onChange={(e) => e.target.value && go(classId, e.target.value)} />
            </FormControl>
          </div>
          {weekend ? (
            <p className={shared.emptyLine}>That&apos;s a weekend — choose a school day.</p>
          ) : roll.length ? (
            <RollForm key={`${classId}:${date}`} classId={classId} className={current?.name ?? ""} date={date} roll={roll} />
          ) : (
            <p className={shared.emptyLine}>No students in this class yet.</p>
          )}
        </Card>

        <div className={shared.stack}>
          <section id="notes">
            <Card title={`Absence notes to review (${notes.length})`} padded={false}>
              {notes.length ? (
                <RowList label="Absence notes to review">
                  {notes.map((n) => (
                    <Row
                      key={n.id}
                      title={n.student}
                      meta={
                        <>
                          <Meta parts={[n.className, n.when, n.reason]} />
                          {n.note ? <span className={styles.quote}>“{n.note}” — {n.by}</span> : null}
                        </>
                      }
                      trailing={<ApproveButton id={n.id} />}
                    />
                  ))}
                </RowList>
              ) : (
                <div className={styles.allDone}>
                  <CheckCircleFillIcon size={18} /> No notes waiting.
                </div>
              )}
            </Card>
          </section>
          <Card title={`Unexplained absences · ${termLabel}`} padded={false}>
            {unexplained.length ? (
              <>
                <p className={styles.cardIntro}>
                  {pluralise(unexplained.length, "absence")} {scopeLabel} with no note from home. Families see a reminder in Assemble.
                </p>
                <div className={styles.scrollList}>
                  <RowList label="Unexplained absences">
                    {unexplained.map((u) => (
                      <Row
                        key={u.attendanceId}
                        href={`/assemble/students/${u.studentId}`}
                        leading={<AlertIcon className={styles.alert} />}
                        title={u.studentName}
                        meta={<Meta parts={[u.className, u.dateLabel]} />}
                      />
                    ))}
                  </RowList>
                </div>
              </>
            ) : (
              <div className={styles.allDone}>
                <CheckCircleFillIcon size={18} /> Every absence has been explained.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Families                                                            */
/* ------------------------------------------------------------------ */

type Kid = {
  id: string;
  name: string;
  short: string;
  className: string | null;
  stats: AttendanceStats;
  marks: Record<string, AttendanceStatus>;
};

export function FamilyAttendance({
  canAct,
  reported,
  termLabel,
  days,
  kids,
  unexplained,
  notes,
}: {
  canAct: boolean;
  reported: boolean;
  termLabel: string;
  days: { key: string; label: string }[];
  kids: Kid[];
  unexplained: (UnexplainedAbsence & { dateLabel: string })[];
  notes: (NoteSummary & { status: "submitted" | "approved" })[];
}) {
  return (
    <div className={shared.stack}>
      <PageTitle
        title="Attendance"
        description={`How ${kids.map((k) => k.short).join(" and ") || "your family"} ${kids.length > 1 ? "are" : "is"} going this term.`}
        actions={
          canAct ? (
            <ButtonLink href="/assemble/attendance/report" variant="primary" leadingIcon="plus">
              Report an absence
            </ButtonLink>
          ) : undefined
        }
      />
      {reported ? (
        <Banner variant="success" title="Absence reported" description="Thank you — your child's teacher has been notified." />
      ) : null}
      {canAct && unexplained.length ? (
        <Card title="Absences we need a note for" padded={false}>
          <RowList label="Unexplained absences">
            {unexplained.map((u) => (
              <Row
                key={u.attendanceId}
                leading={<AlertIcon className={styles.alert} />}
                title={u.studentName}
                meta={`Absent ${u.dateLabel}`}
                trailing={
                  <ButtonLink href={`/assemble/attendance/report?student=${u.studentId}&date=${u.date}`} size="small">
                    Explain
                  </ButtonLink>
                }
              />
            ))}
          </RowList>
        </Card>
      ) : null}

      <div className={styles.kids}>
        {kids.map((k) => (
          <Card key={k.id} title={`${k.name}${k.className ? ` · ${k.className}` : ""}`}>
            <div className={styles.kidStats}>
              <div className={styles.bigRate}>
                <strong>{k.stats.rate !== null ? `${k.stats.rate}%` : "—"}</strong>
                <span className={shared.muted}>{termLabel} attendance</span>
              </div>
              <dl className={styles.counts}>
                {(["present", "late", "absent", "excused"] as const).map((s) => (
                  <div key={s} data-status={s}>
                    <dt>{ATTENDANCE_STATUS[s].label}</dt>
                    <dd>{k.stats[s]}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className={styles.strip}>
              <span className={`${shared.small} ${shared.muted}`}>Last four weeks</span>
              <ol className={styles.stripDays} aria-label={`${k.short}'s attendance over the last four weeks`}>
                {days.map((d) => {
                  const m = k.marks[d.key];
                  return (
                    <li key={d.key} data-status={m ?? "none"} title={`${d.label}: ${m ? ATTENDANCE_STATUS[m].label : "No record"}`}>
                      <span className="sr-only">
                        {d.label}: {m ? ATTENDANCE_STATUS[m].label : "No record"}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div className={styles.legend} aria-hidden>
                {(["present", "late", "absent", "excused"] as const).map((s) => (
                  <span key={s} data-status={s}>
                    {ATTENDANCE_STATUS[s].label}
                  </span>
                ))}
              </div>
            </div>
            {canAct ? (
              <div className={styles.kidFooter}>
                <NextLink href={`/assemble/attendance/report?student=${k.id}`}>Report an absence for {k.short}</NextLink>
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      <Card title="Absence notes" padded={false}>
        {notes.length ? (
          <RowList label="Absence notes">
            {notes.map((n) => (
              <Row
                key={n.id}
                title={`${n.student} — ${n.reason}`}
                meta={
                  <>
                    <Meta parts={[n.when, `sent by ${n.by}`]} />
                    {n.note ? <span className={styles.quote}>“{n.note}”</span> : null}
                  </>
                }
                trailing={n.status === "approved" ? <Label variant="success">Approved</Label> : <Label variant="attention">Sent to school</Label>}
              />
            ))}
          </RowList>
        ) : (
          <p className={shared.emptyLine}>No absence notes yet.</p>
        )}
      </Card>
    </div>
  );
}
