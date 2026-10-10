/**
 * src/app/housing/[id]/page.tsx
 * WHAT: One lodge's detail page.
 * WHY : A server component so the listing renders immediately (good for slow
 *       connections and for sharing links), with the interactive parts handled by
 *       the LodgeDetail client component.
 */
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, canPayAndMessage, upgradeMessage } from "@/lib/auth";
import { housingFeeBreakdown } from "@/lib/fees";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { FloatingBudgetButton } from "@/components/layout/FloatingBudgetButton";
import { LodgeDetail } from "@/components/housing/LodgeDetail";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

/**
 * generateMetadata
 * WHAT: Builds the page title and description from the listing.
 * WHY : A shared WhatsApp link should preview the actual lodge, not a generic
 *       title.
 */
export async function generateMetadata({ params }: PageProps) {
  const lodge = await prisma.lodge.findUnique({ where: { id: params.id }, select: { title: true, area: true, monthlyRentKobo: true } });
  if (!lodge) return { title: "Listing not found" };

  return {
    title: lodge.title,
    description: `${lodge.title} in ${lodge.area} - ₦${(lodge.monthlyRentKobo / 100).toLocaleString("en-NG")} per month on Mobile Campus.`,
  };
}

/**
 * LodgePage
 * WHAT: Loads the lodge and renders the detail view.
 */
export default async function LodgePage({ params }: PageProps) {
  const [lodge, user] = await Promise.all([
    prisma.lodge.findUnique({
      where: { id: params.id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { user: { select: { fullName: true, level: true, avatarUrl: true, isVerified: true } } },
        },
        landlord: { select: { id: true, fullName: true, phone: true, isVerified: true } },
      },
    }),
    getSessionUser(),
  ]);

  // A missing or removed listing gets the standard 404 screen.
  if (!lodge || lodge.status === "REMOVED") notFound();

  // The real tenant fee for this price.
  const fees = await housingFeeBreakdown(lodge.annualRentKobo);

  // Has this user shortlisted it, and have they rented here before (review rights)?
  const [shortlisted, hasRented] = user
    ? await Promise.all([
        prisma.shortlist.findFirst({ where: { userId: user.id, lodgeId: lodge.id } }).then(Boolean),
        prisma.escrowTransaction
          .findFirst({ where: { payerId: user.id, lodgeId: lodge.id, state: { in: ["HELD", "CONFIRMED", "RELEASED"] } } })
          .then(Boolean),
      ])
    : [false, false];

  return (
    <PageTransition>
      <PageHeader back backHref="/housing" title={lodge.area} subtitle="Verified off-campus housing" />

      <LodgeDetail
        lodge={{
          id: lodge.id,
          title: lodge.title,
          description: lodge.description,
          area: lodge.area,
          address: lodge.address,
          monthlyRentKobo: lodge.monthlyRentKobo,
          annualRentKobo: lodge.annualRentKobo,
          cautionDepositKobo: lodge.cautionDepositKobo,
          roomType: lodge.roomType,
          waterSource: lodge.waterSource,
          waterNote: lodge.waterNote,
          meterType: lodge.meterType,
          lightNote: lodge.lightNote,
          distanceToMainGateMeters: lodge.distanceToMainGateMeters,
          distanceToFacultyMeters: lodge.distanceToFacultyMeters,
          amenities: lodge.amenities,
          availableRooms: lodge.availableRooms,
          maxOccupancy: lodge.maxOccupancy,
          caretakerName: lodge.caretakerName,
          caretakerPhone: lodge.caretakerPhone,
          isVerified: lodge.isVerified,
          ratingAverage: lodge.ratingAverage,
          ratingCount: lodge.ratingCount,
          images: lodge.images.map((image) => ({ url: image.url, altText: image.altText })),
          reviews: lodge.reviews.map((review) => ({
            id: review.id,
            rating: review.rating,
            safety: review.safety,
            cleanliness: review.cleanliness,
            comment: review.comment,
            isVerifiedTenant: review.isVerifiedTenant,
            createdAt: review.createdAt.toISOString(),
            author: review.user,
          })),
          landlord: lodge.landlord,
          feeKobo: fees.payerFeeKobo,
          feeLines: fees.lines,
          totalMoveInKobo: lodge.annualRentKobo + lodge.cautionDepositKobo + fees.payerFeeKobo,
        }}
        canPay={user ? canPayAndMessage(user) : false}
        upgradeNote={upgradeMessage()}
        initiallyShortlisted={shortlisted}
        // Reviews need a verified student who has actually rented here.
        canReview={Boolean(user && user.isVerified && user.role === "STUDENT" && hasRented)}
        signedIn={Boolean(user)}
      />

      <FloatingBudgetButton />
    </PageTransition>
  );
}
