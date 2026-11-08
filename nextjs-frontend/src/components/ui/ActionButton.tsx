"use client";
import { forwardRef, useState, type MouseEvent } from "react";
import { Button, type ButtonProps } from "./Button";
import { notify } from "./notify";

export interface ActionButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Async handler. Button disables + shows a spinner (aria-busy) until it settles. */
  onAction: (e: MouseEvent<HTMLButtonElement>) => Promise<unknown> | unknown;
  /** Toast on success (optional). */
  successMessage?: string;
  /** Toast title on failure. Errors are toasted automatically unless set to false. */
  errorMessage?: string | false;
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  { onAction, successMessage, errorMessage, loading, ...rest },
  ref,
) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      ref={ref}
      {...rest}
      loading={pending || loading}
      onClick={async (e) => {
        if (pending) return;
        setPending(true);
        try {
          await onAction(e);
          if (successMessage) notify.success(successMessage);
        } catch (err) {
          if (errorMessage !== false) notify.error(err, errorMessage || "Action failed");
        } finally {
          setPending(false);
        }
      }}
    />
  );
});
