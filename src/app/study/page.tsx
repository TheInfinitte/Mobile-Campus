/**
 * src/app/study/page.tsx
 * WHAT: The Past Questions & Study Vault page.
 * WHY : Crowdsourced academic materials, siloed by institution and department,
 *       with welcome credits for freshers and a give-to-get economy.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { StudyVaultClient } from "@/components/study/StudyVaultClient";

export const metadata = { title: "Study vault" };
export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const user = await getSessionUser();
  if (user?.role === "LANDLORD") redirect("/landlord");

  return (
    <PageTransition>
      <PageHeader
        title="Study Vault"
        subtitle="Past questions and notes from your department. Give to get."
      />
      <StudyVaultClient />
    </PageTransition>
  );
}
