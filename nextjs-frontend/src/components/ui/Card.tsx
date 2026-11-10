import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Panel = the standard container: surface + 1px line border, 8px radius, no shadow.
 * Optional header row (title, description, actions) separated by a rule.
 */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  flush = false,
  as: Tag = "section",
  ...rest
}: Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** No body padding (tables, lists that run edge to edge). */
  flush?: boolean;
  bodyClassName?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={cn("min-w-0 rounded-container border border-line bg-surface", className)} {...rest}>
      {title || actions ? <PanelHeader title={title} description={description} actions={actions} /> : null}
      <div className={cn(!flush && "p-4 md:p-5", bodyClassName)}>{children}</div>
    </Tag>
  );
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-12 items-center justify-between gap-3 border-b border-line px-4 py-2.5 md:px-5", className)}>
      <div className="min-w-0">
        {title ? <h2 className="truncate text-sm font-semibold text-ink">{title}</h2> : null}
        {description ? <p className="text-pretty text-meta text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Legacy container (same look as Panel without a header). Prefer <Panel>. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 rounded-container border border-line bg-surface", className)} {...rest} />;
}

/** Legacy header for <Card>. Prefer <Panel title actions>. */
export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return <PanelHeader title={title} description={description} actions={action} className={className} />;
}

export function CardContent({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 md:p-5", className)} {...rest} />;
}
