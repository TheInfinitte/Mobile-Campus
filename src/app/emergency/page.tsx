/**
 * src/app/emergency/page.tsx
 * WHAT: The "Urgent 2k" peer-to-peer goodwill board.
 * WHY : Students helping students directly. The platform lends nothing, holds
 *       no money and charges no fee - it only verifies identity and protects
 *       the dignity of anyone who has to ask.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { GoodwillClient } from "@/components/emergency/GoodwillClient";
import { FloatingBudgetButton } from "@/components/layout/FloatingBudgetButton";

export const metadata = { title: "Urgent 2k" };
export const dynamic = "force-dynamic";

/**
 * EmergencyPage
 * WHAT: Server wrapper - students only; landlords get their own dashboard.
 */
export default async function EmergencyPage() {
  const user = await getSessionUser();
  if (user?.role === "LANDLORD") redirect("/landlord");
  if (user?.role === "ADMIN") redirect("/admin/emergency");

  return (
    <PageTransition>
      <PageHeader
        title="Urgent 2k"
        subtitle="Students helping students. No loans, no interest, no fees - and nothing to repay."
      />
      <GoodwillClient />
      <FloatingBudgetButton />
    </PageTransition>
  );
}
