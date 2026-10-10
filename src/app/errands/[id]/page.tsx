/**
 * src/app/errands/[id]/page.tsx
 * WHAT: One errand in full - the logistics contract, the people involved,
 *       and the claim/complete/cancel actions.
 * WHY : The board card is a teaser; the detail page is where the handover is
 *       actually coordinated, so contacts and actions live here.
 */
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ErrandActions } from "@/components/errands/ErrandActions";
import { Money } from "@/components/ui/Money";
import { formatDate, timeAgo } from "@/lib/utils";
import { PinIcon, ArrowRightIcon, ClockIcon } from "@/components/ui/Icons";

export const metadata = { title: "Errand" };
export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

/**
 * ErrandDetailPage
 * WHAT: Server-renders one errand and hands the action buttons to a client
 *       component (they need to call the API and refresh).
 */
export default async function ErrandDetailPage({ params }: PageProps) {
  const viewer = await getSessionUser();

  const errand = await prisma.errand.findUnique({
    where: { id: params.id },
    include: {
      poster: { select: { id: true, fullName: true, phone: true, isVerified: true } },
      claimedBy: { select: { id: true, fullName: true, phone: true } },
    },
  });
  if (!errand) notFound();

  const iAmPoster = viewer?.id === errand.posterId;
  const iAmClaimer = viewer?.id === errand.claimedById;
  // Contact details unlock only for the two people doing the handover.
  const contactsVisible = iAmPoster || iAmClaimer;

  // A friendly label for each status.
  const statusLabel =
    errand.status === "OPEN"
      ? "Open - waiting for a mover"
      : errand.status === "CLAIMED"
        ? "Claimed - handover in progress"
        : errand.status === "COMPLETED"
          ? "Completed"
          : "Cancelled";
  const statusTone = errand.status === "OPEN" ? "primary" : errand.status === "CLAIMED" ? "warn" : errand.status === "COMPLETED" ? "success" : "slate";

  return (
    <PageTransition>
      <PageHeader back backHref="/errands" title={errand.category} subtitle="Campus errand" />

      {/* ------------------------------------------------------------ */}
      {/* THE TASK                                                       */}
      {/* ------------------------------------------------------------ */}
      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-black text-slate-900">{errand.title}</h1>
            <p className="mt-1 text-[11px] text-slate-500">
              Posted by {errand.poster.fullName}
              {errand.poster.isVerified ? " ✓ verified" : ""} &middot; {timeAgo(errand.createdAt)}
            </p>
          </div>
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </div>

        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{errand.description}</p>

        {/* The logistics triple: pickup -> drop-off -> fee. */}
        <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3">
          <p className="inline-flex items-start gap-2 text-xs font-semibold text-slate-800">
            <PinIcon size={14} className="mt-0.5 shrink-0 text-slate-400" /> Pick up: {errand.pickupPoint}
          </p>
          <p className="inline-flex items-start gap-2 text-xs font-semibold text-slate-800">
            <ArrowRightIcon size={14} className="mt-0.5 shrink-0 text-primary-500" /> Drop off: {errand.dropOffPoint}
          </p>
          <p className="inline-flex items-center gap-2 text-xs font-black text-primary-700">
            Fee: <Money kobo={errand.feeKobo} size="sm" />
            {errand.isNegotiable ? <span className="font-semibold text-primary-500">(negotiable)</span> : null}
          </p>
          {errand.dueAt ? (
            <p className="inline-flex items-center gap-2 text-xs text-slate-600">
              <ClockIcon size={14} className="shrink-0" /> Needed by {formatDate(errand.dueAt)}
            </p>
          ) : null}
        </div>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* WHO IS INVOLVED (after a claim)                                */}
      {/* ------------------------------------------------------------ */}
      {errand.claimedBy ? (
        <Card className="mb-4">
          <CardHeader title="The mover" subtitle={contactsVisible ? "Coordinate the handover directly." : "This errand has been claimed."} />
          <p className="mt-2 text-sm font-bold text-slate-900">{errand.claimedBy.fullName}</p>
          {!contactsVisible ? (
            <p className="mt-1 text-[11px] text-slate-500">Contact details unlock for the poster and the mover only.</p>
          ) : null}
        </Card>
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/* ACTIONS                                                        */}
      {/* ------------------------------------------------------------ */}
      <Card>
        <CardHeader title="Task actions" />
        <div className="mt-3">
          <ErrandActions
            errandId={errand.id}
            status={errand.status}
            iAmPoster={iAmPoster}
            iAmClaimer={iAmClaimer}
            isSignedIn={viewer !== null}
            posterPhone={contactsVisible ? errand.poster.phone : null}
            posterName={errand.poster.fullName}
            claimerPhone={contactsVisible && errand.claimedBy ? errand.claimedBy.phone : null}
            claimerName={errand.claimedBy?.fullName ?? null}
          />
        </div>
      </Card>
    </PageTransition>
  );
}
