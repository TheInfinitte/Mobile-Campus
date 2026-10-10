/**
 * src/app/gigs/new/page.tsx
 * WHAT: The "post a task" page for micro-gigs.
 * WHY : Only signed-in students may post, so the guard runs on the server before
 *       the form is even rendered.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { GigForm } from "@/components/gigs/GigForm";

export const metadata = { title: "Post a task" };
export const dynamic = "force-dynamic";

/**
 * NewGigPage
 * WHAT: Guards and renders the gig form.
 */
export default async function NewGigPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/gigs/new");
  if (user.role !== "STUDENT") redirect("/gigs");

  return (
    <PageTransition>
      <PageHeader back backHref="/gigs" title="Post a task" subtitle="A student nearby will pick it up" />
      <GigForm />
    </PageTransition>
  );
}
