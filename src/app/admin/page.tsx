/**
 * src/app/admin/page.tsx
 * WHAT: The admin dashboard - queue counts, platform totals and revenue, all
 *       computed from the real database.
 * WHY : Everything an admin acts on lives behind one of these four numbers. If a
 *       queue is not empty, there is a link straight into it.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isStaff } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { StaggerList } from "@/components/motion/StaggerList";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ShieldIcon, AlertIcon, InfoIcon, HomeIcon, BagIcon, BoltIcon, PeopleIcon, MoneyIcon, ChartIcon, SettingsIcon, ChevronRightIcon } from "@/components/ui/Icons";
import { formatNaira } from "@/lib/money";

export const metadata = { title: "Admin dashboard" };
export const dynamic = "force-dynamic";

/**
 * AdminPage
 * WHAT: Runs every count in parallel and renders the dashboard.
 */
export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/admin");
  // Staff only: ADMIN or SUPER_ADMIN. Students and landlords go home.
  if (!isStaff(user.role)) redirect("/");

  const [
    pendingVerifications,
    openDisputes,
    openReports,
    activeLodges,
    totalUsers,
    verifiedUsers,
    provisionalUsers,
    availableItems,
    openGigs,
    released,
    held,
    refunded,
  ] = await Promise.all([
    prisma.verificationRecord.count({ where: { status: "PENDING" } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    prisma.report.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
    prisma.lodge.count({ where: { status: "ACTIVE" } }),
    prisma.user.count(),
    prisma.user.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.user.count({ where: { verificationStatus: "PROVISIONAL" } }),
    prisma.marketItem.count({ where: { status: "AVAILABLE" } }),
    prisma.gig.count({ where: { status: "OPEN" } }),
    prisma.escrowTransaction.aggregate({ where: { state: "RELEASED" }, _sum: { feeKobo: true, totalKobo: true }, _count: { id: true } }),
    prisma.escrowTransaction.aggregate({ where: { state: { in: ["HELD", "CONFIRMED", "DISPUTED"] } }, _sum: { totalKobo: true }, _count: { id: true } }),
    prisma.escrowTransaction.aggregate({ where: { state: "REFUNDED" }, _sum: { totalKobo: true }, _count: { id: true } }),
  ]);

  const earnedKobo = released._sum.feeKobo ?? 0;
  const volumeKobo = released._sum.totalKobo ?? 0;

  // Our take as a percentage of everything we moved - a health check on fees.
  const takeRate = volumeKobo > 0 ? ((earnedKobo / volumeKobo) * 100).toFixed(2) : "0.00";

  /** The three queues, each with its own colour so urgency reads instantly. */
  const queues = [
    {
      href: "/admin/verifications",
      label: "Verifications to review",
      value: pendingVerifications,
      hint: "Student IDs, JAMB proofs, landlord documents",
      icon: <ShieldIcon size={20} />,
      urgent: pendingVerifications > 0,
    },
    {
      href: "/admin/disputes",
      label: "Open disputes",
      value: openDisputes,
      hint: "Money frozen until you decide",
      icon: <AlertIcon size={20} />,
      urgent: openDisputes > 0,
    },
    {
      href: "/admin/reports",
      label: "Scam reports",
      value: openReports,
      hint: "Fake listings, harassment, fraud",
      icon: <InfoIcon size={20} />,
      urgent: openReports > 0,
    },
  ];

  return (
    <PageTransition>
      <PageHeader title="Admin" subtitle="Everything that needs a human decision" />

      {/* ------------------------------------------------------------ */}
      {/* QUEUES                                                         */}
      {/* ------------------------------------------------------------ */}
      <StaggerList gap={12} inView>
        {queues.map((queue) => (
          <Link key={queue.href} href={queue.href} className="block">
            <Card className={queue.urgent ? "border border-warn/40 bg-warn-light" : ""}>
              <div className="flex items-center gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${queue.urgent ? "bg-warn-dark text-white" : "bg-slate-50 text-slate-500"}`}>
                  {queue.icon}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    {queue.label}
                    {queue.urgent ? <Badge tone="gold">{queue.value} waiting</Badge> : <Badge tone="success">Clear</Badge>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{queue.hint}</p>
                </div>

                <span className="shrink-0 text-2xl font-bold tabular-nums text-slate-900">{queue.value}</span>
                <ChevronRightIcon size={16} className="shrink-0 text-slate-300" />
              </div>
            </Card>
          </Link>
        ))}
      </StaggerList>

      {/* ------------------------------------------------------------ */}
      {/* REVENUE                                                        */}
      {/* ------------------------------------------------------------ */}
      <Card className="mt-5 bg-primary-900 text-white">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-primary-200">
          <MoneyIcon size={14} />
          Fees earned
        </p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{formatNaira(earnedKobo)}</p>
        <p className="mt-1 text-[11px] text-primary-200">
          From {released._count.id ?? 0} completed {released._count.id === 1 ? "deal" : "deals"} worth {formatNaira(volumeKobo)} - a{" "}
          {takeRate}% take rate.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-primary-200">Held in escrow</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">{formatNaira(held._sum.totalKobo ?? 0)}</p>
            <p className="text-[10px] text-primary-200">{held._count.id ?? 0} payments</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-primary-200">Refunded</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">{formatNaira(refunded._sum.totalKobo ?? 0)}</p>
            <p className="text-[10px] text-primary-200">{refunded._count.id ?? 0} payments</p>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* PLATFORM                                                       */}
      {/* ------------------------------------------------------------ */}
      <Card className="mt-4">
        <CardHeader title="Platform" subtitle="How much of the campus is actually using it" />

        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            { label: "Accounts", value: totalUsers, note: `${verifiedUsers} verified · ${provisionalUsers} provisional`, icon: <PeopleIcon size={16} /> },
            { label: "Live listings", value: activeLodges, note: "Rooms students can book", icon: <HomeIcon size={16} /> },
            { label: "Items for sale", value: availableItems, note: "On the student market", icon: <ChartIcon size={16} /> },
            { label: "Open tasks", value: openGigs, note: "Waiting for someone to take them", icon: <ChartIcon size={16} /> },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-slate-50 p-3">
              <span className="inline-flex text-slate-400">{stat.icon}</span>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{stat.value}</p>
              <p className="text-xs font-semibold text-slate-700">{stat.label}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{stat.note}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* MANAGEMENT LINKS                                               */}
      {/* ------------------------------------------------------------ */}
      <Card padded={false} className="mt-4">
        <CardHeader title="Management" className="px-4 pt-4" />
        <div className="mt-2">
          {[
            { href: "/admin/food", label: "Food directory", hint: "Approve suggested food spots, manage sponsored slots", icon: <BagIcon size={18} /> },
            { href: "/admin/emergency", label: "Urgent 2k board", hint: "Goodwill requests, commitment trail and pause reviews", icon: <BoltIcon size={18} /> },
            { href: "/admin/listings", label: "All listings", hint: "Search, verify or take down any room", icon: <HomeIcon size={18} /> },
            { href: "/admin/fees", label: "Fee configuration", hint: "The single source of truth for what we charge", icon: <SettingsIcon size={18} /> },
            { href: "/admin/verifications", label: "Verification queue", hint: `${pendingVerifications} waiting`, icon: <ShieldIcon size={18} /> },
            { href: "/admin/disputes", label: "Dispute resolution", hint: `${openDisputes} open`, icon: <AlertIcon size={18} /> },
            { href: "/admin/reports", label: "Scam reports", hint: `${openReports} open`, icon: <InfoIcon size={18} /> },
          ].map((row) => (
            <Link key={row.href} href={row.href} className="flex min-h-[56px] items-center gap-3 border-t border-slate-100 px-4 py-3 transition-colors active:bg-slate-50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">{row.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">{row.label}</span>
                <span className="block truncate text-[11px] text-slate-500">{row.hint}</span>
              </span>
              <ChevronRightIcon size={16} className="shrink-0 text-slate-300" />
            </Link>
          ))}
        </div>
      </Card>

      <p className="mt-4 px-2 text-center text-[11px] leading-relaxed text-slate-400">
        Admin actions are logged. Approving a verification or resolving a dispute changes what thousands of students trust, so
        check the documents before you decide.
      </p>
    </PageTransition>
  );
}
