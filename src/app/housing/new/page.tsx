/**
 * src/app/housing/new/page.tsx
 * WHAT: The "list your lodge" page for verified landlords.
 * WHY : Landlords must be able to add a property from a phone in a few minutes.
 *       Access is checked on the server so nobody without the right account even
 *       sees the form.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { Card } from "@/components/ui/Card";
import { LodgeForm } from "@/components/housing/LodgeForm";
import { ShieldIcon } from "@/components/ui/Icons";

export const metadata = { title: "List your lodge" };
export const dynamic = "force-dynamic";

/**
 * NewLodgePage
 * WHAT: Guards the form and renders it.
 * WHY : Only a verified landlord may create a listing - that rule is enforced
 *       here AND in the API route (defence in depth).
 */
export default async function NewLodgePage() {
  const user = await getSessionUser();

  // Not signed in -> send them to sign in, then back here.
  if (!user) redirect("/auth/login?next=/housing/new");
  // Signed in but not a landlord -> they have nothing to list.
  if (user.role !== "LANDLORD") redirect("/housing");

  return (
    <PageTransition>
      <PageHeader back backHref="/housing" title="List your lodge" subtitle="Reach thousands of DELSU students" />

      {/* A landlord who has not been verified yet cannot publish. */}
      {!user.isVerified ? (
        <Card className="mb-4 border border-warn/30 bg-warn-light">
          <div className="flex items-start gap-2.5">
            <ShieldIcon size={18} className="mt-0.5 shrink-0 text-warn-dark" />
            <div>
              <p className="text-sm font-bold text-warn-dark">Upload your document first</p>
              <p className="mt-1 text-xs leading-relaxed text-warn-dark/90">
                Before you can publish a listing, our team must approve your certificate of occupancy or caretaker agreement.
                It usually takes less than 24 hours.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {user.isVerified ? <LodgeForm /> : null}
    </PageTransition>
  );
}
