/**
 * src/app/profile/roommate/page.tsx
 * WHAT: The place to edit your roommate quiz answers after the first time.
 * WHY : Habits change between sessions - someone who was a night reader in 200
 *       level may be an early sleeper in 400 level. Editing here re-scores every
 *       match.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { RoommateQuestionnaire } from "@/components/roommates/RoommateQuestionnaire";
import { Card } from "@/components/ui/Card";
import { SparkleIcon } from "@/components/ui/Icons";

export const metadata = { title: "My roommate answers" };
export const dynamic = "force-dynamic";

/**
 * RoommateProfilePage
 * WHAT: Loads the saved answers and hands them to the questionnaire as defaults.
 */
export default async function RoommateProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/profile/roommate");
  if (user.role !== "STUDENT") redirect("/profile");

  const profile = await prisma.roommateProfile.findUnique({ where: { userId: user.id } });

  return (
    <PageTransition>
      <PageHeader back backHref="/profile" title="Roommate answers" subtitle="Change anything and your matches are re-scored" />

      {profile ? (
        <Card className="mb-4 bg-primary-50">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-primary-900">
            <SparkleIcon size={15} className="mt-px shrink-0 text-primary-600" />
            You answered on {new Date(profile.updatedAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}.
            Updating any answer recalculates your compatibility with every other verified student.
          </p>
        </Card>
      ) : null}

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
