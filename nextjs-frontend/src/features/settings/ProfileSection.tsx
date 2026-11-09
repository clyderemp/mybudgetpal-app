"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, LogOut, Shuffle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, DetailRow, Field, Input, notify, Panel } from "@/components/ui";
import { AVATAR_STYLE_IDS, AVATAR_STYLES, avatarUri, randomSeed } from "@/lib/avatars";
import { applyApiErrors } from "@/lib/form-errors";
import { useChangePassword, useLogout, useUpdateProfile } from "@/lib/queries";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./SectionHeader";

const ROLE_LABEL = { owner: "Owner", member: "Member" } as const;

export function ProfileSection({ user }: { user: User }) {
  const logout = useLogout();
  return (
    <section>
      <SectionHeader title="Profile" description="How you appear to your household, and how you sign in." />
      <AvatarPanel user={user} />
      <DetailsPanel user={user} />
      <PasswordPanel />
      <Panel className="mt-5" title="Session" description="Signs you out on this device only.">
        <Button variant="secondary" loading={logout.isPending} onClick={() => logout.mutate()}>
          <LogOut aria-hidden /> Log out
        </Button>
      </Panel>
    </section>
  );
}

/* ---------------- Avatar ---------------- */

function AvatarPanel({ user }: { user: User }) {
  const update = useUpdateProfile();
  const [style, setStyle] = useState(user.avatarStyle);
  const [seed, setSeed] = useState(user.avatarSeed);
  const dirty = style !== user.avatarStyle || seed !== user.avatarSeed;

  const save = async () => {
    try {
      await update.mutateAsync({ avatarStyle: style, avatarSeed: seed });
      notify.success("Avatar saved");
    } catch (err) {
      notify.error(err, "Couldn't save avatar");
    }
  };

  return (
    <Panel title="Avatar" description="Pick a style, then shuffle until you like the face. Everyone in the household sees it.">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data: URI */}
          <img src={avatarUri({ style, seed })} alt="Your avatar preview" className="size-28 rounded-full border border-line bg-surface-2" />
          <Button variant="secondary" size="sm" onClick={() => setSeed(randomSeed())}>
            <Shuffle aria-hidden /> Shuffle
          </Button>
        </div>
        <div className="min-w-0 flex-1">
          <div role="radiogroup" aria-label="Avatar style" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {AVATAR_STYLE_IDS.map((id) => {
              const active = id === style;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={AVATAR_STYLES[id].label}
                  title={AVATAR_STYLES[id].label}
                  onClick={() => setStyle(id)}
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-control border bg-surface-2 p-1.5 transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    active ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink-3",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local data: URI */}
                  <img src={avatarUri({ style: id, seed })} alt="" className="size-full rounded-full" />
                  {active ? (
                    <span className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-ink text-surface">
                      <Check className="size-3" aria-hidden />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={save} loading={update.isPending} disabled={!dirty}>
              Save avatar
            </Button>
            {dirty ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setStyle(user.avatarStyle);
                  setSeed(user.avatarSeed);
                }}
              >
                Undo
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------- Name & account ---------------- */

const nameSchema = z.object({ name: z.string().trim().min(1, "Enter your name").max(100, "Use 100 characters or fewer") });

function DetailsPanel({ user }: { user: User }) {
  const update = useUpdateProfile();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<z.infer<typeof nameSchema>>({ resolver: zodResolver(nameSchema), values: { name: user.name } });

  const onSubmit = handleSubmit(async (v) => {
    try {
      await update.mutateAsync({ name: v.name });
      reset({ name: v.name });
      notify.success("Name saved");
    } catch (err) {
      if (applyApiErrors(err, setError, ["name"])) notify.error(err, "Couldn't save name");
    }
  });

  return (
    <Panel className="mt-5" title="Account">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Field label="Display name" htmlFor="profile-name" error={errors.name?.message} className="sm:max-w-sm sm:flex-1">
          <Input id="profile-name" autoComplete="name" invalid={!!errors.name} {...register("name")} />
        </Field>
        <Button type="submit" loading={update.isPending} disabled={!isDirty} className="self-start sm:mt-[22px]">
          Save name
        </Button>
      </form>
      <dl className="mt-3">
        {user.username ? <DetailRow label="Username">{user.username}</DetailRow> : null}
        <DetailRow label="Email">{user.email}</DetailRow>
        <DetailRow label="Role">{ROLE_LABEL[user.role]}</DetailRow>
      </dl>
    </Panel>
  );
}

/* ---------------- Password ---------------- */

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(10, "Use at least 10 characters").max(256, "Use 256 characters or fewer"),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a different password" });
type PasswordForm = z.infer<typeof passwordSchema>;

function PasswordPanel() {
  const change = useChangePassword();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await change.mutateAsync({ currentPassword, newPassword });
      reset();
      notify.success("Password changed. Other devices have been signed out.");
    } catch (err) {
      if (applyApiErrors(err, setError, ["currentPassword", "newPassword"])) notify.error(err, "Couldn't change password");
    }
  });

  return (
    <Panel className="mt-5" title="Password" description="Changing it signs you out everywhere else.">
      <form noValidate onSubmit={onSubmit} className="flex max-w-sm flex-col gap-4">
        <Field label="Current password" htmlFor="pw-current" error={errors.currentPassword?.message}>
          <Input id="pw-current" type="password" autoComplete="current-password" invalid={!!errors.currentPassword} {...register("currentPassword")} />
        </Field>
        <Field label="New password" htmlFor="pw-new" error={errors.newPassword?.message} hint="At least 10 characters.">
          <Input id="pw-new" type="password" autoComplete="new-password" invalid={!!errors.newPassword} {...register("newPassword")} />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-confirm" error={errors.confirm?.message}>
          <Input id="pw-confirm" type="password" autoComplete="new-password" invalid={!!errors.confirm} {...register("confirm")} />
        </Field>
        <Button type="submit" loading={change.isPending} className="self-start">
          Change password
        </Button>
      </form>
    </Panel>
  );
}
