/**
 * src/app/escrow/page.tsx
 * WHAT: Lists every escrow transaction the signed-in user is part of, whether
 *       they are the payer or the payee.
 * WHY : Escrow is the trust layer of the whole platform. Users need one place to
 *       see where their money is and what action is waiting on them.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { StaggerList } from "@/components/motion/StaggerList";
import { Card, EmptyState } from "@/components/ui/Card";
import { EscrowStatePill } from "@/components/escrow/EscrowTracker";
import { ShieldIcon, MoneyIcon, ArrowRightIcon } from "@/components/ui/Icons";
import { formatNaira } from "@/lib/money";
import { stateLabel } from "@/lib/escrow";
import { timeAgo } from "@/lib/utils";
import type { EscrowState, EscrowType } from "@prisma/client";

export const metadata = { title: "My escrow" };
export const dynamic = "force-dynamic";

/** Which states still need the user to do something. */
const ACTIONABLE: EscrowState[] = ["PENDING_PAYMENT", "HELD", "DISPUTED"];

/**
 * One row from the query above, with its relations.
 * WHY : Written out explicitly because Prisma's inferred type for a query with
 *       `include` is not something you can name in a helper's signature.
 */
type EscrowRowData = {
  id: string;
  reference: string;
  type: EscrowType;
  state: EscrowState;
  totalKobo: number;
  payoutKobo: number;
  payerId: string;
  createdAt: Date;
  lodge: { id: string; title: string; area: string } | null;
  marketItem: { id: string; title: string } | null;
  gig: { id: string; title: string } | null;
  payer: { fullName: string };
  payee: { fullName: string };
};

/**
 * EscrowPage
 * WHAT: Groups transactions into "needs your action" and "completed".
 * WHY : Splitting the list stops a finished deal from burying the one that is
 *       about to expire.
 */
export default async function EscrowPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/escrow");

  const transactions = await prisma.escrowTransaction.findMany({
    where: { OR: [{ payerId: user.id }, { payeeId: user.id }] },
    include: {
      lodge: { select: { id: true, title: true, area: true } },
      marketItem: { select: { id: true, title: true } },
      gig: { select: { id: true, title: true } },
      payer: { select: { fullName: true } },
      payee: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const open = transactions.filter((tx) => ACTIONABLE.includes(tx.state));
  const done = transactions.filter((tx) => !ACTIONABLE.includes(tx.state));

  // Money currently held by us on behalf of both sides - a reassuring number.
  const heldTotal = transactions.filter((tx) => tx.state === "HELD" || tx.state === "CONFIRMED").reduce((sum, tx) => sum + tx.totalKobo, 0);

  return (
    <PageTransition>
      <PageHeader title="Escrow" subtitle="Money you have paid, and money waiting for you" />

      {/* ------------------------------------------------------------ */}
      {/* SUMMARY                                                       */}
      {/* ------------------------------------------------------------ */}
      {transactions.length > 0 ? (
        <Card className="mb-5 bg-primary-900 text-white">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary-200">
            <ShieldIcon size={13} />
            Currently held in escrow
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{formatNaira(heldTotal)}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-primary-200">
            Money in escrow cannot be touched by either side. It only moves when the buyer confirms, or when an admin resolves a
            dispute.
          </p>
        </Card>
      ) : null}

      {transactions.length === 0 ? (
        <EmptyState
          icon={<MoneyIcon size={32} />}
          title="No escrow transactions yet"
          message="When you buy something on the market, pay for a gig, or pay rent, the money is held here until both sides are happy."
          action={
            <Link href="/market" className="mc-btn-primary">
              Browse the market
            </Link>
          }
        />
      ) : (
        <>
          {open.length > 0 ? (
            <section className="mb-6">
              <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wide text-slate-400">Needs attention ({open.length})</h2>
              <StaggerList gap={12} inView>
                {open.map((tx) => (
                  <EscrowRow key={tx.id} tx={tx} myId={user.id} />
                ))}
              </StaggerList>
            </section>
          ) : null}

          {done.length > 0 ? (
            <section>
              <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wide text-slate-400">Completed ({done.length})</h2>
              <StaggerList gap={12} inView>
                {done.map((tx) => (
                  <EscrowRow key={tx.id} tx={tx} myId={user.id} />
                ))}
              </StaggerList>
            </section>
          ) : null}
        </>
      )}
    </PageTransition>
  );
}

/**
 * EscrowRow
 * WHAT: One transaction, showing what it was for and who the other side is.
 * WHY : The label "You paid" versus "Waiting for you" tells the user their role
 *       at a glance, which matters because they can be either.
 */
function EscrowRow({ tx, myId }: { tx: EscrowRowData; myId: string }) {
  // Work out what this deal was actually for.
  const subject = tx.lodge ? `${tx.lodge.title} (${tx.lodge.area})` : tx.marketItem?.title ?? tx.gig?.title ?? "Payment";
  const otherParty = tx.payerId === myId ? tx.payee.fullName : tx.payer.fullName;
  const direction = tx.payerId === myId ? "You paid" : "Waiting for you";

  return (
    <Link href={`/escrow/${tx.id}`} className="block">
      <Card className="transition-shadow hover:shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{subject}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {direction} · {otherParty}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-slate-400">{tx.reference}</p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-slate-900">{formatNaira(tx.totalKobo)}</p>
            <div className="mt-1 flex justify-end">
              <EscrowStatePill state={tx.state} />
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
          <p className="text-[11px] text-slate-400">
            {stateLabel(tx.state)} · {timeAgo(tx.createdAt)}
          </p>
          <span className="flex items-center gap-1 text-[11px] font-bold text-primary-700">
            Open
            <ArrowRightIcon size={12} />
          </span>
        </div>
      </Card>
    </Link>
  );
}
