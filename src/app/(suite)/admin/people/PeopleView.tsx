"use client";

import { SearchIcon } from "@primer/octicons-react";
import { Button, FormControl, Label, Select, TextInput } from "@primer/react";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { Card, InitialsAvatar, VStack } from "@/components/ui/Card";
import { addStaff, addStudent, setUserDisabled } from "../actions";
import { NewAccounts } from "../NewAccounts";
import styles from "../admin.module.css";

type Staff = { id: string; name: string; email: string; title: string | null; role: string; disabled: boolean };
type StudentRow = { id: string; name: string; detail: string; guardians: string[] };

export function PeopleView({
  meId,
  q,
  classId,
  staff,
  classes,
  houses,
  students,
}: {
  meId: string;
  q: string;
  classId: string;
  staff: Staff[];
  classes: { id: string; name: string }[];
  houses: string[];
  students: StudentRow[];
}) {
  const [staffState, staffAction] = useActionState(addStaff, undefined);
  const [studentState, studentAction] = useActionState(addStudent, undefined);

  return (
    <div className={styles.twoCol}>
      <VStack gap={16}>
        <Card title={`Students (${students.length}${students.length === 200 ? "+" : ""})`} padded={false}>
          <form method="get" className={styles.inlineForm} style={{ padding: 12, flexWrap: "wrap" }} role="search">
            <TextInput name="q" defaultValue={q} placeholder="Search by name" leadingVisual={SearchIcon} aria-label="Search students" />
            <Select name="class" defaultValue={classId} aria-label="Filter by class">
              <Select.Option value="">All classes</Select.Option>
              {classes.map((c) => (
                <Select.Option key={c.id} value={c.id}>
                  {c.name}
                </Select.Option>
              ))}
            </Select>
            <Button type="submit">Filter</Button>
          </form>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Parents &amp; carers</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className={styles.person}>
                        <InitialsAvatar name={s.name} size={28} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                          <div className={styles.muted}>{s.detail}</div>
                        </div>
                      </div>
                    </td>
                    <td className={styles.muted}>
                      {s.guardians.map((g) => (
                        <div key={g}>{g}</div>
                      ))}
                    </td>
                  </tr>
                ))}
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.muted}>
                      No students match.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title={`Staff (${staff.length})`} padded={false}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className={styles.person}>
                        <InitialsAvatar name={s.name} size={28} />
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {s.name} {s.role === "admin" ? <Label variant="accent">Admin</Label> : null}{" "}
                            {s.disabled ? <Label variant="danger">Disabled</Label> : null}
                          </div>
                          <div className={styles.muted}>
                            {s.title ? `${s.title} · ` : ""}
                            {s.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {s.id !== meId ? (
                        <form action={setUserDisabled}>
                          <input type="hidden" name="userId" value={s.id} />
                          <input type="hidden" name="disabled" value={s.disabled ? "false" : "true"} />
                          <Button type="submit" size="small" variant={s.disabled ? "default" : "danger"}>
                            {s.disabled ? "Re-enable" : "Disable"}
                          </Button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </VStack>

      <VStack gap={16}>
        <Card title="Enrol a student">
          <form action={studentAction} className={styles.form}>
            <FormMessage state={studentState} />
            <NewAccounts accounts={studentState?.accounts ?? []} />
            <div className={styles.row}>
              <FormControl required>
                <FormControl.Label>First name</FormControl.Label>
                <TextInput name="firstName" block />
              </FormControl>
              <FormControl required>
                <FormControl.Label>Last name</FormControl.Label>
                <TextInput name="lastName" block />
              </FormControl>
            </div>
            <div className={styles.row}>
              <FormControl required>
                <FormControl.Label>Class</FormControl.Label>
                <Select name="className" block>
                  {classes.map((c) => (
                    <Select.Option key={c.id} value={c.name}>
                      {c.name}
                    </Select.Option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormControl.Label>House</FormControl.Label>
                <Select name="houseName" block>
                  <Select.Option value="">None</Select.Option>
                  {houses.map((h) => (
                    <Select.Option key={h} value={h}>
                      {h}
                    </Select.Option>
                  ))}
                </Select>
              </FormControl>
            </div>
            <FormControl required>
              <FormControl.Label>Parent or carer&apos;s name</FormControl.Label>
              <TextInput name="guardianName" block />
            </FormControl>
            <div className={styles.row}>
              <FormControl required>
                <FormControl.Label>Their email</FormControl.Label>
                <TextInput name="guardianEmail" type="email" block />
              </FormControl>
              <FormControl>
                <FormControl.Label>Relationship</FormControl.Label>
                <TextInput name="relationship" placeholder="Mother, Father, Carer…" block />
              </FormControl>
            </div>
            <details>
              <summary className={styles.muted} style={{ cursor: "pointer" }}>
                Add a second parent or carer
              </summary>
              <div className={styles.row} style={{ marginTop: 12 }}>
                <FormControl>
                  <FormControl.Label>Name</FormControl.Label>
                  <TextInput name="guardian2Name" block />
                </FormControl>
                <FormControl>
                  <FormControl.Label>Email</FormControl.Label>
                  <TextInput name="guardian2Email" type="email" block />
                </FormControl>
              </div>
            </details>
            <p className={styles.muted} style={{ margin: 0 }}>
              If a parent already has an account (e.g. a sibling is enrolled) the student is linked to it.
            </p>
            <div>
              <SubmitButton pendingLabel="Enrolling…">Enrol student</SubmitButton>
            </div>
          </form>
        </Card>

        <Card title="Add a staff member">
          <form action={staffAction} className={styles.form}>
            <FormMessage state={staffState} />
            <NewAccounts accounts={staffState?.accounts ?? []} />
            <FormControl required>
              <FormControl.Label>Name</FormControl.Label>
              <TextInput name="name" placeholder="e.g. Ms Jane Citizen" block />
            </FormControl>
            <FormControl required>
              <FormControl.Label>Email</FormControl.Label>
              <TextInput name="email" type="email" block />
            </FormControl>
            <FormControl>
              <FormControl.Label>Title</FormControl.Label>
              <TextInput name="title" placeholder="e.g. Year 4 teacher" block />
            </FormControl>
            <FormControl required>
              <FormControl.Label>Access</FormControl.Label>
              <Select name="role" block>
                <Select.Option value="staff">Staff — teaching and communication</Select.Option>
                <Select.Option value="admin">Admin — also settings, people and money</Select.Option>
              </Select>
            </FormControl>
            <div>
              <SubmitButton pendingLabel="Adding…">Add staff member</SubmitButton>
            </div>
          </form>
        </Card>
      </VStack>
    </div>
  );
}
