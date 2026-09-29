"use client";

import { startTransition, useActionState } from "react";
import type { FormState } from "@/app/actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/**
 * Like useActionState, but submitting doesn't clear the form, so a typo in one
 * field (e.g. the invite code) doesn't wipe everything else the user typed.
 */
export function useKeepValuesAction(action: Action) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>, confirm?: string) => {
    e.preventDefault();
    if (confirm && !window.confirm(confirm)) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };
  return { state, pending, onSubmit };
}

/** A small form wrapper that shows the action's error/success message. */
export function ActionForm({
  action,
  children,
  className,
  confirm,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
}) {
  const { state, pending, onSubmit } = useKeepValuesAction(action);
  return (
    <form className={className} onSubmit={(e) => onSubmit(e, confirm)}>
      <fieldset disabled={pending}>{children}</fieldset>
      {state?.error && <p className="msg error">{state.error}</p>}
      {state?.ok && <p className="msg ok">{state.ok}</p>}
    </form>
  );
}
