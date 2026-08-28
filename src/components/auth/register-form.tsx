"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AuthFormLayout, AuthLink } from "@/components/auth/auth-form-layout";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveAuthUser } from "@/lib/auth-session";
import type { User } from "@/lib/types/user";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const payload = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      username: String(formData.get("username") ?? ""),
      email: String(formData.get("email") ?? ""),
      group: String(formData.get("group") ?? ""),
      password,
    };

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as {
        user?: User;
        error?: string;
      };

      if (!response.ok) {
        setError(body.error ?? "Registration failed");
        return;
      }

      if (body.user) {
        saveAuthUser(body.user);
      }

      router.push("/mcq");
    } catch {
      setError("Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthFormLayout
      title="Create your account"
      description="Register to start building your MCQ test bank."
      footer={
        <>
          Already have an account? <AuthLink href="/login">Log in</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="firstName">First name</FieldLabel>
            <Input id="firstName" name="firstName" required autoComplete="given-name" />
          </Field>

          <Field>
            <FieldLabel htmlFor="lastName">Last name</FieldLabel>
            <Input id="lastName" name="lastName" required autoComplete="family-name" />
          </Field>

          <Field>
            <FieldLabel htmlFor="username">Username</FieldLabel>
            <Input
              id="username"
              name="username"
              required
              autoComplete="username"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="group">Group</FieldLabel>
            <Input id="group" name="group" required />
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
            />
          </Field>

          {error ? <FieldError errors={[{ message: error }]} /> : null}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            Create account
          </Button>
        </FieldGroup>
      </form>
    </AuthFormLayout>
  );
}
