"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const errorParam = searchParams.get("error");
  const displayError = error ?? (errorParam ? getErrorMessage(errorParam) : null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signIn("credentials", {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "ACCESS_DENIED" || result.error === "CredentialsSignin") {
          setError(
            result.error === "ACCESS_DENIED"
              ? "This account does not have admin access."
              : "Invalid email or password."
          );
        } else {
          setError("An error occurred. Please try again.");
        }
      } else {
        router.push("/");
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="parent@family.com"
          required
          disabled={isPending}
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          disabled={isPending}
          autoComplete="current-password"
        />
      </div>
      {displayError && (
        <p className="text-sm text-destructive" role="alert">
          {displayError}
        </p>
      )}
      <Button
        type="submit"
        className="w-full active:scale-95 transition-transform"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}

function getErrorMessage(error: string): string {
  if (error === "ACCESS_DENIED") return "This account does not have admin access.";
  if (error === "CredentialsSignin") return "Invalid email or password.";
  return "Authentication failed. Please try again.";
}
