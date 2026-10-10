/**
 * src/app/auth/login/page.tsx
 * WHAT: Sign-in with a phone number and password.
 * WHY : Phone numbers are the login identity because every Nigerian student has
 *       one and can receive SMS. Email is optional and never required.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { UserIcon } from "@/components/ui/Icons";

/**
 * LoginPage
 * WHAT: Collects the phone number and password, then starts the session.
 * WHY : Uses the `next` query parameter so a user who was bounced off a protected
 *       page lands back where they were going.
 */
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const toast = useToast();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /** Submits the login. */
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await sendApi<{ user: { id: string } }>("/api/auth/login", "POST", { phone, password });

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success("Welcome back");
    // A hard navigation makes sure the server components re-render with the new session.
    router.push(next);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-16 pt-12">
      {/* Brand block - simple and calm, no illustration needed here. */}
      <div className="mb-6">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white">
          <UserIcon size={22} />
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">Your phone number and password.</p>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-3.5">
          <Input
            label="Phone number"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="0803 000 0001"
            autoComplete="tel"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
            required
          />

          {error ? <p className="rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}

          <Button type="submit" fullWidth loading={loading}>
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-600">
          New here?{" "}
          <Link href={`/auth/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-primary-700">
            Create an account
          </Link>
        </p>
      </Card>

      {/* Dev-only hint so the app is testable without Termii. */}
      <Card className="mt-4 bg-slate-50">
        <p className="text-[11px] leading-relaxed text-slate-600">
          <strong className="text-slate-800">Testing?</strong> The seed data creates a verified student on{" "}
          <code className="rounded bg-white px-1 font-mono text-[10px]">08030000001</code> and an admin on{" "}
          <code className="rounded bg-white px-1 font-mono text-[10px]">08030000099</code>, both with the password in your{" "}
          <code className="rounded bg-white px-1 font-mono text-[10px]">.env</code> file.
        </p>
      </Card>
    </div>
  );
}
