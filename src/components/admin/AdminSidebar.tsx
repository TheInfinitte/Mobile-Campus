/**
 * src/components/admin/AdminSidebar.tsx
 * WHAT: The desktop navigation rail for the admin area. Shows the staff
 *       member's name and role tier, the grouped section links with live
 *       queue-count badges, and a sign-out button.
 * WHY : A server component, so it can read the session and render links
 *       The count badges are the point: an admin should see "Verification
 *       queue (12)" and know where to go first without clicking around.
 *
 * It is a client component because highlighting the current link needs
 * usePathname(), which only exists in the browser. Everything it needs
 * (the filtered section list and the counts) is passed in from the server
 * layout, so no admin ever receives a link their tier cannot open.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_ICONS, type AdminCounts, type AdminSection } from "@/lib/admin-nav";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { ShieldIcon } from "@/components/ui/Icons";

/** Props: who is signed in, the live badge numbers, and the sections to show. */
interface AdminSidebarProps {
  user: { fullName: string; roleLabel: string };
  counts: AdminCounts;
  /** Already grouped under headings and already filtered for this admin's tier. */
  groups: { group: string; sections: AdminSection[] }[];
}

/**
 * AdminSidebar
 * WHAT: Renders the desktop-only sidebar (hidden below the lg breakpoint,
 *       where the mobile drawer takes over).
 */
export function AdminSidebar({ user, counts, groups }: AdminSidebarProps) {
  // Live path, from the browser - always correct, even on a hard refresh.
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      {/* --- Header: who is signed in --- */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white">
          <ShieldIcon size={20} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{user.fullName}</p>
          {/* The tier matters: SUPER_ADMIN sees the user-management section. */}
          <p className="text-xs text-slate-500">{user.roleLabel}</p>
        </div>
      </div>

      {/* --- Section links, grouped --- */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map(({ group, sections }) => (
          <div key={group} className="mb-5">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {group}
            </p>
            <ul className="space-y-1">
              {sections.map((section) => {
                // section.icon is a NAME (strings survive the server->client
                // boundary; components do not), so look the component up here.
                const Icon = ADMIN_ICONS[section.icon];
                // The dashboard link is exact-match; the rest match their prefix.
                const isActive =
                  section.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(section.href);
                const count = section.countKey ? counts[section.countKey] : 0;

                return (
                  <li key={section.href}>
                    <Link
                      href={section.href}
                      title={section.hint}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors",
                        isActive
                          ? "bg-primary-50 font-semibold text-primary-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      )}
                    >
                      <Icon size={18} />
                      <span className="flex-1 truncate">{section.label}</span>
                      {/* Only show the badge when there is actually work waiting. */}
                      {count > 0 && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            isActive ? "bg-primary-600 text-white" : "bg-danger/10 text-danger",
                          )}
                        >
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

      {/* --- Footer: back to the app, and sign out --- */}
      <div className="border-t border-slate-100 p-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
        >
          Back to the student app
        </Link>
        <LogoutButton />
      </div>
    </aside>
  );
}
