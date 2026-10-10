/**
 * src/app/escrow/[id]/page.tsx
 * WHAT: The detail page for one escrow transaction - the animated tracker, the
 *       full money breakdown, the action the user needs to take, and the dispute
 *       route if things go wrong.
 * WHY : This is the single most trust-critical screen in the app. Everything a
 *       user paid must be visible and explainable here, months after the fact.
 */
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { EscrowDetailClient } from "@/components/escrow/EscrowDetailClient";

export const metadata = { title: "Payment detail" };
export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

/**
 * EscrowDetailPage
 * WHAT: Loads one transaction (by id or by reference) and renders the client view.
 * WHY : The actions on this page - confirm, release, dispute - all need the
 *       browser, so the data is handed to a client component.
 */
export default async function EscrowDetailPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect(`/auth/login?next=/escrow/${params.id}`);

  // Accept either the internal id or the friendly "MC-XXXXXX" reference.
  const escrow = await prisma.escrowTransaction.findFirst({
    where: { OR: [{ id: params.id }, { reference: params.id }] },
    include: {
      lodge: { select: { id: true, title: true, area: true, address: true, caretakerName: true, caretakerPhone: true } },
      marketItem: { select: { id: true, title: true, images: true, category: true, area: true, pickupNote: true } },
      gig: { select: { id: true, title: true, category: true, description: true } },
      payer: { select: { id: true, fullName: true, phone: true, isVerified: true } },
      payee: { select: { id: true, fullName: true, phone: true, isVerified: true } },
      dispute: true,
      splitShares: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
    },
  });

  if (!escrow) notFound();

  // Only the two parties involved, or an admin, may see a deal.
  const allowed = escrow.payerId === user.id || escrow.payeeId === user.id || user.role === "ADMIN";
  if (!allowed) redirect("/escrow");

  const iAmPayer = escrow.payerId === user.id;
  const iAmPayee = escrow.payeeId === user.id;

  // What was actually bought or paid for.
  const subject = escrow.lodge ? escrow.lodge.title : escrow.marketItem?.title ?? escrow.gig?.title ?? "Payment";

  return (
    <PageTransition>
      <PageHeader back backHref="/escrow" title="Payment detail" subtitle={`Reference ${escrow.reference}`} />

      <EscrowDetailClient
        escrow={{
          id: escrow.id,
          reference: escrow.reference,
          type: escrow.type,
          state: escrow.state,
          itemAmountKobo: escrow.itemAmountKobo,
          cautionKobo: escrow.cautionKobo,
          feeKobo: escrow.feeKobo,
          totalKobo: escrow.totalKobo,
          payoutKobo: escrow.payoutKobo,
          feeSnapshot: escrow.feeSnapshot,
          periodStart: escrow.periodStart ? escrow.periodStart.toISOString() : null,
          periodEnd: escrow.periodEnd ? escrow.periodEnd.toISOString() : null,
          createdAt: escrow.createdAt.toISOString(),
          confirmedAt: escrow.confirmedAt ? escrow.confirmedAt.toISOString() : null,
          releasedAt: escrow.releasedAt ? escrow.releasedAt.toISOString() : null,
          refundedAt: escrow.refundedAt ? escrow.refundedAt.toISOString() : null,
          subject,
          subjectHref: escrow.lodge
            ? `/housing/${escrow.lodge.id}`
            : escrow.marketItem
              ? `/market/${escrow.marketItem.id}`
              : escrow.gig
                ? `/gigs/${escrow.gig.id}`
                : null,
          iAmPayer,
          iAmPayee,
          otherParty: {
            fullName: iAmPayer ? escrow.payee.fullName : escrow.payer.fullName,
            phone: iAmPayer ? escrow.payee.phone : escrow.payer.phone,
            isVerified: iAmPayer ? escrow.payee.isVerified : escrow.payer.isVerified,
          },
          dispute: escrow.dispute
            ? {
                id: escrow.dispute.id,
                status: escrow.dispute.status,
                reason: escrow.dispute.reason,
                details: escrow.dispute.details,
                resolution: escrow.dispute.resolution,
                createdAt: escrow.dispute.createdAt.toISOString(),
              }
            : null,
          splitShares: escrow.splitShares.map((share) => ({
            id: share.id,
            fullName: share.user.fullName,
            amountKobo: share.amountKobo,
            isPaid: share.isPaid,
          })),
          caretaker: escrow.lodge
            ? { name: escrow.lodge.caretakerName, phone: escrow.lodge.caretakerPhone }
            : null,
        }}
      />
    </PageTransition>
  );
}
