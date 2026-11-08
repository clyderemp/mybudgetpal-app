"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { applyApiErrors } from "@/lib/form-errors";
import { useAuthStatus, useRegister } from "@/lib/queries";
import { AuthForm, authLinkClass, FormError } from "../_components/AuthForm";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";

const schema = z
  .object({
    householdName: z.string().trim().min(1, "Name your household").max(80),
    name: z.string().trim().min(1, "Enter your name").max(80),
    email: z.email("Enter a valid email").trim().toLowerCase(),
    password: z.string().min(10, "At least 10 characters").max(256),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
type Values = z.infer<typeof schema>;

export function SetupForm() {
  const status = useAuthStatus();

  if (status.isLoading) {
    return (
      <AuthForm title="Set up MyBudgetPal">
        <div role="status" aria-label="Checking setup status" className="flex flex-col gap-4">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </AuthForm>
    );
  }

  if (!status.data?.registrationOpen) {
    return (
      <AuthForm
        title={status.isError ? "Couldn't check setup status" : "Setup is already complete"}
        description={
          status.isError
            ? "The server didn't respond. Check your connection and reload this page."
            : "This MyBudgetPal already has a household. Sign in, or ask the owner for an invite code."
        }
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/login" className={buttonClasses("primary")}>
            Sign in
          </Link>
          <Link href="/join" className={buttonClasses("secondary")}>
            Join with an invite code
          </Link>
        </div>
      </AuthForm>
    );
  }

  return <OpenSetup />;
}

function OpenSetup() {
  const reg = useRegister();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { householdName: "", name: "", email: "", password: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async ({ confirm: _confirm, ...v }) => {
    void _confirm;
    setFormError(null);
    try {
      await reg.mutateAsync(v);
      // Full navigation (not router.replace): the first request for "/" must carry the
      // freshly set auth cookies, or proxy.ts bounces an RSC fetch to /login (404 noise).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch (err) {
      setFormError(applyApiErrors(err, setError, ["householdName", "name", "email", "password"]));
    }
  });

  return (
    <AuthForm
      title="Set up MyBudgetPal"
      description="Create your household and the owner's sign-in. You can invite your partner afterwards."
      footer={
        <span>
          Already set up?{" "}
          <Link href="/login" className={authLinkClass}>
            Sign in
          </Link>
        </span>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError message={formError} />
        <Field label="Household name" htmlFor="householdName" error={errors.householdName?.message}>
          <Input id="householdName" placeholder="e.g. The Johns" autoComplete="off" invalid={!!errors.householdName} {...register("householdName")} />
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
        <Button type="submit" size="lg" fullWidth loading={reg.isPending}>
          Create household
        </Button>
      </form>
    </AuthForm>
  );
}
