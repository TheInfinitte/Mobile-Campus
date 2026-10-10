/**
 * src/app/gigs/[id]/page.tsx
 * WHAT: One micro-gig: the task, the poster, the deadline, and the actions
 *       (accept, pay with escrow, mark complete).
 * WHY : A worker needs to see the poster's verification and the exact amount
 *       before committing; the poster needs to pay only after someone accepts.
 */
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, canPayAndMessage, upgradeMessage } from "@/lib/auth";
import { escrowFeeBreakdown } from "@/lib/fees";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, StatusBadge, VerifiedBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/SmartImage";
import { Money } from "@/components/ui/Money";
import { EscrowActions } from "@/components/shared/EscrowActions";
import { ClockIcon, PinIcon } from "@/components/ui/Icons";
import { formatDate, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

/** Page metadata from the gig title. */
export async function generateMetadata({ params }: PageProps) {
  const gig = await prisma.gig.findUnique({ where: { id: params.id }, select: { title: true, budgetKobo: true, area: true } });
  if (!gig) return { title: "Task not found" };
  return {
    title: gig.title,
    description: `${gig.title} in ${gig.area}, pays ₦${(gig.budgetKobo / 100).toLocaleString("en-NG")}.`,
  };
}

/**
 * GigPage
 * WHAT: Loads the gig and decides which actions this viewer is allowed to take.
 */
export default async function GigPage({ params }: PageProps) {
  const [gig, user] = await Promise.all([
    prisma.gig.findUnique({
      where: { id: params.id },
      include: {
        poster: { select: { id: true, fullName: true, phone: true, isVerified: true, avatarUrl: true, level: true } },
        worker: { select: { id: true, fullName: true, phone: true, avatarUrl: true, isVerified: true } },
      },
    }),
    getSessionUser(),
  ]);

  if (!gig) notFound();

  const fees = await escrowFeeBreakdown(gig.budgetKobo);

  const shortlisted = user ? Boolean(await prisma.shortlist.findFirst({ where: { userId: user.id, gigId: gig.id } })) : false;

  // Who is this viewer in relation to the gig?
  const isPoster = user?.id === gig.posterId;
  const isWorker = user?.id === gig.workerId;

  return (
    <PageTransition>
      <PageHeader back backHref="/gigs" title={gig.category} subtitle="Micro-gig" />

      {/* Headline */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={gig.status} />
          <Badge tone="outline">{gig.category}</Badge>
          {gig.isNegotiable ? <Badge tone="primary">Negotiable</Badge> : null}
        </div>

        <h1 className="mt-2 text-xl font-bold leading-tight tracking-tight text-slate-900">{gig.title}</h1>

        <div className="mt-2 flex items-baseline gap-2">
          <Money kobo={gig.budgetKobo} size="xl" className="text-primary-700" />
          <span className="text-xs text-slate-500">for the job</span>
        </div>

        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <PinIcon size={13} />
            {gig.area}
          </span>
          {gig.dueDate ? (
            <span className="inline-flex items-center gap-1">
              <ClockIcon size={13} />
              Due {formatDate(gig.dueDate)}
            </span>
          ) : null}
          <span>Posted {timeAgo(gig.createdAt)}</span>
        </p>
      </div>

      {/* What needs doing */}
      <Card className="mt-4">
        <CardHeader title="What needs doing" />
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{gig.description}</p>
      </Card>

      {/* Poster */}
      <Card className="mt-4">
        <CardHeader title="Posted by" subtitle={gig.poster.isVerified ? "Verified student" : "Not verified yet"} />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={gig.poster.avatarUrl} name={gig.poster.fullName} size={42} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{gig.poster.fullName}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{gig.poster.level ?? "Student"}</p>
            </div>
          </div>
          {gig.poster.isVerified ? <VerifiedBadge /> : null}
        </div>
      </Card>

      {/* The assigned worker, once someone has accepted. */}
      {gig.worker ? (
        <Card className="mt-4">
          <CardHeader title="Assigned to" />
          <div className="mt-3 flex items-center gap-3">
            <Avatar src={gig.worker.avatarUrl} name={gig.worker.fullName} size={42} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{gig.worker.fullName}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{gig.worker.phone}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* -------------------------------------------------------------- */}
      {/* ACTIONS - different for the poster and for a potential worker    */}
      {/* -------------------------------------------------------------- */}
      <div className="mt-4">
        {isPoster ? (
          // The poster pays once a worker has accepted.
          gig.workerId ? (
            <EscrowActions
              type="SERVICE"
              targetId={gig.id}
              title={gig.title}
              amountKobo={gig.budgetKobo}
              feeLines={fees.lines}
              totalKobo={gig.budgetKobo + fees.payerFeeKobo}
              payoutKobo={gig.budgetKobo - fees.payeeFeeKobo}
              canPay={Boolean(user && canPayAndMessage(user))}
              signedIn
              upgradeNote={upgradeMessage()}
              shortlisted={shortlisted}
              reportedUserId={gig.workerId}
              gigActions={{
                canAccept: false,
                canComplete: gig.status === "ASSIGNED" || gig.status === "IN_PROGRESS",
                canCancel: gig.status === "OPEN" || gig.status === "ASSIGNED",
                status: gig.status,
              }}
            />
          ) : (
            <Card>
              <p className="text-sm text-slate-600">
                Waiting for a student to accept. You will get an SMS the moment someone does, then you pay into escrow.
              </p>
            </Card>
          )
        ) : (
          // A visitor or a potential worker.
          <EscrowActions
            type="SERVICE"
            targetId={gig.id}
            title={gig.title}
            amountKobo={gig.budgetKobo}
            feeLines={fees.lines}
            totalKobo={gig.budgetKobo + fees.payerFeeKobo}
            payoutKobo={gig.budgetKobo - fees.payeeFeeKobo}
            canPay={Boolean(user && canPayAndMessage(user))}
            signedIn={Boolean(user)}
            upgradeNote={upgradeMessage()}
            shortlisted={shortlisted}
            reportedUserId={gig.posterId}
            gigActions={{
              // Only an open task with no worker yet can be accepted, and not by the worker already assigned.
              canAccept: gig.status === "OPEN" && !isWorker,
              canComplete: false,
              canCancel: false,
              status: gig.status,
            }}
          />
        )}
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
        Agree the details in the app first. Payment is held in escrow and released to the worker only after the poster
        confirms the job was done.
      </p>
    </PageTransition>
  );
}
