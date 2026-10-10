/**
 * src/app/notifications/page.tsx
 * WHAT: The in-app notification inbox.
 * WHY : SMS is used for the moments that matter (a code, money held in escrow),
 *       but everything else lands here so students are not spammed with texts.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { StaggerList } from "@/components/motion/StaggerList";
import { Card, EmptyState } from "@/components/ui/Card";
import { BellIcon, ShieldIcon, MoneyIcon, HomeIcon, BagIcon, TaskIcon } from "@/components/ui/Icons";
import { MarkAllReadButton } from "@/components/notifications/MarkAllReadButton";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

/**
 * Picks a small icon based on the words in the notification.
 * WHY : A visual hint lets a user scan the list faster than reading every title.
 */
function iconFor(title: string) {
  const text = title.toLowerCase();
  if (text.includes("escrow") || text.includes("payment") || text.includes("paid") || text.includes("released")) return <MoneyIcon size={16} />;
  if (text.includes("room") || text.includes("lodge") || text.includes("viewing") || text.includes("rent")) return <HomeIcon size={16} />;
  if (text.includes("market") || text.includes("sold") || text.includes("item")) return <BagIcon size={16} />;
  if (text.includes("gig") || text.includes("task")) return <TaskIcon size={16} />;
  if (text.includes("verif")) return <ShieldIcon size={16} />;
  return <BellIcon size={16} />;
}

/**
 * NotificationsPage
 * WHAT: Lists the newest 50 notifications, unread ones first.
 */
export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/notifications");

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, channel: "IN_APP" },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 50,
  });

  const unread = notifications.filter((item) => !item.isRead).length;

  return (
    <PageTransition>
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : "You are all caught up"}
        action={unread > 0 ? <MarkAllReadButton /> : undefined}
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<BellIcon size={32} />}
          title="Nothing yet"
          message="We will let you know when a landlord replies to your viewing request, when money is held in escrow, or when a match applies to your post."
          action={
            <Link href="/housing" className="mc-btn-primary">
              Browse housing
            </Link>
          }
        />
      ) : (
        <StaggerList gap={8} inView>
          {notifications.map((item) => {
            // The row is a link when the notification points somewhere, and a
            // plain div when it is just an FYI.
            const body = (
              <Card className={`flex items-start gap-3 ${item.isRead ? "opacity-70" : "border-l-4 border-l-primary-500"}`}>
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.isRead ? "bg-slate-100 text-slate-400" : "bg-primary-50 text-primary-600"}`}>
                    {iconFor(item.title)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${item.isRead ? "font-semibold text-slate-600" : "font-bold text-slate-900"}`}>{item.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{item.body}</p>
                    <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">{timeAgo(item.createdAt)}</p>
                  </div>

                  {!item.isRead ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-500" aria-label="Unread" /> : null}
              </Card>
            );

            return item.link ? (
              <Link key={item.id} href={item.link} className="block">
                {body}
              </Link>
            ) : (
              <div key={item.id} className="block">
                {body}
              </div>
            );
          })}
        </StaggerList>
      )}
    </PageTransition>
  );
}
