"use client";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLogout, useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Dropdown";

function MenuBody({ align, side }: { align: "start" | "end"; side?: "top" | "bottom" | "right" }) {
  const me = useMe();
  const logout = useLogout();
  const router = useRouter();
  return (
    <MenuContent align={align} side={side} className="w-60">
      <div className="flex items-center gap-2.5 px-2 py-2">
        <Avatar name={me.data?.user.name} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{me.data?.user.name}</p>
          <p className="truncate text-xs text-ink-2">{me.data?.user.email}</p>
        </div>
      </div>
      <MenuSeparator />
      <MenuItem onSelect={() => router.push("/settings")}>
        <Settings /> Settings
      </MenuItem>
      <MenuItem
        disabled={logout.isPending}
        onSelect={(e) => {
          e.preventDefault();
          logout.mutate();
        }}
      >
        <LogOut /> {logout.isPending ? "Logging out…" : "Log out"}
      </MenuItem>
    </MenuContent>
  );
}

/** Avatar-only trigger (top bar). */
export function UserMenu() {
  const me = useMe();
  return (
    <Menu>
      <MenuTrigger
        aria-label={`Account menu for ${me.data?.user.name ?? "you"}`}
        className="inline-flex size-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Avatar name={me.data?.user.name} size="md" title="" />
      </MenuTrigger>
      <MenuBody align="end" />
    </Menu>
  );
}

/** Sidebar footer trigger (name + role), dark surface. */
export function SidebarUserMenu({ collapsed }: { collapsed: boolean }) {
  const me = useMe();
  return (
    <Menu>
      <MenuTrigger
        aria-label={`Account menu for ${me.data?.user.name ?? "you"}`}
        className={cn(
          "flex h-11 w-full min-w-0 items-center gap-2.5 rounded-control text-left text-sidebar-ink hover:bg-sidebar-active-bg",
          "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent data-[state=open]:bg-sidebar-active-bg",
          collapsed ? "justify-center px-0" : "px-2",
        )}
      >
        <Avatar name={me.data?.user.name} size="sm" title="" />
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-meta font-medium text-sidebar-active">{me.data?.user.name}</span>
              <span className="block truncate text-xs text-sidebar-ink/80">{me.data?.user.role === "owner" ? "Owner" : "Member"}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-sidebar-ink/70" aria-hidden />
          </>
        ) : null}
      </MenuTrigger>
      <MenuBody align="start" side={collapsed ? "right" : "top"} />
    </Menu>
  );
}
