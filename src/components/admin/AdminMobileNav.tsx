/**
 * src/components/admin/AdminMobileNav.tsx
 * WHAT: The phone/tablet version of admin navigation - a sticky top bar with a
 *       hamburger that opens a slide-in drawer listing the same sections.
 * WHY : The desktop sidebar is `hidden lg:flex`, so on a phone there would be
 *       no way to move between admin sections. Admins mostly work from a
 *       phone too (that is the whole point of a mobile-first campus app), so
 *       the drawer has to be as usable as the rail.
 *
 * This is a client component because opening a drawer is browser state. The
 * section list is passed in as plain data from the server layout, so the
 * SUPER_ADMIN filtering still happens server-side and a normal admin's
 * browser never even receives the user-management link.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_ICONS, type AdminCounts, type AdminSection } from "@/lib/admin-nav";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { CloseIcon, MenuIcon, ShieldIcon } from "@/components/ui/Icons";

/** Props from the server layout. */
interface AdminMobileNavProps {
  user: { fullName: string; roleLabel: string };
  /** Already grouped under headings, already filtered for this admin's tier. */
  groups: { group: string; sections: AdminSection[] }[];
  counts: AdminCounts;
}

/**
 * AdminMobileNav
 * WHAT: Sticky header + drawer. Only rendered below the lg breakpoint.
 */
export function AdminMobileNav({ user, groups, counts }: AdminMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  /**
   * Close the drawer whenever the admin navigates.
   * WHY : Otherwise tapping a link leaves the drawer covering the new page.
   */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /**
   * Lock body scroll while the drawer is open.
   * WHY : Without this, swiping over the drawer scrolls the page behind it,
   *       which feels broken on a phone.
   */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* --- Sticky top bar (mobile only) --- */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
        >
          <MenuIcon size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">Admin</p>
          <p className="truncate text-xs text-slate-500">{user.fullName}</p>
        </div>
        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
          {user.roleLabel}
        </span>
      </header>

      {/* --- Drawer backdrop: tap to close --- */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* --- The drawer itself --- */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-float transition-transform duration-200 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
              <ShieldIcon size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{user.fullName}</p>
              <p className="text-xs text-slate-500">{user.roleLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close admin menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map(({ group, sections }) => (
            <div key={group} className="mb-4">
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {group}
              </p>
              <ul className="space-y-1">
                {sections.map((section) => {
                  // section.icon is a NAME (strings survive the server->client
                  // boundary; components do not), so look the component up here.
                  const Icon = ADMIN_ICONS[section.icon];
                  const isActive =
                    section.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(section.href);
                  const count = section.countKey ? counts[section.countKey] : 0;

                  return (
                    <li key={section.href}>
                      <Link
                        href={section.href}
                        className={cn(
                          "flex min-h-[44px] items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-primary-50 font-semibold text-primary-700"
                            : "text-slate-600 hover:bg-slate-50",
                        )}
                      >
                        <Icon size={18} />
                        <span className="flex-1 truncate">{section.label}</span>
                        {count > 0 && (
                          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                            {count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <Link
            href="/"
            className="flex min-h-[44px] items-center rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Back to the student app
          </Link>
          <LogoutButton />
        </div>
      </div>
    </>
  );
}
