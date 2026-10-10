/**
 * src/app/food/page.tsx
 * WHAT: The campus food directory page.
 * WHY : A showcase of food spots near the viewer's campus - order through
 *       WhatsApp, visit vendor websites. No cart, no in-app checkout.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { FoodDirectoryClient } from "@/components/food/FoodDirectoryClient";
import { FloatingBudgetButton } from "@/components/layout/FloatingBudgetButton";

export const metadata = { title: "Food directory" };
export const dynamic = "force-dynamic";

/**
 * FoodPage
 * WHAT: Server wrapper - landlords get their own dashboard instead.
 */
export default async function FoodPage() {
  const user = await getSessionUser();
  // Landlords have a restricted experience; food browsing is for students.
  if (user?.role === "LANDLORD") redirect("/landlord");

  return (
    <PageTransition>
      <PageHeader
        title="Food Directory"
        subtitle="Campus-approved food spots. Order straight through WhatsApp - we never touch your food money."
      />
      <FoodDirectoryClient />
      <FloatingBudgetButton />
    </PageTransition>
  );
}
