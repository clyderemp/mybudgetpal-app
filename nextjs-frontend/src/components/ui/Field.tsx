import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Shared control look: 36px, 6px radius, strong line border, accent focus ring. 16px text on phones (no iOS zoom). */
export const inputClasses =
  "h-9 w-full min-w-0 rounded-control border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-3 " +
  "transition-colors hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/25 md:text-sm";

export const labelClasses = "text-meta font-medium text-ink";

/** Label (above) + control + hint/error. Pass the control's id as htmlFor. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label?: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className={labelClasses}>
          {label}
          {required ? (
            <span className="text-ink-2" aria-hidden>
              {" "}
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-xs text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && rest.id ? `${rest.id}-error` : undefined}
        className={cn(inputClasses, className)}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && rest.id ? `${rest.id}-error` : undefined}
        className={cn(inputClasses, "h-auto min-h-18 py-2", className)}
        {...rest}
      />
    );
  },
);
