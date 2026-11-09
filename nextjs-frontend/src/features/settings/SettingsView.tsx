"use client";
import { KeyRound, Palette, Tags, UserRound, Users, type LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { InlineError, PageHeader, Skeleton } from "@/components/ui";
import { useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { CategoriesSection } from "./CategoriesCard";
import { AppearanceSection, HouseholdSection, InvitesSection } from "./HouseholdCards";
import { ProfileSection } from "./ProfileSection";

type Section = "profile" | "household" | "invites" | "categories" | "appearance";

const SECTIONS: { value: Section; label: string; icon: LucideIcon }[] = [
  { value: "profile", label: "Profile", icon: UserRound },
  { value: "household", label: "Household & members", icon: Users },
  { value: "invites", label: "Invites", icon: KeyRound },
  { value: "categories", label: "Categories", icon: Tags },
  { value: "appearance", label: "Appearance", icon: Palette },
];

function parseSection(v: string | null): Section {
  return SECTIONS.some((s) => s.value === v) ? (v as Section) : "profile";
}

export function SettingsView() {
  const me = useMe();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const section = parseSection(params.get("section"));

  const go = (s: Section) => {
    const next = new URLSearchParams(params.toString());
    next.set("section", s);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <>
      <PageHeader title="Settings" description="Your profile and password, household members, invites, categories and appearance." />
      <div className="grid min-w-0 gap-5 lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Settings sections" className="min-w-0">
          <ul className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-b-0 lg:px-0">
            {SECTIONS.map((s) => {
              const active = s.value === section;
              return (
                <li key={s.value} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => go(s.value)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-2 px-2 text-sm whitespace-nowrap transition-colors lg:h-9 lg:pointer-coarse:h-11 lg:w-full lg:rounded-control lg:px-2.5",
                      "border-b-2 lg:border-b-0 focus-visible:-outline-offset-2",
                      active
                        ? "border-ink font-semibold text-ink lg:bg-surface-2"
                        : "border-transparent text-ink-2 hover:text-ink lg:hover:bg-surface-2",
                    )}
                  >
                    <s.icon className={cn("hidden size-4 shrink-0 lg:block", active ? "text-ink" : "text-ink-3")} aria-hidden />
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {me.isPending ? (
            <div role="status" aria-label="Loading settings" className="flex flex-col gap-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-48 w-full rounded-container" />
            </div>
          ) : me.isError ? (
            <InlineError error={me.error} onRetry={() => me.refetch()} title="Couldn't load your account" />
          ) : section === "profile" ? (
            <ProfileSection user={me.data.user} />
          ) : section === "household" ? (
            <HouseholdSection household={me.data.household} currentUserId={me.data.user.id} isOwner={me.data.user.role === "owner"} />
          ) : section === "invites" ? (
            <InvitesSection isOwner={me.data.user.role === "owner"} />
          ) : section === "categories" ? (
            <CategoriesSection />
          ) : (
            <AppearanceSection />
          )}
        </div>
      </div>
    </>
  );
}

