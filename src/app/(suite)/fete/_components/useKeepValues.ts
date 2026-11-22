"use client";

import { startTransition, type FormEvent } from "react";

/**
 * React 19 resets a <form action={…}> after every submission, which wipes
 * what people typed when the server sends back a validation error. Submitting
 * through onSubmit keeps the values (and still works with useActionState).
 */
export function keepValuesOnSubmit(dispatch: (data: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
}
