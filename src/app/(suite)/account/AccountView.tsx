"use client";

import { FormControl, TextInput } from "@primer/react";
import { useActionState } from "react";
import { changePassword } from "@/app/actions/auth";
import { FormMessage, PageTitle, SubmitButton } from "@/components/ui";
import { Card, InitialsAvatar, VStack } from "@/components/ui/Card";

const ROLE = { admin: "School admin", staff: "Staff", parent: "Parent / carer", student: "Student" } as const;

export function AccountView({
  name,
  email,
  role,
  schoolName,
  students,
}: {
  name: string;
  email: string;
  role: keyof typeof ROLE;
  schoolName: string;
  students: { id: string; name: string; detail: string }[];
}) {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <main id="main" style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
      <PageTitle title="Your account" description={`${ROLE[role]} at ${schoolName}`} />
      <VStack gap={16}>
        <Card title="Profile">
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <InitialsAvatar name={name} size={56} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 18 }}>{name}</div>
              <div style={{ color: "var(--fgColor-muted)" }}>{email}</div>
            </div>
          </div>
          <p style={{ color: "var(--fgColor-muted)", marginBottom: 0 }}>
            To change your name, email or phone number, please contact the school office.
          </p>
        </Card>

        {students.length > 0 ? (
          <Card title={role === "student" ? "Your enrolment" : "Your children"}>
            <VStack gap={12}>
              {students.map((s) => (
                <div key={s.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <InitialsAvatar name={s.name} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div style={{ color: "var(--fgColor-muted)", fontSize: 12 }}>{s.detail}</div>
                  </div>
                </div>
              ))}
            </VStack>
          </Card>
        ) : null}

        <Card title="Change password">
          <form action={action}>
            <VStack gap={16}>
              <FormMessage state={state} />
              <FormControl required>
                <FormControl.Label>Current password</FormControl.Label>
                <TextInput name="current" type="password" autoComplete="current-password" block />
              </FormControl>
              <FormControl required>
                <FormControl.Label>New password</FormControl.Label>
                <TextInput name="next" type="password" autoComplete="new-password" block minLength={10} />
                <FormControl.Caption>At least 10 characters. A short phrase is easy to remember.</FormControl.Caption>
              </FormControl>
              <div>
                <SubmitButton pendingLabel="Saving…">Update password</SubmitButton>
              </div>
            </VStack>
          </form>
        </Card>
      </VStack>
    </main>
  );
}
