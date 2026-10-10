/**
 * src/app/admin/users/page.tsx
 * WHAT: The platform-owner screen for managing accounts - search, suspend,
 *       lift suspensions, change roles, save private notes.
 * WHY : These are the most dangerous actions in the product, so this page is
 *       the only admin page with a stricter guard than "is staff": it requires
 *       SUPER_ADMIN specifically. An ordinary ADMIN who navigates here by
 *       typing the URL is sent back to /admin.
 *
 * The guard is repeated at three layers on purpose:
 *   1. middleware      - bounces anyone with no valid signed cookie
 *   2. admin layout    - redirects an ADMIN away from /admin/users
 *   3. this page       - the last check before any data is loaded
 * Plus the API route itself calls requireSuperAdmin(), so a direct request to
 * /api/admin/users is refused no matter what the browser showed.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { searchUsers } from "@/lib/user-admin";
import { UserAdminClient, type AdminUserRow } from "@/components/admin/UserAdminClient";

export const metadata = { title: "User management" };
// Never cache: suspension state must be current.
export const dynamic = "force-dynamic";

/**
 * AdminUsersPage
 * WHAT: Guards for SUPER_ADMIN, loads the first page of accounts, renders the UI.
 */
export default async function AdminUsersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/admin/users");

  // SUPER_ADMIN only. Ordinary admins are redirected - not shown an error,
  // because they are trusted staff, they just cannot do this particular thing.
  if (user.role !== "SUPER_ADMIN") redirect("/admin");

  // Start with the newest accounts and no filter, so the page is never empty.
  const users = await searchUsers("");

  // Dates become strings across the server/client boundary.
  const initialUsers: AdminUserRow[] = users.map((u) => ({
    ...u,
    bannedUntil: u.bannedUntil ? u.bannedUntil.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  }));

  return <UserAdminClient initialUsers={initialUsers} currentUserId={user.id} />;
}
