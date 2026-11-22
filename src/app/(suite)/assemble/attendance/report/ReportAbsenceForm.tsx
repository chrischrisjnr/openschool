"use client";

import { Button, FormControl, Radio, RadioGroup, Select, TextInput, Textarea } from "@primer/react";
import { ButtonLink, FormMessage, PageTitle } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { ABSENCE_REASONS, ABSENCE_REASON_KEYS } from "@/lib/assemble/constants";
import shared from "../../_components/assemble.module.css";
import { useFormAction } from "../../_components/useFormAction";
import { reportAbsence } from "../actions";

export function ReportAbsenceForm({
  kids,
  studentId,
  date,
}: {
  kids: { id: string; name: string; className: string | null }[];
  studentId: string;
  date: string;
}) {
  const { state, pending, onSubmit, error } = useFormAction(reportAbsence);
  const err = (name: string) =>
    error(name) ? <FormControl.Validation variant="error">{error(name)}</FormControl.Validation> : null;
  return (
    <div className={`${shared.stack} ${shared.narrow}`}>
      <PageTitle
        back={{ href: "/assemble/attendance", label: "Attendance" }}
        title="Report an absence"
        description="Let the school know your child will be (or was) away. Their teacher sees it straight away."
      />
      <Card>
        <form onSubmit={onSubmit} className={shared.form} noValidate>
          <FormMessage state={state} />
          {kids.length > 1 ? (
            <RadioGroup name="studentId" required>
              <RadioGroup.Label>Who will be away?</RadioGroup.Label>
              {kids.map((k) => (
                <FormControl key={k.id}>
                  <Radio value={k.id} defaultChecked={k.id === studentId} />
                  <FormControl.Label>
                    {k.name}
                    {k.className ? ` · ${k.className}` : ""}
                  </FormControl.Label>
                </FormControl>
              ))}
            </RadioGroup>
          ) : (
            <input type="hidden" name="studentId" value={kids[0]!.id} />
          )}
          <div className={shared.formRow}>
            <FormControl required>
              <FormControl.Label>First day away</FormControl.Label>
              <TextInput name="fromDate" type="date" defaultValue={date} block />
              {err("fromDate")}
            </FormControl>
            <FormControl>
              <FormControl.Label>Last day away</FormControl.Label>
              <TextInput name="toDate" type="date" block />
              {err("toDate") ?? <FormControl.Caption>Leave blank for a single day.</FormControl.Caption>}
            </FormControl>
          </div>
          <FormControl required>
            <FormControl.Label>Reason</FormControl.Label>
            <Select name="reason" defaultValue="illness" block>
              {ABSENCE_REASON_KEYS.map((r) => (
                <Select.Option key={r} value={r}>
                  {ABSENCE_REASONS[r]}
                </Select.Option>
              ))}
            </Select>
            {err("reason")}
          </FormControl>
          <FormControl>
            <FormControl.Label>Note for the teacher (optional)</FormControl.Label>
            <Textarea name="note" block rows={3} resize="vertical" placeholder="e.g. Temperature overnight — keeping her home to rest." />
            {err("note")}
          </FormControl>
          <div className={shared.formActions}>
            <Button type="submit" variant="primary" loading={pending}>
              Send to school
            </Button>
            <ButtonLink href="/assemble/attendance" variant="invisible">
              Cancel
            </ButtonLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
