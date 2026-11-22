"use client";

import { Button, Checkbox, FormControl, Select, TextInput, Textarea } from "@primer/react";
import { AudienceSelect, ButtonLink, FormMessage, PageTitle, type AudienceOptionProps } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { NOTICE_CATEGORIES, NOTICE_CATEGORY_KEYS } from "@/lib/assemble/constants";
import shared from "../_components/assemble.module.css";
import { useFormAction } from "../_components/useFormAction";
import { saveNotice } from "./actions";

export type NoticeFormValues = {
  id?: string;
  title: string;
  body: string;
  category: string;
  audience: string;
  pinned: boolean;
  requiresAck: boolean;
  expiresOn: string;
};

export function NoticeForm({
  values,
  audienceOptions,
  minDate,
}: {
  values: NoticeFormValues;
  audienceOptions: AudienceOptionProps[];
  minDate: string;
}) {
  const { state, pending, onSubmit, error } = useFormAction(saveNotice);
  const editing = !!values.id;
  const cancelHref = editing ? `/assemble/notices/${values.id}` : "/assemble/notices";
  return (
    <div className={shared.stack}>
      <PageTitle
        back={{ href: cancelHref, label: editing ? "Back to notice" : "All notices" }}
        title={editing ? "Edit notice" : "New notice"}
        description={editing ? "Changes appear straight away. Read receipts are kept." : "Share news with families. It appears in their Assemble feed straight away."}
      />
      <Card>
        <form onSubmit={onSubmit} className={shared.form} noValidate>
          {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
          <FormMessage state={state} />
          <FormControl required>
            <FormControl.Label>Title</FormControl.Label>
            <TextInput name="title" defaultValue={values.title} block maxLength={140} placeholder="e.g. Sun smart: hats from 1 September" />
            {error("title") ? <FormControl.Validation variant="error">{error("title")}</FormControl.Validation> : null}
          </FormControl>
          <FormControl required>
            <FormControl.Label>Message</FormControl.Label>
            <Textarea name="body" defaultValue={values.body} block rows={10} resize="vertical" />
            {error("body") ? (
              <FormControl.Validation variant="error">{error("body")}</FormControl.Validation>
            ) : (
              <FormControl.Caption>Plain text. Leave a blank line between paragraphs.</FormControl.Caption>
            )}
          </FormControl>
          <div className={shared.formRow}>
            <FormControl>
              <FormControl.Label>Category</FormControl.Label>
              <Select name="category" defaultValue={values.category} block>
                {NOTICE_CATEGORY_KEYS.map((c) => (
                  <Select.Option key={c} value={c}>
                    {NOTICE_CATEGORIES[c].label}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
            <AudienceSelect options={audienceOptions} defaultValue={values.audience} label="Who is it for?" />
          </div>
          <FormControl>
            <FormControl.Label>Hide after (optional)</FormControl.Label>
            <TextInput name="expiresOn" type="date" defaultValue={values.expiresOn} min={minDate} />
            {error("expiresOn") ? (
              <FormControl.Validation variant="error">{error("expiresOn")}</FormControl.Validation>
            ) : (
              <FormControl.Caption>Families stop seeing the notice after this day. Staff can still find it.</FormControl.Caption>
            )}
          </FormControl>
          <fieldset className={shared.fieldset}>
            <div className={shared.checks}>
              <FormControl>
                <Checkbox name="pinned" defaultChecked={values.pinned} />
                <FormControl.Label>Pin to the top</FormControl.Label>
                <FormControl.Caption>For important notices that should stay visible.</FormControl.Caption>
              </FormControl>
              <FormControl>
                <Checkbox name="requiresAck" defaultChecked={values.requiresAck} />
                <FormControl.Label>Ask families to acknowledge</FormControl.Label>
                <FormControl.Caption>Families tap “I&apos;ve read this” and you can see who hasn&apos;t.</FormControl.Caption>
              </FormControl>
            </div>
          </fieldset>
          <div className={shared.formActions}>
            <Button type="submit" variant="primary" loading={pending}>
              {editing ? "Save changes" : "Post notice"}
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
