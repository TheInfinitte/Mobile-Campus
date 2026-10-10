/**
 * src/app/profile/page.tsx
 * WHAT: The Profile tab - who you are, how far through verification you are, and
 *       links to everything you own on the platform.
 * WHY : This is the home of account trust. A student should be able to see at a
 *       glance whether they can pay, message and review, or whether something is
 *       still pending.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, canPayAndMessage, upgradeMessage } from "@/lib/auth";
import { PageTransition } from "@/components/motion/PageTransition";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/SmartImage";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { SkillsEditor } from "@/components/profile/SkillsEditor";
import {
  ShieldIcon,
  HeartIcon,
  MoneyIcon,
  BellIcon,
  HomeIcon,
  BagIcon,
  TaskIcon,
  PeopleIcon,
  ChevronRightIcon,
  SettingsIcon,
  CapIcon,
} from "@/components/ui/Icons";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

/**
 * ProfilePage
 * WHAT: Shows the account, its verification state, and quick counts.
 */
export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  // Counts for the quick tiles and the link hints. Read in parallel so the page
  // does not wait for four queries one after another.
  const [shortlistCount, escrowCount, listings, myPosts, unreadCount] = await Promise.all([
    prisma.shortlist.count({ where: { userId: user.id } }),
    prisma.escrowTransaction.count({ where: { OR: [{ payerId: user.id }, { payeeId: user.id }] } }),
    user.role === "LANDLORD" ? prisma.lodge.count({ where: { landlordId: user.id } }) : Promise.resolve(0),
    prisma.roommatePost.count({ where: { authorId: user.id } }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  // The most recent verification request, so we can show its status and any
  // note an admin left behind.
  const latestVerification = await prisma.verificationRecord.findFirst({
    where: { userId: user.id },
    orderBy: { submittedAt: "desc" },
  });

  // Full access means messaging, payments and escrow are all switched on.
  const fullAccess = canPayAndMessage(user);

  /** Builds the list of navigation rows for this user's role. */
  const rows: { href: string; label: string; hint: string; icon: React.ReactNode }[] = [
    ...(user.role === "LANDLORD"
      ? [{ href: "/landlord", label: "My listings and tenants", hint: `${listings} ${listings === 1 ? "listing" : "listings"}`, icon: <HomeIcon size={18} /> }]
      : []),
    ...(user.role === "ADMIN"
      ? [{ href: "/admin", label: "Admin dashboard", hint: "Verifications, disputes, revenue", icon: <SettingsIcon size={18} /> }]
      : []),
    { href: "/shortlist", label: "My shortlist", hint: "Rooms and items you saved", icon: <HeartIcon size={18} /> },
    { href: "/escrow", label: "Escrow payments", hint: "Money held, released and refunded", icon: <MoneyIcon size={18} /> },
    { href: "/roommates/matches", label: "Roommate matches", hint: "Your compatibility results", icon: <PeopleIcon size={18} /> },
    { href: "/roommates", label: "Roommate board", hint: `${myPosts} of your ${myPosts === 1 ? "post is" : "posts are"} on it`, icon: <TaskIcon size={18} /> },
    { href: "/profile/roommate", label: "Roommate quiz answers", hint: "Change how you sleep, study and budget", icon: <PeopleIcon size={18} /> },
    { href: "/market", label: "Buy and sell", hint: "The student market and graduating drops", icon: <BagIcon size={18} /> },
    { href: "/notifications", label: "Notifications", hint: unreadCount > 0 ? `${unreadCount} unread` : "All read", icon: <BellIcon size={18} /> },
  ];

  return (
    <PageTransition>
      {/* ------------------------------------------------------------ */}
      {/* IDENTITY CARD                                                  */}
      {/* ------------------------------------------------------------ */}
      <Card className="mb-4">
        <div className="flex items-start gap-3.5">
          <Avatar src={user.avatarUrl} name={user.fullName} size={56} />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">{user.fullName}</h1>
            <p className="mt-0.5 text-xs text-slate-500">{user.phone}</p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {user.isVerified ? <VerifiedBadge /> : null}

              {user.role === "STUDENT" ? (
                <Badge tone="primary" icon={<CapIcon size={11} />}>
                  Student{user.level ? ` · ${user.level}` : ""}
                </Badge>
              ) : null}

              {user.role === "LANDLORD" ? (
                <Badge tone="gold" icon={<HomeIcon size={11} />}>
                  Landlord
                </Badge>
              ) : null}

              {user.role === "ADMIN" ? <Badge tone="slate">Administrator</Badge> : null}

              {/* Provisional = JAMB proof accepted, not yet a registered student. */}
              {!user.isVerified && user.role === "STUDENT" ? <Badge tone="gold">Provisional account</Badge> : null}
            </div>

            {user.department ? <p className="mt-2 text-[11px] text-slate-500">{user.department}</p> : null}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-400">Joined {formatDate(user.createdAt)}</p>
          <LogoutButton />
        </div>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* VERIFICATION STATUS                                            */}
      {/* ------------------------------------------------------------ */}
      <Link href="/profile/verification" className="mb-4 block">
        <Card className={fullAccess ? "border border-success/30 bg-success-light" : "border border-warn/30 bg-warn-light"}>
          <div className="flex items-start gap-3">
            <ShieldIcon size={20} className={fullAccess ? "mt-0.5 shrink-0 text-success-dark" : "mt-0.5 shrink-0 text-warn-dark"} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${fullAccess ? "text-success-dark" : "text-warn-dark"}`}>
                {user.isVerified
                  ? "You are verified"
                  : latestVerification?.status === "PENDING"
                    ? "Verification under review"
                    : latestVerification?.status === "REJECTED"
                      ? "Verification was not approved"
                      : "Complete your verification"}
              </p>
              <p className={`mt-1 text-xs leading-relaxed ${fullAccess ? "text-success-dark/90" : "text-warn-dark/90"}`}>
                {fullAccess ? "You can message landlords, pay rent, buy with escrow and leave reviews." : upgradeMessage()}
              </p>
              {latestVerification?.adminNote ? (
                <p className="mt-2 rounded-lg bg-white p-2 text-[11px] text-slate-700">
                  <strong>Note from our team:</strong> {latestVerification.adminNote}
                </p>
              ) : null}
            </div>
            <ChevronRightIcon size={18} className="mt-1 shrink-0 text-slate-400" />
          </div>
        </Card>
      </Link>

      {/* ------------------------------------------------------------ */}
      {/* QUICK TILES                                                    */}
      {/* ------------------------------------------------------------ */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { href: "/shortlist", label: "Saved", value: shortlistCount, icon: <HeartIcon size={16} /> },
          { href: "/escrow", label: "Payments", value: escrowCount, icon: <MoneyIcon size={16} /> },
          { href: "/notifications", label: "Alerts", value: unreadCount, icon: <BellIcon size={16} /> },
        ].map((tile) => (
          <Link key={tile.href} href={tile.href} className="block">
            <Card className="h-full p-3 text-center">
              <span className="inline-flex text-primary-600">{tile.icon}</span>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{tile.value}</p>
              <p className="text-[11px] text-slate-500">{tile.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* ------------------------------------------------------------ */}
      {/* LINKS                                                          */}
      {/* ------------------------------------------------------------ */}
      <Card padded={false}>
        <CardHeader title="My activity" className="px-4 pt-4" />

        <div className="mt-2">
          {rows.map((row) => (
            <Link
              key={row.href}
              href={row.href}
              className="flex min-h-[56px] items-center gap-3 border-t border-slate-100 px-4 py-3 transition-colors active:bg-slate-50"
            >
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

      {/* ------------------------------------------------------------ */}
      {/* DATA PROTECTION NOTE                                           */}
      {/* ------------------------------------------------------------ */}
      {/* STUDENT ONLY: skill tags power the project co-founder matcher. */}
      {user.role === "STUDENT" ? <SkillsEditor initialSkills={user.skills ?? []} /> : null}

      <Card className="mt-4 bg-slate-50">
        <p className="text-[11px] leading-relaxed text-slate-600">
          <strong className="text-slate-800">Your data.</strong> Your matric number, JAMB number and any ID image you uploaded are
          encrypted in our database. Other users never see them. Under the Nigeria Data Protection Act you can ask us to delete
          your account and everything attached to it at any time - email support@mobilecampus.ng.
        </p>
      </Card>
    </PageTransition>
  );
}
