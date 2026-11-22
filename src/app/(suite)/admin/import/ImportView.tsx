"use client";

import { Banner, FormControl, Textarea } from "@primer/react";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { Card, VStack } from "@/components/ui/Card";
import { importStudents } from "../actions";
import { NewAccounts } from "../NewAccounts";
import styles from "../admin.module.css";

const EXAMPLE = `first_name,last_name,class,house,guardian_name,guardian_email,guardian_relationship,guardian2_name,guardian2_email
Ruby,Tran,3A,Banksia,Linh Tran,linh.tran@example.com,Mother,,
Jack,O'Brien,FB,Waratah,Siobhan O'Brien,siobhan@example.com,Mother,Pat O'Brien,pat@example.com`;

export function ImportView() {
  const [state, action] = useActionState(importStudents, undefined);
  return (
    <div className={styles.twoCol}>
      <Card title="Import students and families from a spreadsheet">
        <form action={action} className={styles.form}>
          {state?.summary ? <Banner variant={state.ok ? "success" : "warning"} title="Import finished" description={state.summary} /> : null}
          {state?.error ? (
            <Banner variant="critical" title="Some rows need attention" description={<span className={styles.problems}>{state.error}</span>} />
          ) : null}
          <NewAccounts accounts={state?.accounts ?? []} />
          <FormControl>
            <FormControl.Label>CSV file</FormControl.Label>
            <input type="file" name="file" accept=".csv,text/csv" />
            <FormControl.Caption>
              Export from your student management system or Excel using &ldquo;Save as CSV&rdquo;.
            </FormControl.Caption>
          </FormControl>
          <FormControl>
            <FormControl.Label>…or paste CSV here</FormControl.Label>
            <Textarea name="csv" rows={8} block placeholder={EXAMPLE} />
          </FormControl>
          <div>
            <SubmitButton pendingLabel="Importing…">Import</SubmitButton>
          </div>
        </form>
      </Card>
      <Card title="What the file should look like">
        <VStack gap={12}>
          <p className={styles.muted} style={{ margin: 0 }}>
            One row per student. Column names aren&apos;t case-sensitive. Classes and houses that don&apos;t exist yet
            are created automatically (the year level is read from the class name, e.g. &ldquo;3B&rdquo; → Year 3,
            &ldquo;FA&rdquo; → Foundation). Parents who already have an account are linked, not duplicated.
          </p>
          <pre className={styles.pre}>{EXAMPLE}</pre>
          <p className={styles.muted} style={{ margin: 0 }}>
            Required: <b>first_name</b>, <b>last_name</b>, <b>class</b>, <b>guardian_name</b>, <b>guardian_email</b>.
          </p>
        </VStack>
      </Card>
    </div>
  );
}
