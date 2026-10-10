/**
 * src/app/error.tsx
 * WHAT: The error boundary shown when a page throws while rendering.
 * WHY : An unhandled error would otherwise leave a blank white screen on a
 *       phone. This tells the student what happened and gives them a way back,
 *       without leaking a stack trace.
 *
 * WHY IT ALSO EXPLAINS DATABASE PROBLEMS: on a fresh install the most common
 * crash is "the database has not been created yet". When the error looks like a
 * database/connection problem, this screen says exactly which two commands fix
 * it, instead of a generic apology.
 *
 * NOTE: this file MUST be a client component - that is a Next.js requirement
 * for error boundaries.
 */
"use client";

import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AlertIcon } from "@/components/ui/Icons";

/**
 * looksLikeDatabaseProblem
 * WHAT: A small heuristic that decides whether an error is a database or
 *       connection problem.
 * WHY : Those are the errors a developer (or a student following the README)
 *       can actually fix, and the fix is always the same two commands.
 */
function looksLikeDatabaseProblem(error: Error): boolean {
  const text = `${error.name} ${error.message}`.toLowerCase();
  return [
    "database_url",        // .env missing the connection string entirely
    "database does not exist", // createdb / prisma db push never ran
    "p1001",              // Prisma: cannot reach the database server
    "p1002",              // Prisma: connection timed out
    "p1003",              // Prisma: database authentication failed
    "p1010",              // Prisma: access denied
    "p2021",              // Prisma: the table does not exist (schema not pushed)
    "econnrefused",       // Postgres is not running
    "connect",            // generic connection failure
    "prisma",             // any Prisma runtime error is almost always setup
  ].some((needle) => text.includes(needle));
}

/**
 * ErrorBoundary
 * WHAT: Reports the error and offers a retry.
 * WHY : Logging here is the only place we can catch render-time failures, and
 *       the retry button lets a user recover from a transient network blip
 *       without closing the app.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Send the error to the browser console. Swap this for Sentry, LogRocket or
  // your own endpoint when you want server-side collection in production.
  useEffect(() => {
    console.error("Unhandled page error:", error);
  }, [error]);

  const isDb = useMemo(() => looksLikeDatabaseProblem(error), [error]);

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-16 pt-16">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-light text-danger-dark">
        <AlertIcon size={24} />
      </span>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
        {isDb ? "The database is not ready yet" : "Something went wrong"}
      </h1>

      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {isDb
          ? "This page reads from PostgreSQL and could not reach it. On a fresh install that simply means the database has not been created or pushed yet - it is a setup step, not a bug in your code."
          : "This is our fault, not yours. Your data is safe - nothing was lost. Try again, and if it keeps happening let us know so we can fix it."}
      </p>

      {isDb ? (
        <Card className="mt-5 bg-slate-900 text-white">
          <p className="text-xs font-bold text-slate-300">Run these two commands in the project folder, then try again:</p>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-black/40 p-3 font-mono text-xs leading-relaxed text-gold-300">
            {"npx prisma db push\nnpm run db:seed"}
          </pre>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            And make sure <code className="rounded bg-white/10 px-1">.env</code> has your real{" "}
            <code className="rounded bg-white/10 px-1">DATABASE_URL</code> (copy{" "}
            <code className="rounded bg-white/10 px-1">.env.example</code> first), and that Postgres is running.
          </p>
        </Card>
      ) : null}

      <Card className="mt-5">
        <Button fullWidth onClick={reset}>
          Try again
        </Button>

        <a href="/" className="mc-btn-secondary mt-2 w-full">
          Go to the home screen
        </a>

        {/* The digest is a short id Next.js gives each error. Quoting it to
            support saves a lot of back and forth. */}
        {error.digest ? (
          <p className="mt-3 text-center font-mono text-[10px] text-slate-400">Error reference: {error.digest}</p>
        ) : null}
      </Card>
    </div>
  );
}
