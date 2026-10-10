/**
 * src/app/roommates/new/page.tsx
 * WHAT: The "post on the roommate board" page.
 * WHY : Only verified students may post - that rule keeps scammers off the board,
 *       and it is enforced here as well as in the API route.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { Card } from "@/components/ui/Card";
import { RoommatePostForm } from "@/components/roommates/RoommatePostForm";
import { ShieldIcon } from "@/components/ui/Icons";

export const metadata = { title: "Post on the roommate board" };
export const dynamic = "force-dynamic";

/**
 * NewRoommatePostPage
 * WHAT: Guards the form and renders it.
 */
export default async function NewRoommatePostPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/roommates/new");
  if (user.role !== "STUDENT") redirect("/roommates");

  return (
    <PageTransition>
      <PageHeader back backHref="/roommates" title="Post on the board" subtitle="Tell students who you need and what you can spend" />

      {!user.isVerified ? (
        <Card className="mb-4 border border-warn/30 bg-warn-light">
          <div className="flex items-start gap-2.5">
            <ShieldIcon size={18} className="mt-0.5 shrink-0 text-warn-dark" />
            <div>
              <p className="text-sm font-bold text-warn-dark">Verify first</p>
              <p className="mt-1 text-xs leading-relaxed text-warn-dark/90">
                The roommate board is only open to verified students. It keeps scammers away from people who are about to share
                a room and split rent with a stranger.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <RoommatePostForm />
      )}
    </PageTransition>
  );
}
