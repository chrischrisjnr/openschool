"use client";

import { FormControl, Select, TextInput } from "@primer/react";
import { useActionState } from "react";
import { SuiteMark } from "@/components/shell/ProductMark";
import { FormMessage, SubmitButton } from "@/components/ui";
import styles from "../login/login.module.css";
import { setupSchool } from "./actions";

const STATES = ["VIC", "NSW", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

export function SetupView() {
  const [state, action] = useActionState(setupSchool, undefined);
  return (
    <main id="main" className={styles.page}>
      <div className={styles.panel} style={{ maxWidth: 520 }}>
        <div className={styles.brand}>
          <SuiteMark size={40} />
          <div>
            <h1 className={styles.title}>Welcome to Open Schools</h1>
            <p className={styles.tagline}>Let&apos;s set up your school. This takes about a minute.</p>
          </div>
        </div>
        <form action={action} className={styles.form} style={{ marginTop: 24 }}>
          <FormMessage state={state} />
          <FormControl required>
            <FormControl.Label>School name</FormControl.Label>
            <TextInput name="schoolName" placeholder="e.g. Wattle Creek Primary School" block size="large" />
          </FormControl>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <FormControl>
              <FormControl.Label>Suburb</FormControl.Label>
              <TextInput name="suburb" block />
            </FormControl>
            <FormControl required>
              <FormControl.Label>State</FormControl.Label>
              <Select name="state" block defaultValue="VIC">
                {STATES.map((s) => (
                  <Select.Option key={s} value={s}>
                    {s}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
          </div>
          <hr style={{ border: 0, borderTop: "1px solid var(--borderColor-muted)", width: "100%" }} />
          <p className={styles.help} style={{ textAlign: "left" }}>
            Now create your own administrator account. You can add other staff later.
          </p>
          <FormControl required>
            <FormControl.Label>Your name</FormControl.Label>
            <TextInput name="name" autoComplete="name" block />
          </FormControl>
          <FormControl required>
            <FormControl.Label>Your email</FormControl.Label>
            <TextInput name="email" type="email" autoComplete="email" block />
          </FormControl>
          <FormControl required>
            <FormControl.Label>Choose a password</FormControl.Label>
            <TextInput name="password" type="password" autoComplete="new-password" minLength={10} block />
            <FormControl.Caption>At least 10 characters.</FormControl.Caption>
          </FormControl>
          <SubmitButton block size="large" pendingLabel="Setting up…">
            Create my school
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
