"use client";
import { forwardRef, useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Field, inputClasses } from "./Field";

export interface DateFieldProps {
  /** "YYYY-MM-DD" or null. */
  value: string | null | undefined;
  onChange: (date: string | null) => void;
  onBlur?: () => void;
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * Calendar date input (native picker — best on phones and safe inside Radix dialogs).
 * Emits "YYYY-MM-DD" strings. For month-only pickers use <input type="month">.
 */
export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(function DateField(
  { value, onChange, onBlur, label, error, hint, id, name, min, max, disabled, required, className },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={className}>
      <input
        ref={ref}
        id={inputId}
        name={name}
        type="date"
        min={min}
        max={max}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(inputClasses, "tabular appearance-none")}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        onBlur={onBlur}
      />
    </Field>
  );
});
