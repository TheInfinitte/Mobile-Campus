/**
 * src/app/not-found.tsx
 * WHAT: The 404 screen.
 * WHY : On a phone a dead link usually means a listing was taken down, so the
 *       message says that plainly and points back at the useful parts of the app
 *       instead of a dead end.
 */
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SearchIcon } from "@/components/ui/Icons";

/**
 * NotFound
 * WHAT: A calm, useful dead end.
 */
export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-16 pt-16">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
        <SearchIcon size={24} />
      </span>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">We could not find that page</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        The link may be old, or the listing may have been taken down - which usually means the room has been let. Nothing is wrong
        with your account.
      </p>

      <Card className="mt-5">
        <p className="text-xs font-bold text-slate-900">Try one of these instead</p>
        <div className="mt-3 space-y-2">
          {[
            { href: "/housing", label: "Browse off-campus rooms", hint: "Verified listings near DELSU Abraka" },
            { href: "/market", label: "The student market", hint: "Generators, textbooks, fans and more" },
            { href: "/roommates", label: "Find a roommate", hint: "Matched by how you actually live" },
            { href: "/profile", label: "My profile", hint: "Your shortlist, payments and verification" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex min-h-[48px] items-center justify-between rounded-xl border border-slate-200 px-3.5 transition-colors active:bg-slate-50"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-900">{link.label}</span>
                <span className="block text-[11px] text-slate-500">{link.hint}</span>
              </span>
              <span className="text-lg text-slate-300">›</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
