/**
 * src/app/admin/disputes/page.tsx
 * WHAT: The dispute resolution queue.
 * WHY : A dispute means real money is frozen and two students are waiting. This
 *       queue shows both sides, the amount and the evidence in one place.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isStaff } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { DisputeQueueClient } from "@/components/admin/DisputeQueueClient";

export const metadata = { title: "Disputes" };
export const dynamic = "force-dynamic";

/**
 * DisputesPage
 * WHAT: Counts open versus resolved and renders the client queue.
 */
export default async function DisputesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/admin/disputes");
  // Staff only: ADMIN or SUPER_ADMIN. Students and landlords go home.
  if (!isStaff(user.role)) redirect("/");

  const [open, underReview, resolved] = await Promise.all([
    prisma.dispute.count({ where: { status: "OPEN" } }),
    prisma.dispute.count({ where: { status: "UNDER_REVIEW" } }),
    // Both outcomes count as "resolved" for the dashboard number.
    prisma.dispute.count({ where: { status: { in: ["RESOLVED_FOR_PAYER", "RESOLVED_FOR_PAYEE"] } } }),
  ]);

  // Money currently frozen by disputes - the number that makes this urgent.
  const frozen = await prisma.escrowTransaction.aggregate({
    where: { state: "DISPUTED" },
    _sum: { totalKobo: true },
  });

  return (
    <PageTransition>
      <PageHeader back backHref="/admin" title="Disputes" subtitle="Money stays frozen until you decide who it belongs to" />

      <DisputeQueueClient
        counts={{ OPEN: open, UNDER_REVIEW: underReview, RESOLVED_FOR_PAYER: resolved }}
        frozenKobo={frozen._sum.totalKobo ?? 0}
      />
    </PageTransition>
  );
}
