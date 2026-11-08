"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight, LogOut, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLogout, useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { overlayClass } from "@/components/ui/FormDialog";
import { MORE_ITEMS, isActive } from "./nav";
import { ThemeToggle } from "./ThemeToggle";

/** Bottom sheet behind the "More" tab: Accounts, Insights, Settings, theme, log out. */
export function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const pathname = usePathname();
  const me = useMe();
  const logout = useLogout();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn(overlayClass, "md:hidden")} />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-container border-t border-line bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] text-ink shadow-pop focus:outline-none md:hidden">
          <div className="flex h-14 items-center justify-between border-b border-line px-4">
            <Dialog.Title className="text-base font-semibold">More</Dialog.Title>
            <Dialog.Description className="sr-only">More pages and settings</Dialog.Description>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close" className="-mr-2">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <nav aria-label="More" className="py-1">
            {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => onOpenChange(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-12 items-center gap-3 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    active ? "bg-surface-2 text-ink" : "text-ink hover:bg-surface-2",
                  )}
                >
                  <Icon className="size-4 text-ink-2" aria-hidden />
                  <span className="flex-1">{label}</span>
                  <ChevronRight className="size-4 text-ink-3" aria-hidden />
                </Link>
              );
            })}
          </nav>
          <div className="flex flex-col gap-3 border-t border-line px-4 pt-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-meta font-medium text-ink">Theme</span>
              <ThemeToggle />
            </div>
            <div className="flex items-center gap-3">
              <Avatar name={me.data?.user.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{me.data?.user.name}</p>
                <p className="truncate text-xs text-ink-2">{me.data?.household.name}</p>
              </div>
              <Button variant="secondary" size="sm" loading={logout.isPending} onClick={() => logout.mutate()}>
                {logout.isPending ? null : <LogOut />} Log out
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
