"use client";

import { HeartIcon, SearchIcon } from "@primer/octicons-react";
import { FormControl, Label, TextInput, type LabelColorOptions } from "@primer/react";
import { useState } from "react";
import { PageTitle } from "@/components/ui";
import { Card, InitialsAvatar } from "@/components/ui/Card";
import { FilterChips, Meta, Row, RowList } from "../_components/bits";
import shared from "../_components/assemble.module.css";
import styles from "./students.module.css";

const HOUSE_VARIANT: Record<string, LabelColorOptions> = {
  yellow: "attention",
  red: "danger",
  green: "success",
  purple: "done",
  blue: "accent",
  orange: "severe",
  pink: "sponsors",
};

export function StudentsView({
  classes,
  classId,
  classInfo,
  termLabel,
  students,
}: {
  classes: { id: string; name: string }[];
  classId: string | null;
  classInfo: { name: string; teacher: string | null; room: string | null } | null;
  termLabel: string;
  students: {
    id: string;
    name: string;
    className: string | null;
    house: string | null;
    houseColor: string | null;
    medical: string | null;
    rate: number | null;
  }[];
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? students.filter((s) => s.name.toLowerCase().includes(q)) : students;
  const medical = students.filter((s) => s.medical);

  return (
    <div className={shared.stack}>
      <PageTitle
        title={classInfo ? `Class ${classInfo.name}` : "All students"}
        description={
          classInfo ? (
            <Meta parts={[classInfo.teacher, classInfo.room, `${students.length} students`]} />
          ) : (
            `${students.length} students. Medical notes are visible to staff only.`
          )
        }
      />
      <FilterChips
        label="Choose a class"
        items={[
          ...classes.map((c) => ({ href: `/assemble/students?class=${c.id}`, label: c.name, current: c.id === classId })),
          { href: "/assemble/students?class=all", label: "Everyone", current: !classId },
        ]}
      />
      {classInfo && medical.length ? (
        <Card title={<span className={styles.medicalTitle}><HeartIcon /> Medical & dietary notes</span>} padded={false}>
          <RowList label="Medical notes">
            {medical.map((s) => (
              <Row key={s.id} href={`/assemble/students/${s.id}`} title={s.name} meta={s.medical} />
            ))}
          </RowList>
        </Card>
      ) : null}
      <Card
        title={`${shown.length} ${shown.length === 1 ? "student" : "students"}`}
        action={
          <FormControl>
            <FormControl.Label visuallyHidden>Search students</FormControl.Label>
            <TextInput size="small" leadingVisual={SearchIcon} placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} />
          </FormControl>
        }
        padded={false}
      >
        {shown.length ? (
          <RowList label="Students">
            {shown.map((s) => (
              <Row
                key={s.id}
                href={`/assemble/students/${s.id}`}
                leading={<InitialsAvatar name={s.name} size={32} />}
                title={
                  <>
                    {s.name}
                    {s.medical ? (
                      <span className={styles.medicalIcon} title="Has medical notes">
                        <HeartIcon size={12} />
                        <span className="sr-only">Has medical notes</span>
                      </span>
                    ) : null}
                  </>
                }
                meta={<Meta parts={[!classInfo && s.className ? `Class ${s.className}` : null, s.rate !== null ? `${s.rate}% attendance (${termLabel})` : null]} />}
                trailing={s.house ? <Label variant={HOUSE_VARIANT[s.houseColor ?? ""] ?? "secondary"}>{s.house}</Label> : null}
              />
            ))}
          </RowList>
        ) : (
          <p className={shared.emptyLine}>No students match “{query}”.</p>
        )}
      </Card>
    </div>
  );
}
