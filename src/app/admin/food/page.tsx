/**
 * src/app/admin/food/page.tsx
 * WHAT: Admin page for moderating the food directory.
 * WHY : Student suggestions go live only after an admin checks them, and the
 *       sponsored slots (the directory's monetisation) are managed here too.
 */
import { redirect } from "next/navigation";
import { getSessionUser, isStaff } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { FoodQueueClient } from "@/components/admin/FoodQueueClient";

export const metadata = { title: "Food directory moderation" };
export const dynamic = "force-dynamic";

/**
 * AdminFoodPage
 * WHAT: Server guard - admins only - then the moderation queue.
 */
export default async function AdminFoodPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/admin/food");
  // Staff only: ADMIN or SUPER_ADMIN. Students and landlords go home.
  if (!isStaff(user.role)) redirect("/");

  return (
    <PageTransition>
      <PageHeader back backHref="/admin" title="Food Directory" subtitle="Approve suggested spots and manage sponsored slots." />
      <FoodQueueClient />
    </PageTransition>
  );
}
