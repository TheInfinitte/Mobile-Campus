/**
 * src/app/admin/fees/page.tsx
 * WHAT: The fee configuration editor - the single source of truth for what the
 *       platform charges.
 * WHY : Fees are never hard-coded anywhere in this codebase. Every payment screen,
 *       every webhook and every escrow payout reads from this table, so changing a
 *       number here changes the whole platform instantly.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isStaff } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { FeeEditor } from "@/components/admin/FeeEditor";

export const metadata = { title: "Fee configuration" };
export const dynamic = "force-dynamic";

/**
 * FeesPage
 * WHAT: Loads every fee rule and renders the editor.
 */
export default async function FeesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/admin/fees");
  // Staff only: ADMIN or SUPER_ADMIN. Students and landlords go home.
  if (!isStaff(user.role)) redirect("/");

  const fees = await prisma.feeConfig.findMany({ orderBy: { key: "asc" } });

  return (
    <PageTransition>
      <PageHeader
        back
        backHref="/admin"
        title="Fee configuration"
        subtitle="Every payment on the platform reads from this table"
      />

      <FeeEditor
        fees={fees.map((fee) => ({
          id: fee.id,
          key: fee.key,
          label: fee.label,
          percent: fee.percent,
          fixedKobo: fee.fixedKobo,
          minimumKobo: fee.minimumKobo,
          maximumKobo: fee.maximumKobo,
          payer: fee.payer,
          isActive: fee.isActive,
          updatedAt: fee.updatedAt.toISOString(),
        }))}
      />
    </PageTransition>
  );
}
