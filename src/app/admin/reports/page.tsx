/**
 * src/app/admin/reports/page.tsx
 * WHAT: The scam and abuse report queue.
 * WHY : Reports are how students protect each other. A fake listing left up for a
 *       day can cost somebody a whole term's rent, so this queue is one tap from
 *       the dashboard.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isStaff } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { ReportQueueClient } from "@/components/admin/ReportQueueClient";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

/**
 * ReportsPage
 * WHAT: Counts reports by status and hands the queue to the client.
 */
export default async function ReportsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/admin/reports");
  // Staff only: ADMIN or SUPER_ADMIN. Students and landlords go home.
  if (!isStaff(user.role)) redirect("/");

  const counts = await prisma.report.groupBy({ by: ["status"], _count: { _all: true } });

  return (
    <PageTransition>
      <PageHeader back backHref="/admin" title="Reports" subtitle="Every report names the person who filed it, so you can call them" />

      <ReportQueueClient
        counts={counts.reduce<Record<string, number>>((accumulator, row) => {
          accumulator[row.status] = row._count._all;
          return accumulator;
        }, {})}
      />
    </PageTransition>
  );
}
