/**
 * src/app/budget/page.tsx
 * WHAT: The AI Budget Assistant's own tab.
 * WHY : This is a headline feature, so it gets a full page as well as the floating
 *       button on the Housing and Market screens. The chat itself is a client
 *       component because it streams a conversation with the server.
 */
import { getSessionUser, canPayAndMessage } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { BudgetChat } from "@/components/budget/BudgetChat";
import { Card } from "@/components/ui/Card";
import { LockIcon, SparkleIcon } from "@/components/ui/Icons";

export const metadata = { title: "AI Budget Assistant" };
export const dynamic = "force-dynamic";

/**
 * BudgetPage
 * WHAT: Renders the assistant plus a short explanation of how it works.
 * WHY : Explaining the mechanism ("real listings, never invented") builds the
 *       trust the feature depends on.
 */
export default async function BudgetPage() {
  const user = await getSessionUser();

  return (
    <PageTransition>
      <PageHeader title="Budget AI" subtitle="Tell me what you have. I will show you what it actually covers." />

      <BudgetChat canUse={user ? canPayAndMessage(user) : false} />

      {/* How it works - three short, honest points. */}
      <Card className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <SparkleIcon size={16} className="text-primary-600" />
          How this works
        </h2>

        <ol className="mt-3 space-y-2.5">
          {[
            "You type an amount in normal language - \"I have 150k\" or \"a room under 80k and a fan under 15k\".",
            "Our server reads the amounts and what you are looking for, then searches the real DELSU listings database.",
            "You get matched lodges, items and gigs with the maths shown - rent, caution fee, our fee and move-in items.",
          ].map((step, index) => (
            <li key={index} className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-bold text-primary-700">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
          <LockIcon size={14} className="mt-px shrink-0 text-slate-400" />
          Your name, phone number and matric number are never sent to the AI. Only the sentence you type is, and only to work
          out the amounts.
        </p>
      </Card>
    </PageTransition>
  );
}
