/**
 * src/app/roommates/matches/page.tsx
 * WHAT: The matches screen - verified students ranked by compatibility, with the
 *       reasons behind each score.
 * WHY : This is the payoff of the questionnaire. Showing WHY a match is good
 *       ("you both read at night") is what makes a student actually send a
 *       message.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { StaggerList } from "@/components/motion/StaggerList";
import { MatchCard } from "@/components/roommates/RoommateCard";
import { EmptyState } from "@/components/ui/Card";
import { PeopleIcon } from "@/components/ui/Icons";
import { sortByCompatibility, type ProfileWithUser } from "@/lib/compatibility";

export const metadata = { title: "My roommate matches" };
export const dynamic = "force-dynamic";

/**
 * MatchesPage
 * WHAT: Scores every other verified student's profile against mine and lists the
 *       best twenty.
 */
export default async function MatchesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/roommates/matches");

  const myProfile = await prisma.roommateProfile.findUnique({
    where: { userId: user.id },
    include: { user: { select: { id: true, fullName: true, gender: true, level: true, department: true, avatarUrl: true, bio: true, isVerified: true } } },
  });

  // No questionnaire yet - send them to take it.
  if (!myProfile) redirect("/roommates/questionnaire");

  // Candidates: verified students who have completed the questionnaire.
  const candidates = await prisma.roommateProfile.findMany({
    where: { userId: { not: user.id }, user: { role: "STUDENT", isVerified: true } },
    include: { user: { select: { id: true, fullName: true, gender: true, level: true, department: true, avatarUrl: true, bio: true, isVerified: true } } },
    take: 200,
  });

  const ranked = sortByCompatibility(myProfile as ProfileWithUser, candidates as ProfileWithUser[]).slice(0, 20);

  // Split into "great" and "possible" so the screen has some structure.
  const great = ranked.filter((entry) => entry.result.score >= 70);
  const possible = ranked.filter((entry) => entry.result.score < 70);

  /** Maps a ranked entry into the shape MatchCard expects. */
  const toCard = (entry: (typeof ranked)[number]) => ({
    userId: entry.profile.user.id,
    fullName: entry.profile.user.fullName,
    avatarUrl: entry.profile.user.avatarUrl,
    level: entry.profile.user.level,
    department: entry.profile.user.department,
    isVerified: entry.profile.user.isVerified,
    score: entry.result.score,
    label: entry.result.label,
    reasons: entry.result.reasons,
    warnings: entry.result.warnings,
    budgetKobo: entry.profile.budgetKobo,
    preferredAreas: entry.profile.preferredAreas,
  });

  return (
    <PageTransition>
      <PageHeader
        back
        backHref="/roommates"
        title="Your matches"
        subtitle={`${ranked.length} verified student${ranked.length === 1 ? "" : "s"} scored against your answers`}
        action={
          <Link href="/roommates/questionnaire" className="mc-chip">
            Edit answers
          </Link>
        }
      />

      {ranked.length === 0 ? (
        <EmptyState
          icon={<PeopleIcon size={32} />}
          title="No matches yet"
          message="You are the only one who has answered the quiz so far. Check back in a day or two - or post on the board to reach people directly."
          action={
            <Link href="/roommates/new" className="mc-btn-primary">
              Post on the board
            </Link>
          }
        />
      ) : (
        <>
          {great.length > 0 ? (
            <section>
              <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wide text-slate-400">Best matches</h2>
              <StaggerList gap={12} inView>
                {great.map((entry) => (
                  <MatchCard key={entry.profile.userId} match={toCard(entry)} />
                ))}
              </StaggerList>
            </section>
          ) : null}

          {possible.length > 0 ? (
            <section className="mt-6">
              <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wide text-slate-400">Worth a conversation</h2>
              <StaggerList gap={12} inView>
                {possible.map((entry) => (
                  <MatchCard key={entry.profile.userId} match={toCard(entry)} />
                ))}
              </StaggerList>
            </section>
          ) : null}
        </>
      )}
    </PageTransition>
  );
}
