/**
 * The return type for server actions used with React's useActionState.
 * Keep messages friendly — they are shown directly to families.
 */
export type FormState =
  | {
      error?: string;
      /** Per-field errors keyed by input name. */
      fieldErrors?: Record<string, string>;
      ok?: boolean;
      message?: string;
    }
  | undefined;

/** Turns a zod error into FormState with the first message per field. */
export function zodToFormState(error: { issues: { path: PropertyKey[]; message: string }[] }): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: error.issues[0]?.message ?? "Please check the form.", fieldErrors };
}
