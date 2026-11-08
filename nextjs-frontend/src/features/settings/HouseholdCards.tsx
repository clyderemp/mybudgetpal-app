"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, KeyRound, LogOut } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { ActionButton, Avatar, Badge, Button, DetailRow, EmptyState, Field, InlineError, Input, notify, Panel, SkeletonList } from "@/components/ui";
import { applyApiErrors } from "@/lib/form-errors";
import { useCreateInvite, useInvites, useLogout, useRevokeInvite, useUpdateHousehold } from "@/lib/queries";
import type { Household, Invite, User } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";

const ROLE_LABEL = { owner: "Owner", member: "Member" } as const;

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" });
}

/* ---------------- Profile ---------------- */

export function ProfileSection({ user }: { user: User }) {
  const logout = useLogout();
  return (
    <section>
      <SectionHeader title="Profile" description="The account you sign in with." />
      <Panel flush>
        <div className="flex items-center gap-3 border-b border-line px-4 py-4 md:px-5">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-meta text-ink-2">{user.email}</p>
          </div>
        </div>
        <dl className="px-4 md:px-5">
          <DetailRow label="Name">{user.name}</DetailRow>
          <DetailRow label="Email">{user.email}</DetailRow>
          <DetailRow label="Role">{ROLE_LABEL[user.role]}</DetailRow>
        </dl>
      </Panel>

      <Panel className="mt-5" title="Session" description="Signs you out on this device only.">
        <Button variant="secondary" loading={logout.isPending} onClick={() => logout.mutate()}>
          <LogOut aria-hidden /> Log out
        </Button>
      </Panel>
    </section>
  );
}

/* ---------------- Appearance ---------------- */

export function AppearanceSection() {
  return (
    <section>
      <SectionHeader title="Appearance" description="Applies to this browser only." />
      <Panel title="Theme" description="Follow your device setting, or always use light or dark.">
        <div className="max-w-xs">
          <ThemeToggle />
        </div>
      </Panel>
    </section>
  );
}

/* ---------------- Household & members ---------------- */

const nameSchema = z.object({ name: z.string().trim().min(1, "Enter a household name").max(80, "Use 80 characters or fewer") });
type NameForm = z.infer<typeof nameSchema>;

export function HouseholdSection({ household, currentUserId, isOwner }: { household: Household; currentUserId: string; isOwner: boolean }) {
  const update = useUpdateHousehold();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<NameForm>({ resolver: zodResolver(nameSchema), values: { name: household.name } });

  const onSubmit = handleSubmit(async (v) => {
    try {
      await update.mutateAsync({ name: v.name });
      reset({ name: v.name });
      notify.success("Household renamed");
    } catch (err) {
      const msg = applyApiErrors(err, setError, ["name"]);
      if (msg) notify.error(err, "Couldn't rename household");
    }
  });

  return (
    <section>
      <SectionHeader title="Household & members" description="Everything in a household is shared by all of its members." />
      <Panel title="Household">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Field label="Household name" htmlFor="household-name" error={errors.name?.message} className="sm:max-w-sm sm:flex-1">
            <Input id="household-name" autoComplete="off" invalid={!!errors.name} {...register("name")} />
          </Field>
          <Button type="submit" loading={update.isPending} disabled={!isDirty} className="self-start sm:mt-[22px]">
            Save name
          </Button>
        </form>
      </Panel>

      <Panel className="mt-5" title="Members" description={household.members.length === 1 ? "1 member" : `${household.members.length} members`} flush>
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Household members</caption>
          <thead className="hidden bg-surface-2 sm:table-header-group">
            <tr className="h-9 border-b border-line text-left text-meta text-ink-2">
              <th scope="col" className="px-4 font-medium md:px-5">
                Name
              </th>
              <th scope="col" className="px-4 font-medium">
                Email
              </th>
              <th scope="col" className="w-28 px-4 text-right font-medium md:px-5">
                Role
              </th>
            </tr>
          </thead>
          <tbody>
            {household.members.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-0">
                <td className="h-12 px-4 md:px-5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={m.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">
                        {m.name}
                        {m.id === currentUserId ? <span className="font-normal text-ink-2"> (you)</span> : null}
                      </span>
                      <span className="block truncate text-xs text-ink-2 sm:hidden">{m.email}</span>
                    </span>
                  </span>
                </td>
                <td className="hidden truncate px-4 text-ink-2 sm:table-cell">{m.email}</td>
                <td className="w-24 px-4 text-right sm:w-28 md:px-5">
                  <Badge tone={m.role === "owner" ? "ink" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-3 text-meta text-ink-2 md:px-5">
          {isOwner ? "To add your partner, create an invite code in Invites." : "Only the household owner can invite members."}
        </p>
      </Panel>
    </section>
  );
}

/* ---------------- Invites ---------------- */

function ActiveInvites() {
  const invites = useInvites();
  const revoke = useRevokeInvite();
  return (
    <Panel className="mt-5" title="Active codes" description="Unused codes that can still be redeemed" flush>
      {invites.isPending ? (
        <SkeletonList rows={2} className="px-4 md:px-5" />
      ) : invites.isError ? (
        <InlineError error={invites.error} onRetry={() => invites.refetch()} title="Couldn't load invite codes" className="m-4 md:m-5" />
      ) : !invites.data?.length ? (
        <p className="px-4 py-4 text-meta text-ink-2 md:px-5">No active codes. Codes you create appear here until they&apos;re used or expire.</p>
      ) : (
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Active invite codes</caption>
          <thead className="bg-surface-2">
            <tr className="h-9 border-b border-line text-left text-meta text-ink-2">
              <th scope="col" className="hidden px-4 font-medium sm:table-cell md:px-5">
                Created
              </th>
              <th scope="col" className="px-4 font-medium md:px-5">
                Expires (Dubai time)
              </th>
              <th scope="col" className="w-28 px-4 md:px-5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invites.data.map((i) => (
              <tr key={i.id} className="h-10 border-b border-line last:border-0">
                <td className="tabular hidden truncate px-4 text-ink-2 sm:table-cell md:px-5">{formatDateTime(i.createdAt)}</td>
                <td className="tabular truncate px-4 text-ink md:px-5">{formatDateTime(i.expiresAt)}</td>
                <td className="px-4 text-right md:px-5">
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:text-danger"
                    aria-label={`Revoke invite expiring ${formatDateTime(i.expiresAt)}`}
                    onAction={() => revoke.mutateAsync(i.id)}
                    successMessage="Invite revoked"
                    errorMessage="Couldn't revoke invite"
                  >
                    Revoke
                  </ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

export function InvitesSection({ isOwner }: { isOwner: boolean }) {
  const create = useCreateInvite();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      notify.success("Invite code copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error(new Error("Select the code and copy it manually."), "Couldn't copy the code");
    }
  }

  if (!isOwner) {
    return (
      <section>
        <SectionHeader title="Invites" description="Invite codes let a second person join this household." />
        <Panel>
          <EmptyState icon={KeyRound} title="Only the household owner can create invite codes" description="Ask the owner to create a code and share it with the person joining." className="py-6" />
        </Panel>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader title="Invites" description="Invite codes let a second person join this household." />
      <Panel title="Create an invite code" description="Single use. Valid for 7 days.">
        <div className="flex flex-col gap-4">
          <p className="text-meta text-ink-2">
            The person joining opens the join page, enters the code, and creates their own sign-in. They see everything in this household.
          </p>
          {invite ? (
            <div className="flex flex-col gap-3 rounded-control border border-line bg-surface-2 p-4" aria-live="polite">
              <p className="text-sm font-medium text-ink">Share this code now. It won&apos;t be shown again.</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-3 py-2 font-mono text-base font-semibold break-all text-ink select-all">
                  {invite.code}
                </code>
                <Button variant="secondary" onClick={copy}>
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied ? "Copied" : "Copy code"}
                </Button>
              </div>
              <p className="tabular text-xs text-ink-2">Expires {formatDateTime(invite.expiresAt)}, Dubai time</p>
            </div>
          ) : null}
          <div>
            <ActionButton
              variant={invite ? "secondary" : "primary"}
              onAction={async () => {
                const res = await create.mutateAsync();
                setInvite(res);
                setCopied(false);
              }}
              errorMessage="Couldn't create invite code"
            >
              {invite ? "Create another code" : "Create invite code"}
            </ActionButton>
          </div>
        </div>
      </Panel>
      <ActiveInvites />
    </section>
  );
}
