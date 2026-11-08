"use client";
import { forwardRef, useId, useState, type ReactNode } from "react";
import { filsToInput, parseToFils } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Field, inputClasses } from "./Field";

export interface MoneyInputProps {
  /** Value in integer fils (null = empty). */
  value: number | null | undefined;
  onChange: (fils: number | null) => void;
  onBlur?: () => void;
  currency?: string;
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  id?: string;
  name?: string;
  placeholder?: string;
  allowNegative?: boolean;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Amount input in AED that emits integer fils. Accepts "1,234.50".
 * Use with react-hook-form via <Controller/>; validate with z.number().int().positive().
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onChange, onBlur, currency = "AED", label, error, hint, id, name, placeholder = "0.00", allowNegative, disabled, required, autoFocus, className },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [text, setText] = useState(() => filsToInput(value ?? null));
  const [synced, setSynced] = useState<number | null | undefined>(value);

  // Derived-state sync: external value changed (e.g. form reset) → update text.
  if (value !== synced) {
    setSynced(value);
    if ((value ?? null) !== parseToFils(text)) setText(filsToInput(value ?? null));
  }

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={className}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-meta font-medium text-ink-2">
          {currency}
        </span>
        <input
          ref={ref}
          id={inputId}
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(inputClasses, "tabular pl-12 text-right")}
          value={text}
          onChange={(e) => {
            const raw = e.target.value;
            const allowed = allowNegative ? /^-?[\d,]*\.?\d{0,2}$/ : /^[\d,]*\.?\d{0,2}$/;
            if (raw !== "" && !allowed.test(raw)) return;
            setText(raw);
            const fils = parseToFils(raw);
            setSynced(fils);
            onChange(fils);
          }}
          onBlur={() => {
            const fils = parseToFils(text);
            setText(fils === null ? "" : filsToInput(fils));
            onBlur?.();
          }}
        />
      </div>
    </Field>
  );
});
