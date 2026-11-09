"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { applyApiErrors } from "@/lib/form-errors";
import { useAuthStatus, useLogin } from "@/lib/queries";
import { safeNext } from "@/lib/safe-redirect";
import { AuthForm, authLinkClass, FormError } from "../_components/AuthForm";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

const schema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const status = useAuthStatus();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: "", password: "" } });

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      await login.mutateAsync(v);
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      setFormError(applyApiErrors(err, setError, ["username", "password"]));
    }
  });

  return (
    <AuthForm
      title="Sign in"
      description="Use your username (or email) and password."
      footer={
        <div className="flex flex-col gap-1.5">
          <span>
            Have an invite code?{" "}
            <Link href="/join" className={authLinkClass}>
              Join a household
            </Link>
          </span>
          {status.data?.registrationOpen ? (
            <span>
              First time here?{" "}
              <Link href="/setup" className={authLinkClass}>
                Set up MyBudgetPal
              </Link>
            </span>
          ) : null}
        </div>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError message={formError} />
        <Field label="Username" htmlFor="username" error={errors.username?.message}>
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            invalid={!!errors.username}
            {...register("username")}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" invalid={!!errors.password} {...register("password")} />
        </Field>
        <Button type="submit" size="lg" fullWidth loading={login.isPending}>
          Sign in
        </Button>
      </form>
    </AuthForm>
  );
}
