/**
 * src/app/roommates/[id]/page.tsx
 * WHAT: One roommate board post in full, with its applications.
 * WHY : The author needs to see who applied, how well each person fits, and accept
 *       or decline without leaving the screen. Everyone else sees the same post
 *       with an "Apply" button instead.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { StaggerList } from "@/components/motion/StaggerList";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/SmartImage";
import { ScoreRing } from "@/components/roommates/RoommateCard";
import { ApplicationControls } from "@/components/roommates/ApplicationControls";
import { PeopleIcon, PinIcon, MoneyIcon, ClockIcon, HomeIcon } from "@/components/ui/Icons";
import { formatNaira } from "@/lib/money";
import { formatDate, timeAgo } from "@/lib/utils";
import { areaLabel } from "@/lib/data";

export const metadata = { title: "Roommate post" };
export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

/**
 * RoommatePostPage
 * WHAT: Loads the post and its applications, then renders the right view for the
 *       person looking at it.
 */
export default async function RoommatePostPage({ params }: PageProps) {
  const user = await getSessionUser();

  const post = await prisma.roommatePost.findUnique({
    where: { id: params.id },
    include: {
      author: { select: { id: true, fullName: true, phone: true, avatarUrl: true, level: true, department: true, isVerified: true } },
      applications: {
        include: { user: { select: { id: true, fullName: true, avatarUrl: true, level: true, department: true, isVerified: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!post) notFound();

  const isAuthor = user?.id === post.authorId;

  // Has the person looking at this already applied?
  const myApplication = user ? post.applications.find((application) => application.userId === user.id) : undefined;

  // Keep the author's phone number private from other students.
  const contactPhone = isAuthor ? null : post.author.phone;

  return (
    <PageTransition>
      <PageHeader back backHref="/roommates" title="Roommate post" subtitle={`${areaLabel(post.area)} · posted ${timeAgo(post.createdAt)}`} />

      {/* ------------------------------------------------------------ */}
      {/* THE POST ITSELF                                                */}
      {/* ------------------------------------------------------------ */}
      <Card className="mb-4">
        <h1 className="text-lg font-bold tracking-tight text-slate-900">{post.title}</h1>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="primary">{areaLabel(post.area)}</Badge>
          <Badge tone={post.status === "OPEN" ? "success" : "slate"}>
            {post.slotsLeft > 0 ? `${post.slotsLeft} of ${post.groupSize} still needed` : "Group is full"}
          </Badge>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-700">{post.description}</p>

        {/* The numbers that decide whether a student can join. */}
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          {[
            { icon: <MoneyIcon size={15} />, label: "Per person", value: `${formatNaira(post.budgetPerPersonKobo)}/mo` },
            { icon: <PeopleIcon size={15} />, label: "Group size", value: `${post.groupSize} people` },
            { icon: <HomeIcon size={15} />, label: "Area", value: areaLabel(post.area) },
            { icon: <ClockIcon size={15} />, label: "Move in", value: post.moveInDate ? formatDate(post.moveInDate) : "Flexible" },
          ].map((fact) => (
            <div key={fact.label} className="rounded-xl bg-slate-50 p-2.5">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {fact.icon}
                {fact.label}
              </p>
              <p className="mt-0.5 text-sm font-bold text-slate-900">{fact.value}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          A group of {post.groupSize} at {formatNaira(post.budgetPerPersonKobo)} each covers about{" "}
          <strong className="text-slate-700">{formatNaira(post.budgetPerPersonKobo * post.groupSize)}</strong> a month between you -
          enough for a good flat in {areaLabel(post.area)} once you split it.
        </p>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* THE AUTHOR                                                     */}
      {/* ------------------------------------------------------------ */}
      <Card className="mb-4">
        <CardHeader title="Posted by" />
        <div className="mt-3 flex items-center gap-3">
          <Avatar src={post.author.avatarUrl} name={post.author.fullName} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{post.author.fullName}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {post.author.isVerified ? <VerifiedBadge /> : <Badge tone="gold">Provisional</Badge>}
              {post.author.level ? <Badge tone="slate">{post.author.level}</Badge> : null}
            </p>
            {post.author.department ? <p className="mt-1 text-[11px] text-slate-500">{post.author.department}</p> : null}
          </div>
        </div>

        {/* The phone number only appears for the post author, who is looking at
            their own contact details. Everyone else applies through the app. */}
        {contactPhone ? <p className="mt-2 text-[11px] text-slate-400">Your number is hidden until you accept someone.</p> : null}
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* APPLY, OR MANAGE APPLICATIONS                                  */}
      {/* ------------------------------------------------------------ */}
      {!user ? (
        <Card className="bg-slate-50">
          <p className="text-xs leading-relaxed text-slate-600">
            <Link href="/auth/signup" className="font-bold text-primary-700">
              Create an account
            </Link>{" "}
            to apply. Applications are only open to signed-in DELSU accounts.
          </p>
        </Card>
      ) : user.id === post.authorId ? (
        <section>
          <CardHeader
            title="Applications"
            subtitle={post.applications.length === 0 ? "Nobody has applied yet" : `${post.applications.length} ${post.applications.length === 1 ? "person has" : "people have"} applied`}
            className="mb-3 px-1"
          />

          {post.applications.length === 0 ? (
            <Card className="bg-slate-50">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                <PinIcon size={14} className="mt-px shrink-0 text-slate-400" />
                Posts with a clear budget and a specific area get replies fastest. Yours has both, so give it a day.
              </p>
            </Card>
          ) : (
            <StaggerList gap={12} inView>
              {post.applications.map((application) => (
                <Card key={application.id}>
                  <div className="flex items-start gap-3">
                    <Avatar src={application.user.avatarUrl} name={application.user.fullName} size={44} />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{application.user.fullName}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {application.user.isVerified ? <VerifiedBadge /> : <Badge tone="gold">Provisional</Badge>}
                        {application.user.level ? <Badge tone="slate">{application.user.level}</Badge> : null}
                      </p>
                      {application.user.department ? <p className="mt-1 text-[11px] text-slate-500">{application.user.department}</p> : null}
                    </div>

                    {application.compatibilityScore !== null ? <ScoreRing score={application.compatibilityScore} /> : null}
                  </div>

                  {application.message ? (
                    <p className="mt-2.5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">&ldquo;{application.message}&rdquo;</p>
                  ) : null}

                  <p className="mt-2 text-[10px] text-slate-400">Applied {timeAgo(application.createdAt)}</p>

                  <ApplicationControls
                    application={{ id: application.id, status: application.status, applicantName: application.user.fullName }}
                    postId={post.id}
                  />
                </Card>
              ))}
            </StaggerList>
          )}
        </section>
      ) : myApplication ? (
        <Card className={myApplication.status === "ACCEPTED" ? "border border-success/30 bg-success-light" : "bg-slate-50"}>
          <p className="text-sm font-bold text-slate-900">
            {myApplication.status === "ACCEPTED"
              ? "You are in the group"
              : myApplication.status === "DECLINED"
                ? "This group chose someone else"
                : "You have applied"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {myApplication.status === "ACCEPTED"
              ? "The author has your details. Message them to agree a viewing, then shortlist a lodge together and split the payment."
              : myApplication.status === "DECLINED"
                ? "It is not a judgement on you - groups usually pick whoever sleeps and studies at the same time. Try another post."
                : "We have told them you are interested. Most authors reply within a day."}
          </p>

          {myApplication.status === "ACCEPTED" ? (
            <Link href="/housing" className="mc-btn-primary mt-3 w-full">
              Browse lodges together
            </Link>
          ) : null}
        </Card>
      ) : (
        <ApplicationControls postId={post.id} canApply={user.isVerified} />
      )}

      <p className="mt-4 px-2 text-center text-[11px] leading-relaxed text-slate-400">
        Once a group is formed, shortlist a lodge and split the payment through escrow. Each person pays their own share and the
        landlord is paid in full - nobody has to chase anybody for money.
      </p>
    </PageTransition>
  );
}
