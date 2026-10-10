/**
 * src/app/projects/page.tsx
 * WHAT: The Project Hub list page.
 * WHY : A protected collaboration space: teasers public, full pitches gated.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { ProjectListClient } from "@/components/projects/ProjectListClient";

export const metadata = { title: "Project hub" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getSessionUser();
  if (user?.role === "LANDLORD") redirect("/landlord");

  return (
    <PageTransition>
      <PageHeader
        title="Project Hub"
        subtitle="Find co-founders. Blind pitches keep your idea safe until you approve someone."
      />
      <ProjectListClient />
    </PageTransition>
  );
}
