"use client";

/**
 * Small shared building blocks on top of Primer React, used by every app.
 * They are client components, so they can be rendered from server pages
 * with plain (serialisable) props.
 */
import { Banner, Button, LinkButton, Select, FormControl } from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import NextLink from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { icons, type IconName } from "@/components/icons";
import type { FormState } from "@/lib/form";
import styles from "./ui.module.css";

/* ---------- Page title ---------- */

export function PageTitle({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className={styles.pageTitle}>
      {back ? (
        <NextLink href={back.href} className={styles.back}>
          ← {back.label}
        </NextLink>
      ) : null}
      <div className={styles.pageTitleRow}>
        <div className={styles.pageTitleText}>
          <h1 className={styles.h1}>{title}</h1>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </div>
  );
}

/* ---------- Links styled as buttons ---------- */

export function ButtonLink({
  href,
  leadingIcon,
  ...props
}: Omit<ComponentProps<typeof LinkButton>, "as" | "leadingVisual" | "href"> & {
  href: string;
  leadingIcon?: IconName;
}) {
  return (
    <LinkButton as={NextLink} href={href} leadingVisual={leadingIcon ? icons[leadingIcon] : undefined} {...props} />
  );
}

/* ---------- Empty states ---------- */

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: { href: string; label: string };
}) {
  const Icon = icons[icon];
  return (
    <div className={styles.empty}>
      <Blankslate spacious>
        <Blankslate.Visual>
          <Icon size="medium" />
        </Blankslate.Visual>
        <Blankslate.Heading>{title}</Blankslate.Heading>
        {description ? <Blankslate.Description>{description}</Blankslate.Description> : null}
        {action ? <Blankslate.PrimaryAction href={action.href}>{action.label}</Blankslate.PrimaryAction> : null}
      </Blankslate>
    </div>
  );
}

/* ---------- Forms ---------- */

/** Submit button that shows a busy state while the server action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: Omit<ComponentProps<typeof Button>, "type"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/** Shows the error / success message returned from a server action. */
export function FormMessage({ state }: { state: FormState }) {
  if (state?.error) {
    return <Banner variant="critical" title="Something needs fixing" description={state.error} hideTitle />;
  }
  if (state?.ok && state.message) {
    return <Banner variant="success" title="Done" description={state.message} hideTitle />;
  }
  return null;
}

export type AudienceOptionProps = { value: string; label: string; group: string };

/** Who should see this? Grouped select for audiences (see lib/audience.ts). */
export function AudienceSelect({
  options,
  name = "audience",
  defaultValue = "school",
  label = "Who is this for?",
  caption,
  includeStaff = true,
}: {
  options: AudienceOptionProps[];
  name?: string;
  defaultValue?: string;
  label?: string;
  caption?: string;
  includeStaff?: boolean;
}) {
  const visible = includeStaff ? options : options.filter((o) => o.value !== "staff");
  const groups = [...new Set(visible.map((o) => o.group))];
  return (
    <FormControl>
      <FormControl.Label>{label}</FormControl.Label>
      <Select name={name} defaultValue={defaultValue} block>
        {groups.map((g) => (
          <Select.OptGroup key={g} label={g}>
            {visible
              .filter((o) => o.group === g)
              .map((o) => (
                <Select.Option key={o.value} value={o.value}>
                  {o.label}
                </Select.Option>
              ))}
          </Select.OptGroup>
        ))}
      </Select>
      {caption ? <FormControl.Caption>{caption}</FormControl.Caption> : null}
    </FormControl>
  );
}
