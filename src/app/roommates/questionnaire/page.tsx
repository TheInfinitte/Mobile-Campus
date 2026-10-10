/**
 * src/app/roommates/questionnaire/page.tsx
 * WHAT: The compatibility questionnaire page.
 * WHY : This is the input to the matching engine. It is also where a student
 *       updates their answers later, so it loads any existing profile first.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { RoommateQuestionnaire } from "@/components/roommates/RoommateQuestionnaire";

export const metadata = { title: "Roommate questionnaire" };
export const dynamic = "force-dynamic";

/**
 * QuestionnairePage
 * WHAT: Loads the existing profile (if any) and renders the form.
 */
export default async function QuestionnairePage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/roommates/questionnaire");
  if (user.role !== "STUDENT") redirect("/roommates");

  const profile = await prisma.roommateProfile.findUnique({ where: { userId: user.id } });

  return (
    <PageTransition>
      <PageHeader
        back
        backHref="/roommates"
        title="Roommate quiz"
        subtitle="Six quick questions. It takes about a minute and makes the matches real."
      />
      <RoommateQuestionnaire
        initialGender={user.gender}
        initial={
          profile
            ? {
                sleepSchedule: profile.sleepSchedule,
                studyStyle: profile.studyStyle,
                cleanliness: profile.cleanliness,
                noiseTolerance: profile.noiseTolerance,
                budgetKobo: profile.budgetKobo,
                smokes: profile.smokes,
                hasPets: profile.hasPets,
                hasGenerator: profile.hasGenerator,
                hasFridge: profile.hasFridge,
                aboutMe: profile.aboutMe,
                preferredAreas: profile.preferredAreas,
              }
            : null
        }
      />
    </PageTransition>
  );
}
