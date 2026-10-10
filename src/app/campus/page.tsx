/**
 * src/app/campus/page.tsx
 * WHAT: The "Campus" hub - one tap from the phone bottom nav, it fans out into
 *       every student-life feature: Roommates, Community, Projects, Study Vault,
 *       Budget AI and Shortlist.
 * WHY : Five bottom-nav slots cannot hold eight features. A hub keeps the phone
 *       nav calm while still making everything one tap away.
 */
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { Card } from "@/components/ui/Card";
import { BagIcon, BoltIcon, CapIcon, ChatIcon, HeartIcon, PeopleIcon, SparkleIcon, TaskIcon } from "@/components/ui/Icons";

export const metadata = { title: "Campus hub" };
export const dynamic = "force-dynamic";

/** The hub cards, in the order students use them most. */
const HUB = [
  { href: "/roommates", label: "Roommate Board", blurb: "Match on habits, same-gender only, and rent together.", Icon: PeopleIcon },
  { href: "/community", label: "Community Board", blurb: "Campus gist and confessions - real names or anonymous.", Icon: ChatIcon },
  { href: "/food", label: "Food Directory", blurb: "Campus food spots. Order via WhatsApp - no cart, no delivery fees.", Icon: BagIcon },
  { href: "/errands", label: "Campus Errands", blurb: "Document drops, handovers, key runs. Post it or claim it and earn.", Icon: TaskIcon },
  { href: "/emergency", label: "Urgent 2k", blurb: "Ask for help anonymously, or help a classmate. No loans, no fees.", Icon: BoltIcon },
  { href: "/projects", label: "Project Hub", blurb: "Find co-founders with blind pitches that protect your idea.", Icon: BoltIcon },
  { href: "/study", label: "Study Vault", blurb: "Past questions and notes from your department. Give to get.", Icon: CapIcon },
  { href: "/budget", label: "Budget AI", blurb: "Tell it your money - it plans your semester from real listings.", Icon: SparkleIcon },
  { href: "/shortlist", label: "My Shortlist", blurb: "Everything you saved, in one place.", Icon: HeartIcon },
] as const;

/**
 * CampusPage
 * WHAT: Renders the hub grid.
 */
export default function CampusPage() {
  return (
    <PageTransition>
      <PageHeader title="Campus" subtitle="Student life, all in one place" />

      <div className="grid gap-3 sm:grid-cols-2">
        {HUB.map(({ href, label, blurb, Icon }) => (
          <Link key={href} href={href} className="block">
            <Card className="h-full transition-shadow hover:shadow-md">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                  <Icon size={22} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-slate-900">{label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{blurb}</span>
                </span>
              </div>
            </Card>
          </Link>
        ))}

        <Link href="/market" className="block sm:col-span-2">
          <Card className="transition-shadow hover:shadow-md">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-50 text-gold-700">
                <BagIcon size={22} />
              </span>
              <span>
                <span className="block text-sm font-bold text-slate-900">Graduating Student Drop</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                  Final-year students selling fast and cheap - the best deals on campus.
                </span>
              </span>
            </div>
          </Card>
        </Link>
      </div>
    </PageTransition>
  );
}
