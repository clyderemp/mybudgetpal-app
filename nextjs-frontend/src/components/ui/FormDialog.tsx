"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Wraps body in a <form>. Use react-hook-form's handleSubmit(...) here. */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  /** Say exactly what happens: "Save budget", "Record payment". */
  submitLabel?: string;
  /** Disables + spinner on the submit button. */
  submitting?: boolean;
  submitDisabled?: boolean;
  submitVariant?: "primary" | "danger";
  cancelLabel?: string;
  /** Extra footer content on the left (e.g. a Delete button in edit mode). */
  footerStart?: ReactNode;
  /** Replace the whole footer. */
  footer?: ReactNode;
  /** Desktop width: sm 440px (confirmations), md 560px (default, 2-column forms), lg 720px. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const widths = { sm: "md:max-w-[440px]", md: "md:max-w-[560px]", lg: "md:max-w-[720px]" };

/** Shared dialog chrome classes (also used by the command palette). */
export const overlayClass = "fixed inset-0 z-50 bg-scrim";

/**
 * Modal form. Centered dialog ≥768px; full-height sheet on phones.
 * Header (title + close) and footer (Cancel + submit, right-aligned) stay fixed; body scrolls.
 * Lay fields out with `<FormGrid>` (2 columns on desktop) and labels above fields.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Save",
  submitting,
  submitDisabled,
  submitVariant = "primary",
  cancelLabel = "Cancel",
  footerStart,
  footer,
  size = "md",
  className,
}: FormDialogProps) {
  const body = (
    <>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-6">
        <div className="min-w-0">
          <Dialog.Title className="truncate text-base font-semibold text-ink">{title}</Dialog.Title>
          {description ? <Dialog.Description className="mt-0.5 text-meta text-ink-2">{description}</Dialog.Description> : null}
        </div>
        <Dialog.Close asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Close" className="-mr-1.5">
            <X />
          </Button>
        </Dialog.Close>
      </div>
      <div data-dialog-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 md:px-6">
        {children}
      </div>
      {footer !== undefined ? (
        footer
      ) : onSubmit ? (
        <div className="flex items-center gap-2 border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
          <div className="mr-auto">{footerStart}</div>
          <Dialog.Close asChild>
            <Button variant="secondary" disabled={submitting}>
              {cancelLabel}
            </Button>
          </Dialog.Close>
          <Button type="submit" variant={submitVariant} loading={submitting} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </div>
      ) : null}
    </>
  );

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          // No placeholder description: opt out of aria-describedby when none is given.
          {...(description ? {} : { "aria-describedby": undefined })}
          onOpenAutoFocus={(e) => {
            // Focus the first field (not the close button) so typing starts immediately.
            const first = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(
              "[data-dialog-body] input:not([type=hidden]):not([disabled]), [data-dialog-body] textarea:not([disabled])",
            );
            if (first) {
              e.preventDefault();
              first.focus();
            }
          }}
          className={cn(
            "fixed z-50 flex flex-col bg-surface text-ink focus:outline-none",
            "inset-0 h-[100dvh] w-full",
            "md:inset-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[min(88dvh,48rem)] md:w-[calc(100vw-2rem)] md:-translate-x-1/2 md:-translate-y-1/2",
            "md:rounded-container md:border md:border-line md:shadow-pop",
            widths[size],
            className,
          )}
        >
          {onSubmit ? (
            <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
              {body}
            </form>
          ) : (
            body
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Form layout: 1 column on phones, 2 on desktop. Use `className="md:col-span-2"` on full-width fields. */
export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2", className)}>{children}</div>;
}

/** Optional titled group inside a long form. */
export function FormSection({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("min-w-0 border-t border-line pt-4 first:border-t-0 first:pt-0", className)}>
      <legend className="float-left mb-3 w-full text-sm font-semibold text-ink">{title}</legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}
