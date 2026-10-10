/**
 * src/components/layout/DesktopNav.tsx
 * WHAT: The navigation for tablets and desktops. The category links live in
 *       exactly one place per breakpoint, never both:
 *         below md  -> BottomNav (phone)
 *         md to lg  -> this file's top bar link row (tablet)
 *         lg and up -> this file's left sidebar (desktop)
 * WHY : Bottom navigation is wrong on a 1440px monitor. But showing the same
 *       links in the top bar AND the sidebar - which is what the old xl
 *       sidebar did - was pure duplication. Splitting by breakpoint means the
 *       sidebar is the sole desktop navigation.
 *
 * ROLE-AWARE + MULTI-CAMPUS:
 *   - Landlords get a property-only nav: they never see marketplace, gigs or
 *     student social spaces.
 *   - Students get the full campus: Roommates, Community, Projects, Study Vault.
 *   - The brand line shows the viewer's own institution (e.g. "UNIBEN").
 *
 * This component is hidden below the `md` breakpoint, where BottomNav takes over.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BagIcon,
  BellIcon,
  BoltIcon,
  CapIcon,
  ChartIcon,
  ChatIcon,
  HomeIcon,
  LogoutIcon,
  PeopleIcon,
  SendIcon,
  ShieldIcon,
  SparkleIcon,
  TaskIcon,
  UserIcon,
} from "@/components/ui/Icons";
import { Avatar } from "@/components/ui/SmartImage";
import { useInstitution } from "@/hooks/useInstitutionAreas";
import { initials } from "@/lib/utils";
import type { User } from "@prisma/client";

/** Student-facing links: the full campus experience. */
const STUDENT_LINKS = [
  { href: "/housing", label: "Housing", Icon: HomeIcon },
  { href: "/market", label: "Marketplace", Icon: BagIcon },
  { href: "/gigs", label: "Micro-gigs", Icon: TaskIcon },
  { href: "/food", label: "Food", Icon: BagIcon },
  { href: "/errands", label: "Errands", Icon: SendIcon },
  { href: "/emergency", label: "Urgent 2k", Icon: BoltIcon },
  { href: "/roommates", label: "Roommates", Icon: PeopleIcon },
  { href: "/community", label: "Community", Icon: ChatIcon },
  { href: "/projects", label: "Projects", Icon: BoltIcon },
  { href: "/study", label: "Study Vault", Icon: CapIcon },
  { href: "/budget", label: "Budget AI", Icon: SparkleIcon },
] as const;

/** Landlord links: real estate business only. */
const LANDLORD_LINKS = [
  { href: "/housing", label: "Housing", Icon: HomeIcon },
  { href: "/landlord", label: "My listings", Icon: ShieldIcon },
  { href: "/escrow", label: "Payments", Icon: TaskIcon },
] as const;

type DesktopNavProps = {
  user: User | null;
  unreadCount: number;
};

/**
 * DesktopNav
 * WHAT: Top bar + sidebar for md and up.
 * WHY : Keeps large screens usable without duplicating page content.
 */
export function DesktopNav({ user, unreadCount }: DesktopNavProps) {
  const pathname = usePathname();
  const isAdmin = user?.role === "ADMIN";
  const isLandlord = user?.role === "LANDLORD";
  const institution = useInstitution();

  // Landlords see only property links; everyone else the full campus.
  const links = isLandlord ? LANDLORD_LINKS : STUDENT_LINKS;

  return (
    <>
      {/* ------------------------- TOP BAR ------------------------------- */}
      <header className="sticky top-0 z-40 hidden border-b border-slate-200 bg-white/90 backdrop-blur-md md:block">
        {/* Left-aligned, same max-w-7xl column as the page content below, so
            the header and the content share one edge instead of the header
            floating in the middle on wide monitors. */}
        <div className="flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6">
          {/* Brand - the campus line follows the signed-in institution. */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-sm font-black text-white">
              MC
            </span>
            <span className="hidden leading-tight lg:block">
              <span className="block text-sm font-extrabold tracking-tight text-slate-900">Mobile Campus</span>
              <span className="block text-[11px] text-slate-500">{institution?.shortName ?? "Multi-campus"}</span>
            </span>
          </Link>

          {/* Primary links - TABLET ONLY (md to lg).
              From lg upwards the sidebar below becomes the primary navigation,
              so repeating these exact links in the top bar was pure
              duplication. Hiding the bar's links at lg leaves a clean header
              (brand + notifications + account) next to the sidebar. */}
          <nav aria-label="Primary" className="flex flex-1 items-center gap-1 overflow-x-auto hide-scrollbar lg:hidden">
            {links.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors",
                    active ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              );
            })}

            {/* Admins get the dashboard. */}
            {isAdmin ? (
              <Link
                href="/admin"
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors",
                  pathname.startsWith("/admin") ? "bg-gold-50 text-gold-800" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <ChartIcon size={18} />
                Admin
              </Link>
            ) : null}
          </nav>

          {/* Right side: notifications + account.
              ml-auto keeps it pinned right once the tablet link bar hides at
              lg - without it the two flex children would sit side by side. */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              href="/notifications"
              aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100"
            >
              <BellIcon size={20} />
              {unreadCount > 0 ? (
                <span className="absolute right-2 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>

            {user ? (
              <Link href="/profile" className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-100">
                <Avatar src={user.avatarUrl} name={user.fullName} size={34} />
                <span className="hidden text-left leading-tight xl:block">
                  <span className="block text-sm font-semibold text-slate-900">{user.fullName.split(" ")[0]}</span>
                  <span className="block text-[11px] text-slate-500">
                    {user.role === "ADMIN"
                      ? "Administrator"
                      : user.role === "LANDLORD"
                        ? user.landlordType === "AGENT"
                          ? "Agent / Rep"
                          : "Landlord"
                        : user.verificationStatus === "PROVISIONAL"
                          ? "Fresher"
                          : "Student"}
                  </span>
                </span>
              </Link>
            ) : (
              <Link href="/auth/login" className="mc-btn-primary h-10 px-4">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------- SIDEBAR (lg+) -------------------------- */}
      {/* Primary navigation on desktop. It was xl-only while the top bar kept
          showing the same links; now the split is clean:
            below md  -> BottomNav (phone)
            md to lg  -> the top bar's link row (tablet)
            lg and up -> this sidebar only (desktop)
          Shell offsets the content by this sidebar's width from the same lg
          breakpoint, so the two must always change together. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 bg-white pt-16 lg:block" aria-label="Section navigation">
        <nav className="flex h-full flex-col gap-1 overflow-y-auto p-4">
          <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {isLandlord ? "Property" : "Explore"}
          </p>

          {links.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                  active ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}

          <p className="px-3 pb-2 pt-5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Account</p>

          <Link
            href="/profile"
            className={cn(
              "inline-flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
              pathname.startsWith("/profile") ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <UserIcon size={18} />
            My profile
          </Link>

          {/* Shortlists are a student feature. */}
          {!isLandlord ? (
            <Link
              href="/shortlist"
              className={cn(
                "inline-flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                pathname.startsWith("/shortlist") ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <BagIcon size={18} />
              My shortlist
            </Link>
          ) : null}

          <Link
            href="/escrow"
            className={cn(
              "inline-flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
              pathname.startsWith("/escrow") ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <ShieldIcon size={18} />
            My payments
          </Link>

          {isAdmin ? (
            <>
              <p className="px-3 pb-2 pt-5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Moderation</p>
              <Link
                href="/admin"
                className={cn(
                  "inline-flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                  pathname === "/admin" ? "bg-gold-50 text-gold-800" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <ChartIcon size={18} />
                Admin dashboard
              </Link>
              <Link
                href="/admin/study"
                className={cn(
                  "inline-flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                  pathname.startsWith("/admin/study") ? "bg-gold-50 text-gold-800" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <CapIcon size={18} />
                Study approvals
              </Link>
              <Link
                href="/admin/community"
                className={cn(
                  "inline-flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                  pathname.startsWith("/admin/community") ? "bg-gold-50 text-gold-800" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <ChatIcon size={18} />
                Community mod
              </Link>
            </>
          ) : null}

          {/* Logout posts to the auth API. A form (not a link) because logout
              changes server state. */}
          <form action="/api/auth/logout" method="post" className="mt-auto pt-4">
            <button type="submit" className="inline-flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-danger">
              <LogoutIcon size={18} />
              Sign out
            </button>
          </form>
        </nav>
      </aside>
    </>
  );
}

/** Exported so the header can show initials without importing utils twice. */
export { initials };
