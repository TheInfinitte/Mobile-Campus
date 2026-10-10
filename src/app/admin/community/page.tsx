/**
 * src/app/admin/community/page.tsx
 * WHAT: Community board moderation with true identities.
 */
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { CommunityQueueClient } from "@/components/admin/CommunityQueueClient";

export const metadata = { title: "Community moderation" };
export const dynamic = "force-dynamic";

export default async function AdminCommunityPage() {
  await requireAdmin();
  return (
    <PageTransition>
      <PageHeader back backHref="/admin" title="Community moderation" subtitle="Anonymous aliases are public-facing; the true author is shown here." />
      <CommunityQueueClient />
    </PageTransition>
  );
}
