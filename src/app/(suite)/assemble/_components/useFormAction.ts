"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { FormState } from "@/lib/form";

/**
 * useActionState for forms that should keep what the person typed when the
 * server returns a validation error. (A plain `<form action>` resets its
 * fields after every submission in React 19.)
 */
export function useFormAction(action: (prev: FormState, formData: FormData) => Promise<FormState>) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  const error = (name: string) => state?.fieldErrors?.[name];
  return { state, pending, onSubmit, error };
}
