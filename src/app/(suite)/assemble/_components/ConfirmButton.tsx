"use client";

import { Button, ConfirmationDialog } from "@primer/react";
import { useRef, useState, type ComponentProps, type ReactNode } from "react";

/**
 * A form with hidden fields and a button that asks "Are you sure?" before
 * submitting to a server action. Used for deletes and other one-way actions.
 */
export function ConfirmButton({
  action,
  fields,
  children,
  title,
  body,
  confirmLabel,
  danger = true,
  ...buttonProps
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  children: ReactNode;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
} & Omit<ComponentProps<typeof Button>, "onClick" | "type" | "children">) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} onSubmit={() => setBusy(true)}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="button" variant={danger ? "danger" : "default"} {...buttonProps} onClick={() => setOpen(true)} loading={busy}>
        {children}
      </Button>
      {open ? (
        <ConfirmationDialog
          title={title}
          confirmButtonContent={confirmLabel}
          confirmButtonType={danger ? "danger" : "primary"}
          onClose={(gesture) => {
            setOpen(false);
            if (gesture === "confirm") form.current?.requestSubmit();
          }}
        >
          {body}
        </ConfirmationDialog>
      ) : null}
    </form>
  );
}
