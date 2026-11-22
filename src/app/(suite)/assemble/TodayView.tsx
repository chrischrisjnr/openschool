"use client";

import { CheckCircleFillIcon, ChevronRightIcon } from "@primer/octicons-react";
import { Button, Label } from "@primer/react";
import NextLink from "next/link";
import type { AttendanceStatus } from "@/db/schema";
import { icons, type IconName } from "@/components/icons";
import { ButtonLink, PageTitle } from "@/components/ui";
import { Card, Grid, InitialsAvatar, Stat } from "@/components/ui/Card";
import type { CalendarEvent } from "@/lib/assemble/calendar";
import type { NoticeListItem } from "@/lib/assemble/notices";
import { pluralise } from "@/lib/format";
import { approveNote } from "./attendance/actions";
import { AttendanceLabel, Meta, Meter, NoticeCategoryLabel, Row, RowList } from "./_components/bits";
import { EventAgenda } from "./_components/EventAgenda";
import shared from "./_components/assemble.module.css";
import styles from "./today.module.css";

export type ChildCard = {
  id: string;
  name: string;
  detail: string;
  teacher: string | null;
  house: string | null;
  houseColor: string | null;
  today: { kind: "status"; status: AttendanceStatus } | { kind: "text"; text: string };
  rate: number | null;
  absences: number;
};

export type ActionItem = {
  key: string;
  icon: IconName;
  title: string;
  detail: string;
  href: string;
  tone: "danger" | "attention" | "accent";
};

function NoSchool({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return <p className={styles.noSchool}>{reason}</p>;
}

/* ------------------------------------------------------------------ */
/* Families                                                            */
/* ------------------------------------------------------------------ */

export function FamilyToday({
  firstName,
  dateLabel,
  noSchoolReason,
  termLabel,
  kids,
  actions,
  canAct,
  events,
  notices,
  today,
  tz,
}: {
  today: string;
  firstName: string;
  dateLabel: string;
  noSchoolReason: string | null;
  termLabel: string;
  kids: ChildCard[];
  actions: ActionItem[];
  canAct: boolean;
  events: CalendarEvent[];
  notices: NoticeListItem[];
  tz: string;
}) {
  return (
    <div className={shared.stack}>
      <PageTitle title={`Hi ${firstName}`} description={dateLabel} />

      {kids.length > 0 ? (
        <section aria-label="Your children" className={styles.kids}>
          {kids.map((k) => (
            <article key={k.id} className={styles.kid}>
              <div className={styles.kidHead}>
                <InitialsAvatar name={k.name} size={44} />
                <div className={styles.kidName}>
                  <h2>{k.name}</h2>
                  <p>{k.detail}</p>
                </div>
              </div>
              <dl className={styles.kidFacts}>
                {k.teacher ? (
                  <div>
                    <dt>Teacher</dt>
                    <dd>{k.teacher}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Today</dt>
                  <dd>
                    {k.today.kind === "status" ? (
                      <AttendanceLabel status={k.today.status} />
                    ) : (
                      <span className={shared.muted}>{k.today.text}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{termLabel} attendance</dt>
                  <dd>
                    {k.rate !== null ? (
                      <span className={styles.rate}>
                        <strong>{k.rate}%</strong>
                        <span className={shared.muted}>
                          {k.absences ? ` · ${pluralise(k.absences, "day")} away` : " · no days away"}
                        </span>
                      </span>
                    ) : (
                      <span className={shared.muted}>No records yet</span>
                    )}
                  </dd>
                </div>
              </dl>
              {canAct ? (
                <div className={styles.kidActions}>
                  <ButtonLink href={`/assemble/attendance/report?student=${k.id}`} size="small" leadingIcon="checklist">
                    Report an absence
                  </ButtonLink>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      <Card
        title={
          <span className={styles.cardTitleWithCount}>
            Action needed {actions.length ? <Label variant="attention">{actions.length}</Label> : null}
          </span>
        }
        padded={false}
      >
        {actions.length ? (
          <RowList label="Action needed">
            {actions.map((a) => {
              const Icon = icons[a.icon];
              return (
                <Row
                  key={a.key}
                  href={a.href}
                  leading={
                    <span className={styles.actionIcon} data-tone={a.tone}>
                      <Icon size={16} />
                    </span>
                  }
                  title={a.title}
                  meta={a.detail}
                  trailing={<ChevronRightIcon className={shared.muted} />}
                />
              );
            })}
          </RowList>
        ) : (
          <div className={styles.allDone}>
            <CheckCircleFillIcon size={20} />
            <span>You&apos;re all caught up. Nothing needs your attention.</span>
          </div>
        )}
      </Card>

      <div className={shared.columnsEven}>
        <Card title="Next 7 days" action={<NextLink href="/assemble/calendar" className={shared.cardLink}>Calendar</NextLink>} padded={false}>
          <NoSchool reason={noSchoolReason} />
          <EventAgenda events={events} tz={tz} today={today} fromDay={today} emptyText="Nothing on the calendar this week." />
        </Card>
        <Card title="Latest notices" action={<NextLink href="/assemble/notices" className={shared.cardLink}>All notices</NextLink>} padded={false}>
          {notices.length ? (
            <RowList label="Latest notices">
              {notices.map((n) => (
                <Row
                  key={n.id}
                  href={`/assemble/notices/${n.id}`}
                  unread={!n.read}
                  title={n.title}
                  meta={<Meta parts={[n.when, n.audience]} />}
                  trailing={<NoticeCategoryLabel category={n.category} />}
                />
              ))}
            </RowList>
          ) : (
            <p className={shared.emptyLine}>No notices yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Staff                                                               */
/* ------------------------------------------------------------------ */

type RollRow = { classId: string; name: string; marked: number; total: number; absent: number };
type NoteSummary = { id: string; student: string; className: string | null; when: string; reason: string; note: string | null };
type NoticeRate = {
  id: string;
  title: string;
  audience: string;
  published: string;
  requiresAck: boolean;
  unit: "families" | "staff";
  total: number;
  done: number;
};

export function StaffToday({
  firstName,
  dateLabel,
  noSchoolReason,
  rollDay,
  rollDayLabel,
  nextSchoolDayLabel,
  ownClasses,
  rolls,
  notes,
  notesTotal,
  unexplainedCount,
  notices,
  money,
  events,
  today,
  tz,
}: {
  today: string;
  firstName: string;
  dateLabel: string;
  noSchoolReason: string | null;
  rollDay: string;
  rollDayLabel: string;
  nextSchoolDayLabel: string | null;
  ownClasses: boolean;
  rolls: RollRow[];
  notes: NoteSummary[];
  notesTotal: number;
  unexplainedCount: number;
  notices: NoticeRate[];
  money: { outstanding: string; collected: string; studentsOwing: number } | null;
  events: CalendarEvent[];
  tz: string;
}) {
  const classesMarked = rolls.filter((r) => r.marked >= r.total && r.total > 0).length;
  return (
    <div className={shared.stack}>
      <PageTitle
        title={`Hi ${firstName}`}
        description={dateLabel}
        actions={
          <>
            <ButtonLink href="/assemble/notices/new" leadingIcon="megaphone">
              Post a notice
            </ButtonLink>
            <ButtonLink href="/assemble/attendance" variant="primary" leadingIcon="checklist">
              Mark the roll
            </ButtonLink>
          </>
        }
      />

      <Grid min={180}>
        {money ? (
          <>
            <Stat label="Outstanding (open items)" value={money.outstanding} hint={`${pluralise(money.studentsOwing, "student")} with something to pay`} tone="attention" />
            <Stat label="Collected (open items)" value={money.collected} tone="success" />
          </>
        ) : null}
        <Stat label="Absence notes to review" value={notesTotal} tone={notesTotal ? "accent" : undefined} />
        <Stat label="Unexplained absences this term" value={unexplainedCount} tone={unexplainedCount ? "danger" : undefined} />
      </Grid>

      <div className={shared.columns}>
        <div className={shared.stack}>
          <Card
            title={ownClasses ? `Your roll · ${rollDayLabel}` : `Rolls across the school · ${rollDayLabel}`}
            action={!ownClasses ? <span className={shared.small}>{classesMarked} of {rolls.length} complete</span> : undefined}
            padded={false}
          >
            {noSchoolReason ? (
              <p className={styles.noSchool}>
                {noSchoolReason}.{nextSchoolDayLabel ? ` Next school day: ${nextSchoolDayLabel}.` : ""} Showing the last school day.
              </p>
            ) : null}
            {!ownClasses && rolls.length ? (
              <ul className={styles.rollTiles} aria-label="Class rolls">
                {rolls.map((r) => {
                  const done = r.total > 0 && r.marked >= r.total;
                  return (
                    <li key={r.classId}>
                      <NextLink href={`/assemble/attendance?class=${r.classId}&date=${rollDay}`} className={styles.rollTile} data-done={done || undefined}>
                        <span className={styles.rollTileName}>{r.name}</span>
                        <span className={styles.rollTileStatus}>
                          {done ? (
                            <>
                              <CheckCircleFillIcon size={12} /> {r.absent ? `${r.absent} away` : "All here"}
                            </>
                          ) : r.marked ? (
                            `${r.marked}/${r.total} marked`
                          ) : (
                            "Not marked"
                          )}
                        </span>
                      </NextLink>
                    </li>
                  );
                })}
              </ul>
            ) : rolls.length ? (
              <RowList label="Class rolls">
                {rolls.map((r) => {
                  const done = r.total > 0 && r.marked >= r.total;
                  return (
                    <Row
                      key={r.classId}
                      href={`/assemble/attendance?class=${r.classId}&date=${rollDay}`}
                      leading={<span className={styles.classBadge}>{r.name}</span>}
                      title={done ? "Roll complete" : r.marked ? `${r.marked} of ${r.total} marked` : "Not marked yet"}
                      meta={done ? `${r.total - r.absent} at school · ${r.absent} away` : `${pluralise(r.total, "student")}`}
                      trailing={
                        done ? (
                          <Label variant="success">Done</Label>
                        ) : (
                          <Label variant={r.marked ? "attention" : "danger"}>{r.marked ? "In progress" : "To do"}</Label>
                        )
                      }
                    />
                  );
                })}
              </RowList>
            ) : (
              <p className={shared.emptyLine}>You don&apos;t have a class of your own. You can still mark any roll from Attendance.</p>
            )}
          </Card>

          <Card
            title="Absence notes to review"
            action={<NextLink href="/assemble/attendance#notes" className={shared.cardLink}>All notes</NextLink>}
            padded={false}
          >
            {notes.length ? (
              <RowList label="Absence notes">
                {notes.map((n) => (
                  <Row
                    key={n.id}
                    leading={<InitialsAvatar name={n.student} size={36} />}
                    title={n.student}
                    meta={
                      <>
                        <Meta parts={[n.className, n.when, n.reason]} />
                        {n.note ? <span className={styles.quote}>“{n.note}”</span> : null}
                      </>
                    }
                    trailing={
                      <form action={approveNote}>
                        <input type="hidden" name="noteId" value={n.id} />
                        <Button type="submit" size="small">
                          Approve
                        </Button>
                      </form>
                    }
                  />
                ))}
              </RowList>
            ) : (
              <div className={styles.allDone}>
                <CheckCircleFillIcon size={20} />
                <span>No notes waiting. Nice work.</span>
              </div>
            )}
          </Card>
        </div>

        <div className={shared.stack}>
          <Card title="Recent notices" action={<NextLink href="/assemble/notices" className={shared.cardLink}>All notices</NextLink>} padded={false}>
            {notices.length ? (
              <RowList label="Recent notices">
                {notices.map((n) => (
                  <Row
                    key={n.id}
                    href={`/assemble/notices/${n.id}`}
                    title={n.title}
                    meta={
                      <span className={styles.reach}>
                        <span>
                          {n.done} of {n.total} {n.unit} {n.requiresAck ? "acknowledged" : "read"} · {n.audience}
                        </span>
                        <Meter value={n.done} max={n.total} label={n.requiresAck ? "Acknowledged" : "Read"} tone={n.requiresAck ? "attention" : "accent"} />
                      </span>
                    }
                  />
                ))}
              </RowList>
            ) : (
              <p className={shared.emptyLine}>No notices yet.</p>
            )}
          </Card>
          <Card title="Next 7 days" action={<NextLink href="/assemble/calendar" className={shared.cardLink}>Calendar</NextLink>} padded={false}>
            <EventAgenda events={events} tz={tz} today={today} fromDay={today} emptyText="Nothing on the calendar this week." />
          </Card>
        </div>
      </div>
    </div>
  );
}
