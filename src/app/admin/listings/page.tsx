/**
 * src/app/admin/listings/page.tsx
 * WHAT: Every listing on the platform, with controls to take one down or bring it
 *       back.
 * WHY : When a scam report comes in, the admin needs to see the listing, its
 *       landlord and its history in one place, and be able to hide it immediately.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isStaff } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { ListingsClient } from "@/components/admin/ListingsClient";

export const metadata = { title: "All listings" };
export const dynamic = "force-dynamic";

/**
 * ListingsPage
 * WHAT: Counts listings per status and renders the client table.
 */
export default async function ListingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/admin/listings");
  // Staff only: ADMIN or SUPER_ADMIN. Students and landlords go home.
  if (!isStaff(user.role)) redirect("/");

  const counts = await prisma.lodge.groupBy({ by: ["status"], _count: { _all: true } });

  return (
    <PageTransition>
      <PageHeader back backHref="/admin" title="All listings" subtitle="Search, take down or restore any room on the platform" />

      <ListingsClient
        counts={counts.reduce<Record<string, number>>((accumulator, row) => {
          accumulator[row.status] = row._count._all;
          return accumulator;
        }, {})}
      />
    </PageTransition>
  );
}
