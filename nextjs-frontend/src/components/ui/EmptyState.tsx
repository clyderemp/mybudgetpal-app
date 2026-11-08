import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Quiet empty state: say what's missing and what to do next (one action). */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-4 py-10 text-center", className)}>
      <div className="flex size-10 items-center justify-center rounded-container border border-line bg-surface-2 text-ink-2">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="max-w-sm">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? <p className="mt-1 text-meta text-ink-2">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
