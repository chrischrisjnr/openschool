"use client";

import { SearchIcon } from "@primer/octicons-react";
import { FormControl, TextInput, Token } from "@primer/react";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { InitialsAvatar } from "@/components/ui/Card";
import type { FormState } from "@/lib/form";
import type { PersonDTO } from "@/lib/quad/types";
import { RoleBadge } from "./chat/MessageItem";
import styles from "./quad.module.css";

export type PickerPerson = PersonDTO & { detail: string | null };

/**
 * Search-as-you-type list of people with checkboxes. Submits the chosen
 * ids as repeated `name` fields to a server action.
 */
export function PeoplePicker({
  people,
  action,
  name,
  max,
  submitLabel,
  label,
  hidden,
  initial = [],
}: {
  people: PickerPerson[];
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  name: string;
  max: number;
  submitLabel: string;
  label: string;
  hidden?: ReactNode;
  initial?: string[];
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string[]>(initial);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? people.filter((p) => `${p.name} ${p.detail ?? ""} ${p.badge ?? ""}`.toLowerCase().includes(q))
      : people;
    return list.slice(0, 80);
  }, [people, query]);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const toggle = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= max ? c : [...c, id]));

  return (
    <form action={formAction} className={styles.picker}>
      {hidden}
      <FormMessage state={state} />
      <FormControl>
        <FormControl.Label>{label}</FormControl.Label>
        <TextInput
          leadingVisual={SearchIcon}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, class or child's name"
          block
          size="large"
          autoComplete="off"
        />
      </FormControl>

      {chosen.length ? (
        <div className={styles.chosen} aria-label="Chosen people">
          {chosen.map((id) => (
            <Token
              key={id}
              text={byId.get(id)?.name ?? "Someone"}
              onRemove={() => toggle(id)}
              size="large"
            />
          ))}
        </div>
      ) : null}
      {chosen.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <ul className={styles.peopleList} aria-label="People">
        {shown.length === 0 ? (
          <li className={styles.person}>
            <span className={styles.muted}>No one matches “{query}”.</span>
          </li>
        ) : (
          shown.map((p) => {
            const checked = chosen.includes(p.id);
            return (
              <li key={p.id}>
                <label className={styles.person}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.id)}
                    disabled={!checked && chosen.length >= max}
                  />
                  <InitialsAvatar name={p.name} size={32} />
                  <span className={styles.personText}>
                    <span className={styles.personName}>
                      {p.name} <RoleBadge badge={p.badge} />
                    </span>
                    {p.detail ? <span className={styles.personDetail}>{p.detail}</span> : null}
                  </span>
                </label>
              </li>
            );
          })
        )}
      </ul>

      <div className={styles.pickerFooter}>
        <span className={styles.muted}>
          {chosen.length === 0
            ? "Choose one person, or a few for a small group chat."
            : chosen.length >= max
              ? `That's the most for one conversation (${max}).`
              : `${chosen.length} chosen`}
        </span>
        <SubmitButton disabled={!chosen.length} pendingLabel="Opening…">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

