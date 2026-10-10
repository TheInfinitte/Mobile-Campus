/**
 * src/app/roommates/page.tsx
 * WHAT: The Roommate Board - open posts from students looking for people to live
 *       with, plus the entry point to the compatibility questionnaire.
 * WHY : Two paths into the same feature: browse what others posted, or answer the
 *       questionnaire and get matched. Both are offered on this screen.
 */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { StaggerList } from "@/components/motion/StaggerList";
import { RoommatePostCard } from "@/components/roommates/RoommateCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Card";
import { PeopleIcon, SparkleIcon, PlusIcon } from "@/components/ui/Icons";
import { compatibility, type ProfileWithUser } from "@/lib/compatibility";
import { getInstitutionAreas } from "@/lib/institution";

export const metadata = { title: "Roommate board" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Record<string, string | string[] | undefined> };

/**
 * RoommatesPage
 * WHAT: Lists open posts, scored against the signed-in user when possible.
 */
export default async function RoommatesPage({ searchParams }: PageProps) {
  // MULTI-CAMPUS: the area chips are the viewer's own communities.
  const areas = await getInstitutionAreas();
  const area = typeof searchParams.area === "string" ? searchParams.area : "";
  const user = await getSessionUser();

  const [posts, myProfile] = await Promise.all([
    prisma.roommatePost.findMany({
      where: { status: "OPEN", ...(area ? { area: { equals: area, mode: "insensitive" } } : {}) },
      include: { author: { select: { id: true, fullName: true, avatarUrl: true, level: true, isVerified: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    user
      ? prisma.roommateProfile.findUnique({
          where: { userId: user.id },
          include: { user: { select: { id: true, fullName: true, gender: true, level: true, department: true, avatarUrl: true, bio: true, isVerified: true } } },
        })
      : null,
  ]);

  // Score each post's author against me, so the board can be sorted by fit.
  const authorProfiles = await prisma.roommateProfile.findMany({
    where: { userId: { in: posts.map((post) => post.authorId) } },
    include: { user: { select: { id: true, fullName: true, gender: true, level: true, department: true, avatarUrl: true, bio: true, isVerified: true } } },
  });

  const scores = new Map<string, number>();
  if (myProfile) {
    for (const authorProfile of authorProfiles) {
      scores.set(authorProfile.userId, compatibility(myProfile as ProfileWithUser, authorProfile as ProfileWithUser).score);
    }
  }

  // Best matches first when we have scores, otherwise newest first.
  const sorted = myProfile
    ? [...posts].sort((a, b) => (scores.get(b.authorId) ?? 0) - (scores.get(a.authorId) ?? 0))
    : posts;

  return (
    <PageTransition>
      <PageHeader
        title="Roommates"
        subtitle="Find someone you would actually live well with - then rent together and split the payment."
        action={
          <Link href="/roommates/new" className="mc-btn-primary h-10 px-3.5 text-xs">
            <PlusIcon size={16} />
            Post
          </Link>
        }
      >
        {/* Area chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <Link href="/roommates" className={`mc-chip shrink-0 ${!area ? "border-primary-600 bg-primary-600 text-white" : ""}`}>
            All areas
          </Link>
          {areas.map((option) => (
            <Link
              key={option}
              href={`/roommates?area=${encodeURIComponent(option)}`}
              className={`mc-chip shrink-0 ${area === option ? "border-primary-600 bg-primary-600 text-white" : ""}`}
            >
              {option}
            </Link>
          ))}
        </div>
      </PageHeader>

      {/* -------------------------------------------------------------- */}
      {/* MATCHING ENTRY POINT                                            */}
      {/* -------------------------------------------------------------- */}
      <Card className="mb-5 bg-primary-900 text-white">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <SparkleIcon size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold">Get matched by compatibility</h2>
            <p className="mt-1 text-xs leading-relaxed text-primary-100">
              Answer six quick questions about how you sleep, study and keep your space. We score you against every verified
              student and explain why each match works.
            </p>
            <Link href={myProfile ? "/roommates/matches" : "/roommates/questionnaire"} className="mc-btn-primary mt-3 bg-gold-500 text-white hover:bg-gold-600">
              {myProfile ? "See my matches" : "Take the 1-minute quiz"}
            </Link>
          </div>
        </div>
      </Card>

      {/* -------------------------------------------------------------- */}
      {/* THE BOARD                                                       */}
      {/* -------------------------------------------------------------- */}
      <h2 className="mb-3 px-1 text-lg font-bold tracking-tight text-slate-900">
        Open posts {myProfile ? <span className="text-sm font-medium text-slate-400">(sorted by fit for you)</span> : null}
      </h2>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<PeopleIcon size={32} />}
          title="No open posts yet"
          message="Be the first to post. Tell students how many people you need, the area and the budget per person."
          action={
            <Link href="/roommates/new" className="mc-btn-primary">
              Post on the board
            </Link>
          }
        />
      ) : (
        <StaggerList gap={12} inView>
          {sorted.map((post) => (
            <RoommatePostCard
              key={post.id}
              post={{
                id: post.id,
                title: post.title,
                description: post.description,
                area: post.area,
                groupSize: post.groupSize,
                slotsLeft: post.slotsLeft,
                budgetPerPersonKobo: post.budgetPerPersonKobo,
                moveInDate: post.moveInDate ? post.moveInDate.toISOString() : null,
                status: post.status,
                createdAt: post.createdAt.toISOString(),
                author: post.author,
                compatibilityScore: scores.get(post.authorId),
              }}
            />
          ))}
        </StaggerList>
      )}

      {/* Explain the group payment feature, which is the real differentiator. */}
      <Card className="mt-6">
        <h3 className="text-sm font-bold text-slate-900">Renting together?</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
          Once a group is formed, you can shortlist a lodge together and split the payment. Each person&apos;s share is tracked
          separately, so nobody has to chase their friends for money - and the landlord gets paid in full.
        </p>
        <Link href="/housing" className="mc-btn-secondary mt-3 w-full">
          Browse lodges as a group
        </Link>
      </Card>

      {!user ? (
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/auth/login" className="font-bold text-primary-700">
            Sign in
          </Link>{" "}
          to post on the board and see compatibility scores.
        </p>
      ) : null}
    </PageTransition>
  );
}
