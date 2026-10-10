/**
 * src/app/community/page.tsx
 * WHAT: The moderated community board page.
 * WHY : Students talk with real names by default and can go anonymous for
 *       sensitive topics. Landlords are redirected - this is a student space.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { CommunityBoard } from "@/components/community/CommunityBoard";

export const metadata = { title: "Community board" };
export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const user = await getSessionUser();
  if (user?.role === "LANDLORD") redirect("/landlord");

  return (
    <PageTransition>
      <PageHeader
        title="Community Board"
        subtitle="Campus gist, questions and confessions from your school only."
      />
      <CommunityBoard />
    </PageTransition>
  );
}
