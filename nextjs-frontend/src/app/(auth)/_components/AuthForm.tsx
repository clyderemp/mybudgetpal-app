import type { ReactNode } from "react";

/** Heading + body + footer links for an auth form (sits inside the auth layout's form panel). */
export function AuthForm({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div>
      <h1 className="text-title font-semibold text-ink">{title}</h1>
      {description ? <p className="mt-1 text-meta text-ink-2">{description}</p> : null}
      <div className="mt-6">{children}</div>
      {footer ? <div className="mt-6 border-t border-line pt-4 text-meta text-ink-2">{footer}</div> : null}
    </div>
  );
}

/** Form-level error: what happened and how to fix it. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-meta text-danger">
      {message}
    </p>
  );
}

export const authLinkClass = "font-medium text-accent underline-offset-2 hover:underline";
