import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

/**
 * primary = ink (the main action, one per view) · secondary = outline · ghost = toolbar/icon ·
 * danger = destructive. "outline" is kept as an alias of secondary.
 */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  fullWidth?: boolean;
}

const outline = "border border-line-strong bg-surface text-ink hover:bg-surface-2 active:bg-line";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-ink-fg hover:bg-ink/90 active:bg-ink/80",
  secondary: outline,
  outline,
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-line",
  danger: "bg-danger text-danger-fg hover:bg-danger/90 active:bg-danger/80",
  accent: "bg-accent text-accent-fg hover:bg-accent/90 active:bg-accent/80",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-meta gap-1.5 [&_svg]:size-3.5 pointer-coarse:h-10",
  md: "h-9 px-3.5 text-sm gap-2 [&_svg]:size-4 pointer-coarse:h-11",
  lg: "h-10 px-4 text-sm gap-2 [&_svg]:size-4 pointer-coarse:h-11",
  icon: "size-9 [&_svg]:size-4 pointer-coarse:size-11",
  "icon-sm": "size-8 [&_svg]:size-4 pointer-coarse:size-10",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center rounded-control font-semibold whitespace-nowrap transition-colors",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    variants[variant],
    sizes[size],
    extra,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, fullWidth, disabled, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, cn(fullWidth && "w-full", className))}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});
