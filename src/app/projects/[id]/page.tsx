/**
 * src/app/projects/[id]/page.tsx
 * WHAT: One project's page - teaser, lock/unlock, application, owner queue.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { ProjectDetailClient } from "@/components/projects/ProjectDetailClient";

export const metadata = { title: "Project" };
export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

export default async function ProjectDetailPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (user?.role === "LANDLORD") redirect("/landlord");

  return (
    <PageTransition>
      <PageHeader back backHref="/projects" title="Project" />
      <ProjectDetailClient id={params.id} />
    </PageTransition>
  );
}
