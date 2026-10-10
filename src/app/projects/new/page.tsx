/**
 * src/app/projects/new/page.tsx
 * WHAT: The blind-pitch creation page.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { ProjectFormClient } from "@/components/projects/ProjectFormClient";

export const metadata = { title: "Pitch a project" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/projects/new");
  if (user.role !== "STUDENT") redirect("/projects");

  return (
    <PageTransition>
      <PageHeader back backHref="/projects" title="Pitch a project" subtitle="Public teaser + private full pitch. You approve who sees more." />
      <ProjectFormClient />
    </PageTransition>
  );
}
