/**
 * src/app/market/new/page.tsx
 * WHAT: The "sell an item" page.
 * WHY : Selling is how the marketplace fills up. The page checks the account on
 *       the server so only students reach the form.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { MarketItemForm } from "@/components/market/MarketItemForm";

export const metadata = { title: "Sell an item" };
export const dynamic = "force-dynamic";

/**
 * NewMarketItemPage
 * WHAT: Guards the form and renders it.
 */
export default async function NewMarketItemPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/market/new");
  if (user.role !== "STUDENT") redirect("/market");

  // A final-year student can flag their items as a graduating drop.
  const level = (user.level ?? "").toLowerCase();
  const isFinalYear = level.includes("400") || level.includes("500") || level.includes("final");

  return (
    <PageTransition>
      <PageHeader back backHref="/market" title="Sell an item" subtitle="Other DELSU students are looking right now" />
      <MarketItemForm isFinalYear={isFinalYear} />
    </PageTransition>
  );
}
