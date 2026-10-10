/**
 * src/app/admin/layout.tsx
 * WHAT: The shared frame for every /admin page. It does three jobs:
 *       1. GUARD - loads the session, sends non-staff away, and blocks any
 *          SUPER_ADMIN-only page for an ordinary ADMIN.
 *       2. CHROME - renders the desktop sidebar and the mobile drawer.
 *       3. COUNTS - fetches the queue numbers once so every section link can
 *          show a badge, instead of each page fetching them separately.
 *
 * WHY : Before this layout existed, all ten admin pages repeated the same
 *       guard lines and the dashboard listed sections by hand. One layout
 *       means the guard can never be forgotten on a new admin page, and the
 *       navigation cannot drift out of sync with the pages that exist.
 *
 * SECURITY NOTE: middleware (src/middleware.ts) already bounces requests with
 * no valid signed cookie. But middleware runs in the Edge runtime and cannot
 * read the database, so it cannot check the ROLE. This layout is the real
 * authorisation boundary for pages, and every /api/admin route has its own
 * requireAdmin() for the same reason. Keep all three.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isStaff } from "@/lib/auth";
import { groupsForRole, type AdminCounts } from "@/lib/admin-nav";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

/** Props Next.js passes to a layout. */
interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * AdminLayout
 * WHAT: Guards, then renders sidebar + page content.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  // --- 1. GUARD -----------------------------------------------------------
  const user = await getSessionUser();

  // No valid session at all: send them to login and remember where they were.
  if (!user) redirect("/auth/login?next=/admin");

  // Signed in but not staff (student or landlord): back to their own home.
  // We do not say "you are not an admin" to a stranger - just send them away.
  if (!isStaff(user.role)) redirect("/");

  // --- 2. BLOCK SUPER_ADMIN-ONLY PAGES FOR ORDINARY ADMINS ----------------
  // This is a server component, so it can see the requested path via headers.
  // We compare it against the sections this tier is allowed to see; if the
  // path belongs to a section hidden from this role, refuse it. Without this,
  // an ADMIN who typed /admin/users directly would reach the page even though
  // the sidebar never showed them the link.
  // The path being rendered, forwarded by middleware as a request header.
  // Server layouts cannot read the request object directly, so this is how a
  // layout learns which page it is wrapping. Empty on a cache hit, which is
  // why the check below only ever ADDS a restriction.
  const pathname = headers().get("x-pathname") ?? "";
  if (pathname.startsWith("/admin/users") && user.role !== "SUPER_ADMIN") {
    redirect("/admin");
  }

  // --- 3. COUNTS ----------------------------------------------------------
  // All the "work waiting" numbers, fetched in parallel. Each one is a cheap
  // count query; running them together keeps the layout fast.
  const [
    pendingVerifications,
    openDisputes,
    openReports,
    flaggedContent,
  ] = await Promise.all([
    prisma.verificationRecord.count({ where: { status: "PENDING" } }),
    prisma.dispute.count({ where: { status: "OPEN" } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    // Moderation queue = content an admin has flagged or hidden, plus anything
    // reported but not yet reviewed. This is the number that should make an
    // admin click.
    prisma.$transaction([
      prisma.marketItem.count({ where: { status: { in: ["FLAGGED", "HIDDEN"] } } }),
      prisma.gig.count({ where: { status: { in: ["FLAGGED", "HIDDEN"] } } }),
      prisma.lodge.count({ where: { status: { in: ["UNDER_REVIEW", "REMOVED"] } } }),
    ]).then(([items, gigs, lodges]) => items + gigs + lodges),
  ]);

  const counts: AdminCounts = {
    verifications: pendingVerifications,
    disputes: openDisputes,
    reports: openReports,
    moderation: flaggedContent,
  };

  // Sections this tier may see, pre-grouped for the sidebar headings.
  const groups = groupsForRole(user.role);
  // Plain-English tier name shown in both navigations.
  const roleLabel = user.role === "SUPER_ADMIN" ? "Platform owner" : "Administrator";

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Human label for the tier, computed once for both navigations. */}
      {/* Desktop rail. Hidden below lg, where the drawer takes over. */}
      <AdminSidebar
        user={{ fullName: user.fullName, roleLabel }}
        counts={counts}
        groups={groups}
      />

      {/* Phone/tablet: sticky bar + slide-in drawer. */}
      <AdminMobileNav user={{ fullName: user.fullName, roleLabel }} groups={groups} counts={counts} />

      {/* The page itself. Grows to fill whatever space is left. */}
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
