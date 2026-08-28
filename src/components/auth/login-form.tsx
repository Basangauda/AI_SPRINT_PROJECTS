"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AuthFormLayout, AuthLink } from "@/components/auth/auth-form-layout";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveAuthUser } from "@/lib/auth-session";
import type { User } from "@/lib/types/user";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as {
        user?: User;
        error?: string;
      };

      if (!response.ok) {
        setError(body.error ?? "Invalid username or password");
        return;
      }

      if (body.user) {
        saveAuthUser(body.user);
      }

      router.push("/mcq");
    } catch {
      setError("Invalid username or password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthFormLayout
      title="Log in"
      description="Sign in to access your MCQ test bank."
      footer={
        <>
          Need an account? <AuthLink href="/register">Register</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="username">Username or email</FieldLabel>
            <Input
              id="username"
              name="username"
              required
              autoComplete="username"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </Field>

          {error ? <FieldError errors={[{ message: error }]} /> : null}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            Log in
          </Button>
        </FieldGroup>
      </form>
    </AuthFormLayout>
  );
}
