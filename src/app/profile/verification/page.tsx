/**
 * src/app/profile/verification/page.tsx
 * WHAT: The verification screen - submit proof of who you are and track the
 *       status of that submission.
 * WHY : Verification is what separates this platform from a WhatsApp group. Three
 *       different people need three different proofs: a registered student, a
 *       fresher waiting for matriculation, and a landlord or caretaker.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { StaggerList } from "@/components/motion/StaggerList";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { VerificationForm } from "@/components/verification/VerificationForm";
import { MatricUpgradeForm } from "@/components/verification/MatricUpgradeForm";
import { ShieldIcon, LockIcon, CheckIcon, ClockIcon, CloseIcon } from "@/components/ui/Icons";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Verification" };
export const dynamic = "force-dynamic";

/**
 * VerificationPage
 * WHAT: Shows the history of submissions plus the form for a new one.
 * WHY : A rejected submission with the admin's note is far more useful than a
 *       silent failure - it tells the user exactly what to fix.
 */
export default async function VerificationPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/profile/verification");
  if (user.role === "ADMIN") redirect("/admin");

  const records = await prisma.verificationRecord.findMany({
    where: { userId: user.id },
    orderBy: { submittedAt: "desc" },
  });

  const pending = records.find((record) => record.status === "PENDING");

  // JAMB -> MATRIC transition: a student who has never had a matric number
  // approved gets the one-tap upgrade card.
  const hasMatric = records.some((record) => record.status === "APPROVED" && record.type === "STUDENT_ID");
  const upgradePending = records.some((record) => record.status === "PENDING" && record.purpose === "MATRIC_UPGRADE");

  return (
    <PageTransition>
      <PageHeader back backHref="/profile" title="Verification" subtitle="Prove you are real. It takes two minutes." />

      {/* ------------------------------------------------------------ */}
      {/* CURRENT STATUS                                                 */}
      {/* ------------------------------------------------------------ */}
      <Card className="mb-4">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              user.isVerified ? "bg-success-light text-success-dark" : "bg-primary-50 text-primary-600"
            }`}
          >
            {user.isVerified ? <CheckIcon size={20} /> : <ShieldIcon size={20} />}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">
              {user.isVerified ? "Verified account" : pending ? "Your documents are being reviewed" : "Not verified yet"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {user.isVerified
                ? "You can message, pay, use escrow and leave reviews. Your badge shows on every listing, item and post you make."
                : pending
                  ? "Our team checks every submission by hand, usually within a few hours on a weekday. We will send you an SMS the moment it is decided."
                  : "Until you are verified you can still browse everything and save items to your shortlist. Messaging and payments stay locked."}
            </p>
            <div className="mt-2">
              <Badge tone={user.isVerified ? "success" : "gold"}>{user.verificationStatus.replace("_", " ").toLowerCase()}</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* HOW IT WORKS, PER ROLE                                         */}
      {/* ------------------------------------------------------------ */}
      <Card className="mb-4 bg-slate-50">
        <CardHeader title="What you need" subtitle="Only submit what matches your situation" />

        <div className="mt-3 space-y-2.5">
          {[
            {
              title: "Registered student",
              body: "Your matric number plus a clear photo of your DELSU student ID card. This unlocks everything, including the roommate board.",
            },
            {
              title: "Fresher not yet matriculated",
              body: "Your JAMB registration number plus your admission letter. This gives you a provisional account: browse and shortlist now, upgrade later with one tap.",
            },
            {
              title: "Landlord or caretaker",
              body: "A clear photo of the property plus an ownership document, tenancy agreement or letter of authority to manage it. An admin reviews it before your badge appears.",
            },
          ].map((block) => (
            <div key={block.title} className="rounded-xl bg-white p-3">
              <p className="text-xs font-bold text-slate-900">{block.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{block.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
          <LockIcon size={13} className="mt-px shrink-0" />
          Numbers and documents are encrypted at rest. No other user can ever see them, and they are never sent to the AI
          assistant.
        </p>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* THE FORM                                                       */}
      {/* ------------------------------------------------------------ */}
      {!user.isVerified && !pending ? (
        <>
          <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wide text-slate-400">Submit your proof</h2>
          <VerificationForm userRole={user.role} />
        </>
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/* MATRIC UPGRADE (JAMB -> MATRIC)                                */}
      {/* ------------------------------------------------------------ */}
      {user.role === "STUDENT" && !hasMatric ? (
        <div className="mb-4">
          {upgradePending ? (
            <Card className="border border-gold-300 bg-gold-50">
              <p className="text-sm font-bold text-gold-800">Matric upgrade in review</p>
              <p className="mt-1 text-xs leading-relaxed text-gold-800/90">
                Our team is checking your matric number against your ID card. You will get an SMS when it is done -
                after that your account is fully verified.
              </p>
            </Card>
          ) : (
            <MatricUpgradeForm />
          )}
        </div>
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/* HISTORY                                                        */}
      {/* ------------------------------------------------------------ */}
      {records.length > 0 ? (
        <>
          <h2 className="mb-3 mt-6 px-1 text-sm font-bold uppercase tracking-wide text-slate-400">Your submissions</h2>

          <StaggerList gap={12}>
            {records.map((record) => (
              <Card key={record.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">
                      {record.type === "STUDENT_ID" ? "Student ID" : record.type === "FRESHER_JAMB" ? "JAMB / admission letter" : "Landlord documents"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <ClockIcon size={12} />
                      {formatDateTime(record.submittedAt)}
                    </p>
                    {record.identifierLast4 ? (
                      <p className="mt-1 font-mono text-[11px] text-slate-500">Number ending {record.identifierLast4}</p>
                    ) : null}
                  </div>
                  <StatusBadge status={record.status} />
                </div>

                {record.adminNote ? (
                  <p
                    className={`mt-3 rounded-xl p-3 text-xs leading-relaxed ${
                      record.status === "APPROVED" ? "bg-success-light text-success-dark" : "bg-danger-light text-danger-dark"
                    }`}
                  >
                    <strong>Our team said:</strong> {record.adminNote}
                  </p>
                ) : null}

                {/* Show the documents they uploaded, so they can check they sent the right one. */}
                {record.documentUrls.length > 0 ? (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                    {record.documentUrls.map((url, index) => (
                      // A plain image is fine here: the URLs are our own Cloudinary links.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={index} src={url} alt={`Document ${index + 1}`} loading="lazy" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                    ))}
                  </div>
                ) : null}

                {record.status === "REJECTED" ? (
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <CloseIcon size={12} />
                    You can submit again with better documents using the form above.
                  </p>
                ) : null}
              </Card>
            ))}
          </StaggerList>
        </>
      ) : null}
    </PageTransition>
  );
}
