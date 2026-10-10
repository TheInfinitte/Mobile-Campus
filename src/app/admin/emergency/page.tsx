/**
 * src/app/admin/emergency/page.tsx
 * WHAT: Admin console for the Urgent 2k goodwill board.
 * WHY : Anonymity protects students from each other, never from moderation -
 *       and an automated 7-day pause must always be reversible by a human.
 */
import { redirect } from "next/navigation";
import { getSessionUser, isStaff } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { GoodwillAdminClient } from "@/components/admin/GoodwillAdminClient";

export const metadata = { title: "Emergency advances" };
export const dynamic = "force-dynamic";

/**
 * AdminEmergencyPage
 * WHAT: Server guard - admins only - then the console.
 */
export default async function AdminEmergencyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/admin/emergency");
  // Staff only: ADMIN or SUPER_ADMIN. Students and landlords go home.
  if (!isStaff(user.role)) redirect("/");

  return (
    <PageTransition>
      <PageHeader back backHref="/admin" title="Urgent 2k" subtitle="Goodwill board moderation, commitment trail and pause reviews." />
      <GoodwillAdminClient />
    </PageTransition>
  );
}
