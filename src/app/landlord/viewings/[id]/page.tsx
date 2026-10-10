/**
 * src/app/landlord/viewings/[id]/page.tsx
 * WHAT: One viewing request, with the confirm / decline / mark-done controls.
 * WHY : The caretaker needs the student's number, the time and a way to reply in
 *       one screen - switching apps is how viewings get lost.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { ViewingResponsePanel } from "@/components/landlord/ViewingResponsePanel";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { ClockIcon, PinIcon, PhoneIcon, HomeIcon } from "@/components/ui/Icons";
import { formatNaira } from "@/lib/money";
import { formatDateTime, telLink, whatsappLink, walkTime } from "@/lib/utils";
import { roomTypeLabel } from "@/lib/data";

export const metadata = { title: "Viewing request" };
export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

/**
 * ViewingDetailPage
 * WHAT: Loads the request and renders the response controls.
 */
export default async function ViewingDetailPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  const viewing = await prisma.viewingRequest.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, fullName: true, phone: true, isVerified: true, level: true, department: true } },
      lodge: true,
    },
  });

  if (!viewing) notFound();

  // Only the landlord who owns the lodge (or an admin) may respond.
  const owner = viewing.lodge.landlordId === user.id || user.role === "ADMIN";
  if (!owner) redirect("/landlord");

  return (
    <PageTransition>
      <PageHeader back backHref="/landlord" title="Viewing request" subtitle={viewing.lodge.title} />

      {/* ------------------------------------------------------------ */}
      {/* WHO IS COMING                                                  */}
      {/* ------------------------------------------------------------ */}
      <Card className="mb-4">
        <CardHeader title="The student" subtitle="Every enquiry comes from a signed-in DELSU account" />

        <div className="mt-3">
          <p className="text-base font-bold text-slate-900">{viewing.user.fullName}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            {viewing.user.isVerified ? <VerifiedBadge /> : <Badge tone="gold">Provisional account</Badge>}
            {viewing.user.level ? <Badge tone="slate">{viewing.user.level}</Badge> : null}
          </p>
          {viewing.user.department ? <p className="mt-1.5 text-xs text-slate-500">{viewing.user.department}</p> : null}
        </div>

        {/* Direct contact - the caretaker will almost always just call. */}
        <div className="mt-3 flex gap-2">
          <a href={telLink(viewing.user.phone)} className="mc-btn-secondary flex-1">
            <PhoneIcon size={15} />
            {viewing.user.phone}
          </a>
          <a href={whatsappLink(viewing.user.phone, `Hello ${viewing.user.fullName.split(" ")[0]}, this is about your viewing of "${viewing.lodge.title}".`)} target="_blank" rel="noreferrer" className="mc-btn-secondary border-success/30 text-success-dark">
            WhatsApp
          </a>
        </div>

        {viewing.message ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">&ldquo;{viewing.message}&rdquo;</p>
        ) : null}
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* WHEN AND WHERE                                                 */}
      {/* ------------------------------------------------------------ */}
      <Card className="mb-4">
        <CardHeader title="When and where" />

        <div className="mt-3 space-y-2.5">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ClockIcon size={16} className="text-slate-400" />
            {formatDateTime(viewing.preferredDate)}
          </p>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
            <PinIcon size={16} className="mt-px shrink-0 text-slate-400" />
            {viewing.lodge.address}, {viewing.lodge.area}, {viewing.lodge.city}
          </p>
          <p className="flex items-center gap-2 text-xs text-slate-600">
            <HomeIcon size={16} className="text-slate-400" />
            {roomTypeLabel(viewing.lodge.roomType)} · {formatNaira(viewing.lodge.monthlyRentKobo)}/month
            {viewing.lodge.distanceToMainGateMeters ? ` · ${walkTime(viewing.lodge.distanceToMainGateMeters)} to the gate` : ""}
          </p>
        </div>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* RESPONSE                                                       */}
      {/* ------------------------------------------------------------ */}
      <ViewingResponsePanel
        viewing={{
          id: viewing.id,
          status: viewing.status,
          caretakerReply: viewing.caretakerReply,
          respondedAt: viewing.respondedAt ? viewing.respondedAt.toISOString() : null,
          studentName: viewing.user.fullName,
          lodgeTitle: viewing.lodge.title,
        }}
      />

      <p className="mt-4 px-2 text-center text-[11px] leading-relaxed text-slate-400">
        Replying quickly matters. Students usually go with the first caretaker who answers, and listings with unanswered requests
        are hidden lower in search.
      </p>

      <Link href="/landlord" className="mc-btn-ghost mt-2 w-full">
        Back to my properties
      </Link>
    </PageTransition>
  );
}
