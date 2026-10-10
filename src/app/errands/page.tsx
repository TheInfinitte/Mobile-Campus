/**
 * src/app/errands/page.tsx
 * WHAT: The campus errands board page.
 * WHY : Strictly non-food peer-to-peer logistics - document drops, item
 *       handovers, key runs. Posters set pickup/drop-off/fee; movers claim.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { ErrandBoardClient } from "@/components/errands/ErrandBoardClient";
import { FloatingBudgetButton } from "@/components/layout/FloatingBudgetButton";

export const metadata = { title: "Campus errands" };
export const dynamic = "force-dynamic";

/**
 * ErrandsPage
 * WHAT: Server wrapper - landlords are redirected to their own dashboard.
 */
export default async function ErrandsPage() {
  const user = await getSessionUser();
  if (user?.role === "LANDLORD") redirect("/landlord");

  return (
    <PageTransition>
      <PageHeader
        title="Campus Errands"
        subtitle="Someone is always heading your way. Post a drop-off, or claim one and earn."
      />
      <ErrandBoardClient />
      <FloatingBudgetButton />
    </PageTransition>
  );
}
