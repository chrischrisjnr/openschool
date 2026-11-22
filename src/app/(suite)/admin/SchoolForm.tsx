"use client";

import { FormControl, Select, TextInput } from "@primer/react";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { updateSchool } from "./actions";
import styles from "./admin.module.css";

const STATES = [
  ["VIC", "Victoria"],
  ["NSW", "New South Wales"],
  ["QLD", "Queensland"],
  ["WA", "Western Australia"],
  ["SA", "South Australia"],
  ["TAS", "Tasmania"],
  ["ACT", "Australian Capital Territory"],
  ["NT", "Northern Territory"],
] as const;

type School = { name: string; shortName: string; suburb: string; state: string; phone: string; email: string; abn: string };

export function SchoolForm({ school }: { school: School }) {
  const [state, action] = useActionState(updateSchool, undefined);
  const err = (k: string) => state?.fieldErrors?.[k];
  return (
    <Card title="School details">
      <form action={action} className={styles.form}>
        <FormMessage state={state} />
        <div className={styles.row}>
          <FormControl required>
            <FormControl.Label>School name</FormControl.Label>
            <TextInput name="name" defaultValue={school.name} block />
            {err("name") ? <FormControl.Validation variant="error">{err("name")}</FormControl.Validation> : null}
          </FormControl>
          <FormControl required>
            <FormControl.Label>Short name</FormControl.Label>
            <TextInput name="shortName" defaultValue={school.shortName} block />
            <FormControl.Caption>Used where space is tight, e.g. &ldquo;Wattle Creek PS&rdquo;.</FormControl.Caption>
          </FormControl>
        </div>
        <div className={styles.row}>
          <FormControl>
            <FormControl.Label>Suburb</FormControl.Label>
            <TextInput name="suburb" defaultValue={school.suburb} block />
          </FormControl>
          <FormControl required>
            <FormControl.Label>State or territory</FormControl.Label>
            <Select name="state" defaultValue={school.state} block>
              {STATES.map(([v, l]) => (
                <Select.Option key={v} value={v}>
                  {l}
                </Select.Option>
              ))}
            </Select>
            <FormControl.Caption>Sets the time zone and year-level names (e.g. Prep vs Foundation).</FormControl.Caption>
          </FormControl>
        </div>
        <div className={styles.row}>
          <FormControl>
            <FormControl.Label>Office phone</FormControl.Label>
            <TextInput name="phone" type="tel" defaultValue={school.phone} block />
          </FormControl>
          <FormControl>
            <FormControl.Label>Office email</FormControl.Label>
            <TextInput name="email" type="email" defaultValue={school.email} block />
          </FormControl>
          <FormControl>
            <FormControl.Label>ABN</FormControl.Label>
            <TextInput name="abn" defaultValue={school.abn} block />
            <FormControl.Caption>Printed on payment receipts.</FormControl.Caption>
          </FormControl>
        </div>
        <div>
          <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
