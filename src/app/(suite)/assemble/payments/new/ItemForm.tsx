"use client";

import { Button, Checkbox, FormControl, Select, TextInput, Textarea } from "@primer/react";
import { AudienceSelect, ButtonLink, FormMessage, PageTitle, type AudienceOptionProps } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { ITEM_CATEGORIES, ITEM_CATEGORY_KEYS } from "@/lib/assemble/constants";
import shared from "../../_components/assemble.module.css";
import { useFormAction } from "../../_components/useFormAction";
import { createItem } from "../actions";

export function ItemForm({
  audienceOptions,
  events,
  minDate,
  defaultEventId,
}: {
  audienceOptions: AudienceOptionProps[];
  events: { id: string; label: string }[];
  minDate: string;
  defaultEventId: string;
}) {
  const { state, pending, onSubmit, error } = useFormAction(createItem);
  const err = (name: string) =>
    error(name) ? <FormControl.Validation variant="error">{error(name)}</FormControl.Validation> : null;
  return (
    <div className={shared.stack}>
      <PageTitle
        back={{ href: "/assemble/payments", label: "Forms & payments" }}
        title="New form or payment"
        description="Every student in the group gets their own line, so families can give permission and pay for each child."
      />
      <Card>
        <form onSubmit={onSubmit} className={shared.form} noValidate>
          <FormMessage state={state} />
          <FormControl required>
            <FormControl.Label>Title</FormControl.Label>
            <TextInput name="title" block maxLength={140} placeholder="e.g. Year 2 excursion — Melbourne Zoo" />
            {err("title")}
          </FormControl>
          <FormControl>
            <FormControl.Label>Details for families (optional)</FormControl.Label>
            <Textarea name="description" block rows={4} resize="vertical" placeholder="What it's for, what to bring, what the cost covers." />
            {err("description")}
          </FormControl>
          <div className={shared.formRow}>
            <FormControl>
              <FormControl.Label>Category</FormControl.Label>
              <Select name="category" defaultValue="excursion" block>
                {ITEM_CATEGORY_KEYS.map((c) => (
                  <Select.Option key={c} value={c}>
                    {ITEM_CATEGORIES[c].label}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
            <AudienceSelect options={audienceOptions} includeStaff={false} label="Which students?" defaultValue="school" />
          </div>
          <div className={shared.formRow}>
            <FormControl>
              <FormControl.Label>Amount per student</FormControl.Label>
              <TextInput name="amount" inputMode="decimal" leadingVisual="$" placeholder="0.00" block />
              {err("amount") ?? <FormControl.Caption>Leave blank or 0 for a consent-only form.</FormControl.Caption>}
            </FormControl>
            <FormControl>
              <FormControl.Label>Due date (optional)</FormControl.Label>
              <TextInput name="dueOn" type="date" min={minDate} block />
              {err("dueOn")}
            </FormControl>
          </div>
          <FormControl>
            <Checkbox name="requiresConsent" defaultChecked />
            <FormControl.Label>Families need to give permission</FormControl.Label>
            <FormControl.Caption>Parents and carers tap “Yes, I give permission” or “No” for each child.</FormControl.Caption>
          </FormControl>
          {events.length ? (
            <FormControl>
              <FormControl.Label>Linked calendar event (optional)</FormControl.Label>
              <Select name="eventId" defaultValue={defaultEventId} block>
                <Select.Option value="">None</Select.Option>
                {events.map((e) => (
                  <Select.Option key={e.id} value={e.id}>
                    {e.label}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
          ) : null}
          <div className={shared.formActions}>
            <Button type="submit" variant="primary" loading={pending}>
              Create and send to families
            </Button>
            <ButtonLink href="/assemble/payments" variant="invisible">
              Cancel
            </ButtonLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
