/**
 * src/app/admin/verifications/page.tsx
 * WHAT: The verification review queue - documents, one at a time, oldest first.
 * WHY : This is the gate that keeps the platform honest. Ordering oldest-first
 *       means nobody waits behind a newer submission.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isStaff } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { VerificationQueueClient } from "@/components/admin/VerificationQueueClient";

export const metadata = { title: "Verification queue" };
export const dynamic = "force-dynamic";

/**
 * VerificationsPage
 * WHAT: Counts each status and hands the pending list to the client queue.
 */
export default async function VerificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/admin/verifications");
  // Staff only: ADMIN or SUPER_ADMIN. Students and landlords go home.
  if (!isStaff(user.role)) redirect("/");

  const counts = await prisma.verificationRecord.groupBy({ by: ["status"], _count: { _all: true } });

  return (
    <PageTransition>
      <PageHeader
        back
        backHref="/admin"
        title="Verification queue"
        subtitle="Check the document, check the number ends in the same digits, then decide"
      />

      <VerificationQueueClient
        counts={counts.reduce<Record<string, number>>((accumulator, row) => {
          accumulator[row.status] = row._count._all;
          return accumulator;
        }, {})}
      />
    </PageTransition>
  );
}
