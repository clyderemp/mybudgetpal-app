import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** First element of every page (sits under the top bar breadcrumbs). 20px/600 title. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="text-title font-semibold text-ink">{title}</h1>
        {description ? <p className="mt-0.5 text-meta text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
