"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { applyApiErrors } from "@/lib/form-errors";
import { useJoin } from "@/lib/queries";
import { AuthForm, authLinkClass, FormError } from "../_components/AuthForm";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

const schema = z
  .object({
    inviteCode: z.string().trim().min(10, "Invite codes are at least 10 characters"),
    name: z.string().trim().min(1, "Enter your name").max(80),
    email: z.email("Enter a valid email").trim().toLowerCase(),
    password: z.string().min(10, "At least 10 characters").max(256),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
type Values = z.infer<typeof schema>;

export function JoinForm() {
  const params = useSearchParams();
  const join = useJoin();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { inviteCode: params.get("code") ?? "", name: "", email: "", password: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async ({ confirm: _confirm, ...v }) => {
    void _confirm;
    setFormError(null);
    try {
      await join.mutateAsync(v);
      // Full navigation (not router.replace): the first request for "/" must carry the
      // freshly set auth cookies, or proxy.ts bounces an RSC fetch to /login (404 noise).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch (err) {
      setFormError(applyApiErrors(err, setError, ["inviteCode", "name", "email", "password"]));
    }
  });

  return (
    <AuthForm
      title="Join a household"
      description="Enter the invite code from the household owner, then create your own sign-in."
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/login" className={authLinkClass}>
            Sign in
          </Link>
        </span>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError message={formError} />
        <Field label="Invite code" htmlFor="inviteCode" error={errors.inviteCode?.message}>
          <Input id="inviteCode" autoComplete="off" autoCapitalize="off" spellCheck={false} invalid={!!errors.inviteCode} {...register("inviteCode")} />
        </Field>
        <Field label="Your name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" inputMode="email" invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 10 characters.">
          <Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password} {...register("password")} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" invalid={!!errors.confirm} {...register("confirm")} />
        </Field>
        <Button type="submit" size="lg" fullWidth loading={join.isPending}>
          Join household
        </Button>
      </form>
    </AuthForm>
  );
}
