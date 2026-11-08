"use client";
import * as Toast from "@radix-ui/react-toast";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { dismissToast, subscribeToasts, type ToastItem } from "./notify";

const icons = { success: CheckCircle2, error: XCircle, info: Info };

/** Radix Toast provider + viewport. Mounted once in AppProviders. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setItems), []);

  return (
    <Toast.Provider swipeDirection="right" duration={4000}>
      {items.map((t) => {
        const Icon = icons[t.variant];
        return (
          <Toast.Root
            key={t.id}
            duration={t.duration}
            onOpenChange={(open) => {
              if (!open) dismissToast(t.id);
            }}
            className={cn(
              "pointer-events-auto flex w-full items-start gap-3 rounded-container border border-l-4 bg-surface p-3 pr-2 shadow-pop",
              "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=end]:translate-x-full data-[state=closed]:opacity-0 transition-[opacity,transform]",
              t.variant === "error" ? "border-line border-l-danger" : t.variant === "success" ? "border-line border-l-accent" : "border-line border-l-ink-3",
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                "mt-0.5 size-4 shrink-0",
                t.variant === "success" && "text-accent",
                t.variant === "error" && "text-danger",
                t.variant === "info" && "text-ink-2",
              )}
            />
            <div className="min-w-0 flex-1">
              <Toast.Title className="text-sm font-semibold text-ink">{t.title}</Toast.Title>
              {t.description ? (
                <Toast.Description className="mt-0.5 text-meta break-words text-ink-2">{t.description}</Toast.Description>
              ) : null}
            </div>
            <Toast.Close aria-label="Dismiss" className="rounded-chip p-1 text-ink-2 hover:bg-surface-2 hover:text-ink">
              <X className="size-4" aria-hidden />
            </Toast.Close>
          </Toast.Root>
        );
      })}
      <Toast.Viewport className="pointer-events-none fixed inset-x-0 top-0 z-[100] mx-auto flex max-h-screen w-full flex-col gap-2 p-4 sm:inset-x-auto sm:right-0 sm:bottom-0 sm:top-auto sm:max-w-sm" />
    </Toast.Provider>
  );
}
