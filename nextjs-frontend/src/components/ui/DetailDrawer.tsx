"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { overlayClass } from "./FormDialog";

export interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Footer actions (Edit, Archive...). */
  actions?: ReactNode;
  className?: string;
}

/** Right-side record panel, 440px (full screen on phones). Use for viewing a record. */
export function DetailDrawer({ open, onOpenChange, title, description, children, actions, className }: DetailDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-[100dvh] w-full flex-col bg-surface text-ink focus:outline-none",
            "md:max-w-[440px] md:border-l md:border-line md:shadow-pop",
            className,
          )}
        >
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-6">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-semibold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 text-meta text-ink-2">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close" className="-mr-1.5">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6">{children}</div>
          {actions ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
              {actions}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Label/value row for drawer bodies (wrap rows in <dl>). */
export function DetailRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-10 items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-meta text-ink-2">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium break-words text-ink">{children}</dd>
    </div>
  );
}
