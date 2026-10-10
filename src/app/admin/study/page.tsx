/**
 * src/app/admin/study/page.tsx
 * WHAT: Study Vault approvals.
 */
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { StudyQueueClient } from "@/components/admin/StudyQueueClient";

export const metadata = { title: "Study approvals" };
export const dynamic = "force-dynamic";

export default async function AdminStudyPage() {
  await requireAdmin();
  return (
    <PageTransition>
      <PageHeader back backHref="/admin" title="Study approvals" subtitle="Approve uploads to put them live and pay the uploader in credits." />
      <StudyQueueClient />
    </PageTransition>
  );
}
