"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatDate } from "@/lib/dates";
import { useTransactions } from "@/lib/queries";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/Money";
import { Spinner } from "@/components/ui/Spinner";
import { overlayClass } from "@/components/ui/FormDialog";
import { useTransactionDialog } from "@/components/transactions/TransactionDialogProvider";
import { useCreate } from "./CreateProvider";
import { CREATE_ITEMS } from "./NewMenu";
import { NAV_ITEMS } from "./nav";

const PaletteContext = createContext<() => void>(() => {});

/** Opens the command palette (search buttons). */
export const useCommandPalette = () => useContext(PaletteContext);

/** Platform shortcut label for the search button. */
export function useShortcutLabel() {
  const [label, setLabel] = useState("Ctrl K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- platform is only known on the client
      setLabel("⌘K");
    }
  }, []);
  return label;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const itemCls =
  "flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-control px-2.5 text-sm text-ink outline-none " +
  "data-[selected=true]:bg-surface-2 data-[disabled=true]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-2";
const groupCls =
  "px-1.5 pb-1 [&_[cmdk-group-heading]]:px-1.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 " +
  "[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-2";

/** ⌘K / Ctrl+K command palette: navigate, create, search transactions by merchant (API). */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <PaletteContext.Provider value={show}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={overlayClass} />
          <Dialog.Content
            aria-describedby={undefined}
            className={cn(
              "fixed inset-x-0 top-0 z-50 flex max-h-[100dvh] flex-col overflow-hidden bg-surface text-ink focus:outline-none",
              "md:inset-x-auto md:top-[12vh] md:left-1/2 md:max-h-[min(70dvh,32rem)] md:w-[calc(100vw-2rem)] md:max-w-[600px] md:-translate-x-1/2",
              "md:rounded-container md:border md:border-line md:shadow-pop",
            )}
          >
            <Dialog.Title className="sr-only">Command palette</Dialog.Title>
            {open ? <Palette onDone={() => setOpen(false)} /> : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </PaletteContext.Provider>
  );
}

function Palette({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const create = useCreate();
  const { openEdit } = useTransactionDialog();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 250);
  const searching = q.length >= 2;
  const txns = useTransactions({ q, pageSize: 6, sort: "-date" }, { enabled: searching });
  const results: Transaction[] = useMemo(() => (searching ? (txns.data?.items ?? []) : []), [searching, txns.data]);

  const run = (fn: () => void) => {
    onDone();
    fn();
  };

  return (
    <Command label="Command palette" loop className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <Search className="size-4 shrink-0 text-ink-2" aria-hidden />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Search pages, actions or merchants"
          className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3 md:text-sm"
        />
        {searching && txns.isFetching ? <Spinner className="text-ink-2" /> : null}
        <Dialog.Close className="rounded-chip border border-line px-1.5 py-0.5 text-xs text-ink-2 hover:bg-surface-2">Esc</Dialog.Close>
      </div>
      <Command.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
        {searching && results.length > 0 ? null : (
          <Command.Empty className="px-4 py-8 text-center text-meta text-ink-2">
            {searching && txns.isFetching ? "Searching transactions…" : "No matches. Try a merchant name or a page."}
          </Command.Empty>
        )}

        {searching && results.length > 0 ? (
          <Command.Group heading="Transactions" forceMount className={groupCls}>
            {results.map((t) => (
              <Command.Item
                key={t.id}
                value={`txn-${t.id}`}
                keywords={[search]}
                forceMount
                onSelect={() => run(() => openEdit(t))}
                className={itemCls}
              >
                <span className="min-w-0 flex-1 truncate">{t.merchant || t.note || "Untitled"}</span>
                <span className="tabular shrink-0 text-xs text-ink-2">{formatDate(t.date, true)}</span>
                <Money
                  fils={t.amountFils}
                  flow={t.type === "income" ? "in" : t.type === "expense" ? "out" : "neutral"}
                  className="w-28 shrink-0 text-right text-meta"
                />
              </Command.Item>
            ))}
            <Command.Item
              value={`txn-all ${search}`}
              forceMount
              onSelect={() => run(() => router.push(`/transactions?q=${encodeURIComponent(q)}`))}
              className={itemCls}
            >
              <Search /> View all results for “{q}”
            </Command.Item>
          </Command.Group>
        ) : null}

        <Command.Group heading="Create" className={groupCls}>
          {CREATE_ITEMS.map(({ kind, label, icon: Icon }) => (
            <Command.Item key={kind} value={`New ${label}`} onSelect={() => run(() => create(kind))} className={itemCls}>
              <Icon /> New {label.toLowerCase()}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Go to" className={groupCls}>
          {NAV_ITEMS.map(({ href, label, icon: Icon, group }) => (
            <Command.Item key={href} value={`Go to ${label} ${group}`} onSelect={() => run(() => router.push(href))} className={itemCls}>
              <Icon /> <span className="flex-1">{label}</span>
              <span className="text-xs text-ink-2">{group}</span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
      <div className="hidden h-9 shrink-0 items-center gap-4 border-t border-line bg-surface-2 px-4 text-xs text-ink-2 md:flex">
        <span className="inline-flex items-center gap-1">
          <CornerDownLeft className="size-3" aria-hidden /> Select
        </span>
        <span>↑↓ Move</span>
        <span>Esc Close</span>
      </div>
    </Command>
  );
}
