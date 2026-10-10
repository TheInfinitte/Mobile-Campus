/**
 * src/app/admin/moderation/page.tsx
 * WHAT: The content moderation page - flagged and hidden market items, gigs
 *       and room listings, with flag / hide / restore / delete actions.
 * WHY : Until this page existed, an admin could moderate roommate posts and
 *       food spots but had no way at all to take down a fraudulent market
 *       listing or a gig post, because those two models had no moderation
 *       state to move them into. This closes that gap.
 *
 * The queue is fetched here on the server and handed to the client component
 * as plain data. That keeps the student-facing tables out of the browser
 * bundle and means the page cannot render before the guard has run.
 */
import { redirect } from "next/navigation";
import { getSessionUser, isStaff } from "@/lib/auth";
import { moderationQueue } from "@/lib/moderation";
import { ModerationClient, type ModerationRow } from "@/components/admin/ModerationClient";

export const metadata = { title: "Content moderation" };
// Admin queues must never be cached - another admin may have just acted.
export const dynamic = "force-dynamic";

/**
 * AdminModerationPage
 * WHAT: Guards the page, loads the queue, renders the client UI.
 */
export default async function AdminModerationPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/admin/moderation");
  // Staff only: ADMIN or SUPER_ADMIN. Students and landlords go home.
  if (!isStaff(user.role)) redirect("/");

  const { rows, openReports } = await moderationQueue();

  // Counts per content type for the header badges.
  const counts = {
    MARKET_ITEM: rows.filter((r) => r.type === "MARKET_ITEM").length,
    GIG: rows.filter((r) => r.type === "GIG").length,
    LODGE: rows.filter((r) => r.type === "LODGE").length,
  };

  // Dates cross the server/client boundary as strings, so convert them here
  // rather than relying on Date objects surviving the serialisation.
  const initialRows: ModerationRow[] = rows.map((r) => ({
    type: r.type,
    id: r.id,
    title: r.title,
    status: r.status,
    owner: r.owner,
    openReports: r.openReports,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return <ModerationClient initialRows={initialRows} counts={counts} openReports={openReports} />;
}
