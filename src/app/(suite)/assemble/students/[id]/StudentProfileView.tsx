"use client";

import { Banner, Label } from "@primer/react";
import type { AttendanceStatus } from "@/db/schema";
import { PageTitle } from "@/components/ui";
import { Card, Grid, InitialsAvatar, Stat } from "@/components/ui/Card";
import type { AttendanceStats } from "@/lib/assemble/attendance";
import { AttendanceLabel, Meta, Row, RowList } from "../../_components/bits";
import shared from "../../_components/assemble.module.css";
import styles from "../students.module.css";

export function StudentProfileView({
  student: s,
  family,
  stats,
  termLabel,
  recent,
  notes,
  charges,
}: {
  student: {
    name: string;
    legalName: string | null;
    year: string;
    className: string | null;
    classId: string | null;
    teacher: string | null;
    house: string | null;
    dob: string | null;
    medical: string | null;
  };
  family: { id: string; name: string; email: string; phone: string | null; relationship: string; primary: boolean }[];
  stats: AttendanceStats;
  termLabel: string;
  recent: { date: string; label: string; status: AttendanceStatus; note: string | null }[];
  notes: { id: string; when: string; reason: string; note: string | null; status: "submitted" | "approved" }[];
  charges: {
    id: string;
    itemId: string;
    title: string;
    amount: string;
    status: string;
    consent: string | null;
    needsAction: boolean;
    due: string | null;
  }[];
}) {
  return (
    <div className={shared.stack}>
      <PageTitle
        back={{ href: s.classId ? `/assemble/students?class=${s.classId}` : "/assemble/students", label: s.className ? `Class ${s.className}` : "Students" }}
        title={
          <span className={styles.profileHead}>
            <InitialsAvatar name={s.name} size={48} /> {s.name}
          </span>
        }
        description={<Meta parts={[s.year, s.className && `Class ${s.className}`, s.teacher, s.house && `${s.house} house`]} />}
      />
      {s.medical ? <Banner variant="critical" title="Medical & dietary" description={s.medical} /> : null}

      <Grid min={150}>
        <Stat label={`Attendance · ${termLabel}`} value={stats.rate !== null ? `${stats.rate}%` : "—"} tone={stats.rate !== null && stats.rate < 90 ? "danger" : "success"} />
        <Stat label="Days present" value={stats.present} />
        <Stat label="Late" value={stats.late} tone={stats.late ? "attention" : undefined} />
        <Stat label="Absent (unexplained)" value={stats.absent} tone={stats.absent ? "danger" : undefined} />
        <Stat label="Absent (explained)" value={stats.excused} />
      </Grid>

      <div className={shared.columnsEven}>
        <div className={shared.stack}>
          <Card title="Details">
            <dl className={styles.facts}>
              {s.legalName ? (
                <div>
                  <dt>Legal name</dt>
                  <dd>{s.legalName}</dd>
                </div>
              ) : null}
              <div>
                <dt>Date of birth</dt>
                <dd>{s.dob ?? "—"}</dd>
              </div>
              <div>
                <dt>Year level</dt>
                <dd>{s.year}</dd>
              </div>
              <div>
                <dt>House</dt>
                <dd>{s.house ?? "—"}</dd>
              </div>
            </dl>
          </Card>
          <Card title="Parents & carers" padded={false}>
            {family.length ? (
              <RowList label="Parents and carers">
                {family.map((g) => (
                  <Row
                    key={g.id}
                    leading={<InitialsAvatar name={g.name} size={32} />}
                    title={
                      <>
                        {g.name} {g.primary ? <Label variant="secondary">Primary</Label> : null}
                      </>
                    }
                    meta={
                      <span className={styles.contact}>
                        <span>{g.relationship}</span>
                        <a href={`mailto:${g.email}`}>{g.email}</a>
                        {g.phone ? <a href={`tel:${g.phone.replace(/\s/g, "")}`}>{g.phone}</a> : null}
                      </span>
                    }
                  />
                ))}
              </RowList>
            ) : (
              <p className={shared.emptyLine}>No parents or carers linked yet.</p>
            )}
          </Card>
          <Card title="Forms & payments" padded={false}>
            {charges.length ? (
              <RowList label="Forms and payments">
                {charges.map((c) => (
                  <Row
                    key={c.id}
                    href={`/assemble/payments/${c.itemId}`}
                    title={c.title}
                    meta={<Meta parts={[c.amount, c.due && `due ${c.due}`]} />}
                    trailing={
                      <>
                        {c.consent === "pending" ? <Label variant="attention">Awaiting permission</Label> : null}
                        {c.consent === "declined" ? <Label variant="secondary">Declined</Label> : null}
                        {c.consent === "granted" && c.amount === "Consent only" ? <Label variant="success">Permission given</Label> : null}
                        {c.status === "paid" ? <Label variant="success">Paid</Label> : null}
                        {c.status === "waived" ? <Label variant="secondary">No charge</Label> : null}
                        {c.status === "unpaid" && c.needsAction && c.consent !== "pending" && c.amount !== "Consent only" ? <Label variant="danger">Not paid</Label> : null}
                      </>
                    }
                  />
                ))}
              </RowList>
            ) : (
              <p className={shared.emptyLine}>Nothing yet.</p>
            )}
          </Card>
        </div>
        <div className={shared.stack}>
          <Card title="Recent attendance" padded={false}>
            {recent.length ? (
              <RowList label="Recent attendance">
                {recent.map((r) => (
                  <Row key={r.date} title={r.label} meta={r.note ?? undefined} trailing={<AttendanceLabel status={r.status} />} />
                ))}
              </RowList>
            ) : (
              <p className={shared.emptyLine}>No attendance recorded yet.</p>
            )}
          </Card>
          <Card title="Absence notes" padded={false}>
            {notes.length ? (
              <RowList label="Absence notes">
                {notes.map((n) => (
                  <Row
                    key={n.id}
                    title={`${n.when} — ${n.reason}`}
                    meta={n.note ? `“${n.note}”` : undefined}
                    trailing={n.status === "approved" ? <Label variant="success">Approved</Label> : <Label variant="attention">To review</Label>}
                  />
                ))}
              </RowList>
            ) : (
              <p className={shared.emptyLine}>No absence notes.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
