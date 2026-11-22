"use client";

import { FormControl, Select, TextInput } from "@primer/react";
import { useActionState, useRef } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { Card, VStack } from "@/components/ui/Card";
import { addClass, addHouse, setClassTeacher } from "../actions";
import styles from "../admin.module.css";

type ClassRow = { id: string; name: string; year: string; teacherId: string; room: string; students: number };
type HouseRow = { id: string; name: string; color: string; students: number };

const HOUSE_COLOURS = ["blue", "green", "red", "yellow", "purple", "orange", "pink"] as const;

function HouseSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        borderRadius: 999,
        background: `var(--display-${color}-bgColor-emphasis, var(--bgColor-neutral-emphasis))`,
      }}
    />
  );
}

/** Changing the teacher saves immediately. */
function TeacherSelect({ classId, value, teachers }: { classId: string; value: string; teachers: { id: string; name: string }[] }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={setClassTeacher}>
      <input type="hidden" name="classId" value={classId} />
      <Select name="teacherId" defaultValue={value} onChange={() => ref.current?.requestSubmit()} aria-label="Class teacher" size="small">
        <Select.Option value="">No teacher</Select.Option>
        {teachers.map((t) => (
          <Select.Option key={t.id} value={t.id}>
            {t.name}
          </Select.Option>
        ))}
      </Select>
    </form>
  );
}

export function ClassesView({
  classes,
  houses,
  teachers,
  yearOptions,
}: {
  classes: ClassRow[];
  houses: HouseRow[];
  teachers: { id: string; name: string }[];
  yearOptions: { value: number; label: string }[];
}) {
  const [classState, classAction] = useActionState(addClass, undefined);
  const [houseState, houseAction] = useActionState(addHouse, undefined);

  return (
    <div className={styles.twoCol}>
      <VStack gap={16}>
        <Card title={`Classes (${classes.length})`} padded={false}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Students</th>
                  <th>Teacher</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div className={styles.muted}>
                        {c.year}
                        {c.room ? ` · ${c.room}` : ""}
                      </div>
                    </td>
                    <td>{c.students}</td>
                    <td>
                      <TeacherSelect classId={c.id} value={c.teacherId} teachers={teachers} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={`Houses (${houses.length})`} padded={false}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {houses.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <span className={styles.person}>
                        <HouseSwatch color={h.color} /> <b>{h.name}</b>
                      </span>
                    </td>
                    <td className={styles.muted}>{h.students} students</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </VStack>

      <VStack gap={16}>
        <Card title="Add a class">
          <form action={classAction} className={styles.form}>
            <FormMessage state={classState} />
            <div className={styles.row}>
              <FormControl required>
                <FormControl.Label>Name</FormControl.Label>
                <TextInput name="name" placeholder="e.g. 4B" block />
              </FormControl>
              <FormControl required>
                <FormControl.Label>Year level</FormControl.Label>
                <Select name="yearLevel" block>
                  {yearOptions.map((y) => (
                    <Select.Option key={y.value} value={String(y.value)}>
                      {y.label}
                    </Select.Option>
                  ))}
                </Select>
              </FormControl>
            </div>
            <FormControl>
              <FormControl.Label>Teacher</FormControl.Label>
              <Select name="teacherId" block>
                <Select.Option value="">Choose later</Select.Option>
                {teachers.map((t) => (
                  <Select.Option key={t.id} value={t.id}>
                    {t.name}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormControl.Label>Room</FormControl.Label>
              <TextInput name="room" block />
            </FormControl>
            <div>
              <SubmitButton pendingLabel="Adding…">Add class</SubmitButton>
            </div>
          </form>
        </Card>
        <Card title="Add a house">
          <form action={houseAction} className={styles.form}>
            <FormMessage state={houseState} />
            <div className={styles.row}>
              <FormControl required>
                <FormControl.Label>Name</FormControl.Label>
                <TextInput name="name" block />
              </FormControl>
              <FormControl required>
                <FormControl.Label>Colour</FormControl.Label>
                <Select name="color" block>
                  {HOUSE_COLOURS.map((c) => (
                    <Select.Option key={c} value={c}>
                      {c[0]!.toUpperCase() + c.slice(1)}
                    </Select.Option>
                  ))}
                </Select>
              </FormControl>
            </div>
            <div>
              <SubmitButton pendingLabel="Adding…">Add house</SubmitButton>
            </div>
          </form>
        </Card>
      </VStack>
    </div>
  );
}
