"use client";

import { Button, Checkbox, FormControl, Select, TextInput, Textarea } from "@primer/react";
import { useState } from "react";
import { AudienceSelect, ButtonLink, FormMessage, PageTitle, type AudienceOptionProps } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { EVENT_CATEGORIES, EVENT_CATEGORY_KEYS } from "@/lib/assemble/constants";
import shared from "../_components/assemble.module.css";
import { useFormAction } from "../_components/useFormAction";
import { saveEvent } from "./actions";

export type EventFormValues = {
  id?: string;
  title: string;
  description: string;
  location: string;
  category: string;
  audience: string;
  date: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
};

export function EventForm({ values, audienceOptions }: { values: EventFormValues; audienceOptions: AudienceOptionProps[] }) {
  const { state, pending, onSubmit, error } = useFormAction(saveEvent);
  const [allDay, setAllDay] = useState(values.allDay);
  const editing = !!values.id;
  const cancelHref = editing ? `/assemble/calendar/${values.id}` : "/assemble/calendar";
  const err = (name: string) =>
    error(name) ? <FormControl.Validation variant="error">{error(name)}</FormControl.Validation> : null;

  return (
    <div className={shared.stack}>
      <PageTitle
        back={{ href: cancelHref, label: editing ? "Back to event" : "Calendar" }}
        title={editing ? "Edit event" : "New event"}
        description="Events appear on the calendar for the people you choose."
      />
      <Card>
        <form onSubmit={onSubmit} className={shared.form} noValidate>
          {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
          <FormMessage state={state} />
          <FormControl required>
            <FormControl.Label>Title</FormControl.Label>
            <TextInput name="title" defaultValue={values.title} block maxLength={140} placeholder="e.g. Christmas concert" />
            {err("title")}
          </FormControl>
          <div className={shared.formRow}>
            <FormControl>
              <FormControl.Label>Category</FormControl.Label>
              <Select name="category" defaultValue={values.category} block>
                {EVENT_CATEGORY_KEYS.map((c) => (
                  <Select.Option key={c} value={c}>
                    {EVENT_CATEGORIES[c].label}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
            <AudienceSelect options={audienceOptions} defaultValue={values.audience} label="Who is it for?" />
          </div>
          <div className={shared.formRow}>
            <FormControl required>
              <FormControl.Label>Date</FormControl.Label>
              <TextInput name="date" type="date" defaultValue={values.date} block />
              {err("date")}
            </FormControl>
            <FormControl>
              <FormControl.Label>Ends on (optional)</FormControl.Label>
              <TextInput name="endDate" type="date" defaultValue={values.endDate} block />
              {err("endDate") ?? <FormControl.Caption>For events over several days.</FormControl.Caption>}
            </FormControl>
          </div>
          <FormControl>
            <Checkbox name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            <FormControl.Label>All day</FormControl.Label>
          </FormControl>
          {!allDay ? (
            <div className={shared.formRow}>
              <FormControl required>
                <FormControl.Label>Starts</FormControl.Label>
                <TextInput name="startTime" type="time" defaultValue={values.startTime} block />
                {err("startTime")}
              </FormControl>
              <FormControl required>
                <FormControl.Label>Finishes</FormControl.Label>
                <TextInput name="endTime" type="time" defaultValue={values.endTime} block />
                {err("endTime")}
              </FormControl>
            </div>
          ) : null}
          <FormControl>
            <FormControl.Label>Location (optional)</FormControl.Label>
            <TextInput name="location" defaultValue={values.location} block placeholder="e.g. School hall" />
            {err("location")}
          </FormControl>
          <FormControl>
            <FormControl.Label>Details (optional)</FormControl.Label>
            <Textarea name="description" defaultValue={values.description} block rows={5} resize="vertical" />
            {err("description")}
          </FormControl>
          <div className={shared.formActions}>
            <Button type="submit" variant="primary" loading={pending}>
              {editing ? "Save changes" : "Add to calendar"}
            </Button>
            <ButtonLink href={cancelHref} variant="invisible">
              Cancel
            </ButtonLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
