"use client";
import * as DM from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { Fragment, useId, useMemo, type ReactNode } from "react";
import type React from "react";
import { cn } from "@/lib/utils";
import { inputClasses, labelClasses } from "./Field";

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  /** Optional group heading; options are rendered grouped in first-seen order. */
  group?: string;
  disabled?: boolean;
}

interface BaseProps {
  options: DropdownOption[];
  label?: ReactNode;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  /** Visual style of the trigger: "field" (form input) or "chip" (filter bar). */
  appearance?: "field" | "chip";
  "aria-label"?: string;
}

export interface SingleDropdownProps extends BaseProps {
  multiple?: false;
  value: string | null | undefined;
  onChange: (value: string) => void;
  /** Adds a first "clear" option with this label that emits "". */
  clearLabel?: string;
}

export interface MultiDropdownProps extends BaseProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
}

export type DropdownProps = SingleDropdownProps | MultiDropdownProps;

/** Select built on Radix DropdownMenu. Single (radio) or multi (checkbox) selection. */
export function Dropdown(props: DropdownProps) {
  const { options, label, placeholder = "Select…", disabled, error, className, appearance = "field" } = props;
  const autoId = useId();
  const id = props.id ?? autoId;

  const groups = useMemo(() => {
    const map = new Map<string, DropdownOption[]>();
    for (const o of options) {
      const g = o.group ?? "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    return [...map.entries()];
  }, [options]);

  let display: ReactNode;
  if (props.multiple) {
    const sel = options.filter((o) => props.value.includes(o.value));
    display = sel.length === 0 ? null : sel.length <= 2 ? sel.map((o) => o.label).join(", ") : `${sel.length} selected`;
  } else {
    const sel = options.find((o) => o.value === props.value);
    display = sel ? (
      <span className="flex min-w-0 items-center gap-2">
        {sel.icon}
        <span className="truncate">{sel.label}</span>
      </span>
    ) : null;
  }

  const renderItems = (opts: DropdownOption[]) =>
    opts.map((o) =>
      props.multiple ? (
        <DM.CheckboxItem
          key={o.value}
          disabled={o.disabled}
          checked={props.value.includes(o.value)}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={(checked) => {
            const next = checked ? [...props.value, o.value] : props.value.filter((v) => v !== o.value);
            props.onChange(next);
          }}
          className={itemClass}
        >
          <ItemBody option={o} />
          <DM.ItemIndicator>
            <Check className="size-4 text-accent" aria-hidden />
          </DM.ItemIndicator>
        </DM.CheckboxItem>
      ) : (
        <DM.RadioItem key={o.value} value={o.value} disabled={o.disabled} className={itemClass}>
          <ItemBody option={o} />
          <DM.ItemIndicator>
            <Check className="size-4 text-accent" aria-hidden />
          </DM.ItemIndicator>
        </DM.RadioItem>
      ),
    );

  const content = groups.map(([g, opts], i) => (
    <Fragment key={g || `__${i}`}>
      {i > 0 ? <DM.Separator className={menuSeparatorClass} /> : null}
      {g ? <DM.Label className={menuLabelClass}>{g}</DM.Label> : null}
      {renderItems(opts)}
    </Fragment>
  ));

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label ? (
        <span id={`${id}-label`} className={labelClasses}>
          {label}
        </span>
      ) : null}
      <DM.Root>
        <DM.Trigger
          id={id}
          disabled={disabled}
          aria-labelledby={label ? `${id}-label ${id}` : undefined}
          aria-label={!label ? props["aria-label"] : undefined}
          aria-invalid={error ? true : undefined}
          className={cn(
            appearance === "field"
              ? cn(inputClasses, "flex items-center justify-between gap-2 text-left")
              : cn(
                  "inline-flex h-8 max-w-full items-center gap-1.5 rounded-control border bg-surface px-2.5 pointer-coarse:h-10 text-meta font-medium text-ink hover:bg-surface-2 disabled:opacity-60",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[state=open]:bg-surface-2",
                  display ? "border-ink-3" : "border-line-strong",
                ),
          )}
        >
          <span className={cn("min-w-0 truncate", !display && (appearance === "chip" ? "text-ink-2" : "text-ink-3"))}>{display ?? placeholder}</span>
          <ChevronDown className="size-4 shrink-0 text-ink-3" aria-hidden />
        </DM.Trigger>
        <DM.Portal>
          <DM.Content
            align="start"
            sideOffset={6}
            collisionPadding={8}
            className={cn(menuContentClass, "max-h-[min(60dvh,var(--radix-dropdown-menu-content-available-height))] min-w-[max(12rem,var(--radix-dropdown-menu-trigger-width))] overflow-y-auto")}
          >
            {options.length === 0 ? <div className="px-2 py-2 text-meta text-ink-2">No options</div> : null}
            {props.multiple ? (
              content
            ) : (
              <DM.RadioGroup value={props.value ?? ""} onValueChange={(v) => props.onChange(v)}>
                {props.clearLabel ? (
                  <DM.RadioItem value="" className={itemClass}>
                    <span className="text-ink-2">{props.clearLabel}</span>
                  </DM.RadioItem>
                ) : null}
                {content}
              </DM.RadioGroup>
            )}
          </DM.Content>
        </DM.Portal>
      </DM.Root>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* Shared menu styling (Dropdown, ActionMenu, Menu*). One shadow token: shadow-pop. */
export const menuContentClass =
  "z-[60] max-w-[calc(100vw-1rem)] rounded-container border border-line bg-surface p-1 text-ink shadow-pop";
export const menuLabelClass = "px-2 pt-2 pb-1 text-xs font-medium text-ink-2";
export const menuSeparatorClass = "-mx-1 my-1 h-px bg-line";
export const itemClass =
  "relative flex min-h-8 pointer-coarse:min-h-11 cursor-pointer select-none items-center justify-between gap-2 rounded-chip px-2 py-1.5 text-sm outline-none " +
  "data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

function ItemBody({ option }: { option: DropdownOption }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {option.icon}
      <span className="min-w-0">
        <span className="block truncate">{option.label}</span>
        {option.description ? <span className="block truncate text-xs text-ink-2">{option.description}</span> : null}
      </span>
    </span>
  );
}

/** Generic action menu (e.g. "More actions" row menus). Items may be separated with { separator: true }. */
export type ActionMenuItem =
  | { label: string; onSelect: () => void; icon?: ReactNode; danger?: boolean; disabled?: boolean; shortcut?: string; separator?: false }
  | { separator: true; label?: undefined };

export function ActionMenu({
  trigger,
  items,
  align = "end",
  label,
}: {
  trigger: ReactNode;
  items: ActionMenuItem[];
  align?: "start" | "end";
  /** Optional heading inside the menu. */
  label?: ReactNode;
}) {
  return (
    <DM.Root>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content align={align} sideOffset={6} collisionPadding={8} className={cn(menuContentClass, "min-w-44")}>
          {label ? <DM.Label className={menuLabelClass}>{label}</DM.Label> : null}
          {items.map((it, i) =>
            it.separator ? (
              <DM.Separator key={`sep-${i}`} className={menuSeparatorClass} />
            ) : (
              <DM.Item
                key={it.label}
                disabled={it.disabled}
                onSelect={it.onSelect}
                className={cn(itemClass, "justify-start", it.danger ? "text-danger" : "[&_svg]:text-ink-2")}
              >
                {it.icon}
                <span className="flex-1">{it.label}</span>
                {it.shortcut ? <kbd className="text-xs font-normal text-ink-3">{it.shortcut}</kbd> : null}
              </DM.Item>
            ),
          )}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

/* Low-level menu parts for custom menus (user menu, New menu). */
export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;
export const MenuGroup = DM.Group;
export const MenuRadioGroup = DM.RadioGroup;

export function MenuContent({ className, children, ...rest }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content sideOffset={6} collisionPadding={8} className={cn(menuContentClass, "min-w-48", className)} {...rest}>
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function MenuItem({ className, ...rest }: React.ComponentProps<typeof DM.Item>) {
  return <DM.Item className={cn(itemClass, "justify-start [&_svg]:text-ink-2", className)} {...rest} />;
}

export function MenuRadioItem({ className, children, ...rest }: React.ComponentProps<typeof DM.RadioItem>) {
  return (
    <DM.RadioItem className={cn(itemClass, "[&_svg]:text-ink-2", className)} {...rest}>
      <span className="flex items-center gap-2">{children}</span>
      <DM.ItemIndicator>
        <Check className="text-accent" aria-hidden />
      </DM.ItemIndicator>
    </DM.RadioItem>
  );
}

export function MenuLabel({ className, ...rest }: React.ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn(menuLabelClass, className)} {...rest} />;
}

export function MenuSeparator({ className, ...rest }: React.ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className={cn(menuSeparatorClass, className)} {...rest} />;
}
