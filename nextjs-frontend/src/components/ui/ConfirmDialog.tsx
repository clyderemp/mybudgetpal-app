"use client";
import { useState, type ReactNode } from "react";
import { FormDialog } from "./FormDialog";
import { notify } from "./notify";

/** Confirmation for destructive actions (archive, delete). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  danger = true,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown> | unknown;
}) {
  const [pending, setPending] = useState(false);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      submitLabel={confirmLabel}
      submitVariant={danger ? "danger" : "primary"}
      submitting={pending}
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await onConfirm();
          onOpenChange(false);
        } catch (err) {
          notify.error(err);
        } finally {
          setPending(false);
        }
      }}
    >
      {description ? <p className="text-sm text-ink-2">{description}</p> : null}
    </FormDialog>
  );
}
