/**
 * src/components/budget/BudgetChat.tsx
 * WHAT: The chat-style interface of the AI Budget Assistant: quick-pick chips,
 *       a text box that understands "I have 150k", animated result cards and
 *       smart suggestions.
 * WHY : This is the flagship feature. A student types one sentence and gets real
 *       lodges, items and gigs they can afford, with the maths shown.
 *
 * IMPORTANT: All AI work happens on the server (POST /api/budget/chat). This
 * component never sees the Anthropic key and never sends personal data.
 */
"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Card";
import { SparkleIcon, SendIcon, InfoIcon } from "@/components/ui/Icons";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { AffordabilityPanel, GigMatchCard, ItemMatchCard, LodgeMatchCard } from "./BudgetResultCard";
import type { BudgetPlan } from "@/types/budget";

/** One-tap example prompts. Most students will use these instead of typing. */
const QUICK_PROMPTS = [
  "I have 150k for rent and a fan",
  "I need a room under 80k in Ekrejeta",
  "Show me rooms under 40k with borehole",
  "I have 300k, can I get a self contain?",
  "I need a mattress and a gas cylinder under 60k",
  "Looking for a roommate to split a room",
];

/**
 * BudgetChat
 * WHAT: The whole assistant screen.
 * WHY : Keeping the input, the results and the suggestions in one component
 *       means the results animate in as one coherent answer.
 */
export function BudgetChat({ canUse }: { canUse: boolean }) {
  const toast = useToast();
  const reducedMotion = useReducedMotion();

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  const [error, setError] = useState("");

  /** Sends the message to our server, which talks to Claude and the database. */
  async function ask(message: string) {
    const text = message.trim();
    if (!text) return;

    setPrompt(text);
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/budget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
        credentials: "same-origin",
        cache: "no-store",
      });

      const payload = (await response.json()) as { data?: BudgetPlan; error?: string };

      if (!response.ok || !payload.data) {
        setError(payload.error ?? "The assistant is not responding. Please try again.");
        setLoading(false);
        return;
      }

      setPlan(payload.data);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  /** Handles the form submit. */
  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    void ask(prompt);
  }

  return (
    <div className="space-y-4">
      {/* --------------------------------------------------------------- */}
      {/* THE INPUT CARD                                                   */}
      {/* --------------------------------------------------------------- */}
      <Card className="relative overflow-hidden">
        {/* A subtle gradient wash so this card feels special. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary-50/80 to-transparent" aria-hidden="true" />

        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white">
              <SparkleIcon size={18} />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">Tell me what you have</p>
              <p className="text-[11px] text-slate-500">I match it to real lodges, items and gigs at DELSU</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-4 flex gap-2">
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder='e.g. "I have 150k" or "room under 80k + fan under 15k"'
              aria-label="Describe your budget"
              maxLength={400}
              className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            <Button type="submit" loading={loading} aria-label="Ask the assistant" className="px-4">
              <SendIcon size={18} />
            </Button>
          </form>

          {/* Quick prompts - tap instead of type. */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {QUICK_PROMPTS.map((quick) => (
              <button
                key={quick}
                type="button"
                onClick={() => void ask(quick)}
                disabled={loading}
                className="mc-chip shrink-0 whitespace-nowrap disabled:opacity-50"
              >
                {quick}
              </button>
            ))}
          </div>

          {/* Honest note about how it works. */}
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
            <InfoIcon size={13} className="mt-px shrink-0" />
            Only real listings from our database are shown - nothing is invented. We never send your name, phone number or
            matric number to the AI.
          </p>
        </div>
      </Card>

      {/* --------------------------------------------------------------- */}
      {/* RESULTS                                                          */}
      {/* --------------------------------------------------------------- */}
      {loading ? <ListSkeleton rows={4} /> : null}

      {error ? (
        <Card className="border border-danger/20 bg-danger-light">
          <p className="text-xs font-semibold text-danger-dark">{error}</p>
          <p className="mt-1 text-[11px] text-danger-dark/80">
            Tip: you can also use the filters on the Housing and Market pages to search by price directly.
          </p>
        </Card>
      ) : null}

      <AnimatePresence>
        {plan && !loading ? (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26 }}
            className="space-y-4"
          >
            {/* What the assistant understood, and how it got the answer. */}
            <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-snug text-slate-900">{plan.summary}</p>
                <Badge tone={plan.source === "AI" ? "primary" : "slate"} className="shrink-0">
                  {plan.source === "AI" ? "AI matched" : "Smart filters"}
                </Badge>
              </div>

              {/* The parsed amounts, so the user can see we understood them. */}
              {plan.intent.needs.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {plan.intent.needs.map((need, index) => (
                    <Badge key={index} tone="outline">
                      {need.description}
                      {need.maxKobo > 0 ? ` • under ₦${(need.maxKobo / 100).toLocaleString("en-NG")}` : ""}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            {/* The affordability breakdown for housing. */}
            {plan.breakdown ? <AffordabilityPanel plan={plan} /> : null}

            {/* Nothing found. */}
            {plan.empty ? (
              <EmptyState
                icon={<SparkleIcon size={32} />}
                title="Nothing fits that budget yet"
                message="Try a slightly higher amount, a different area, or check the Roommate Board to split a bigger room with someone."
                action={
                  <Button variant="secondary" onClick={() => setPlan(null)}>
                    Try another amount
                  </Button>
                }
              />
            ) : null}

            {/* Matched lodges */}
            {plan.lodges.length > 0 ? (
              <section>
                <h2 className="mb-2.5 px-1 text-sm font-bold text-slate-900">
                  Lodges that fit{" "}
                  <span className="font-medium text-slate-400">({plan.lodges.length})</span>
                </h2>
                <div className="space-y-2.5">
                  {plan.lodges.map((lodge, index) => (
                    <LodgeMatchCard key={lodge.id} lodge={lodge} index={index} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Matched market items */}
            {plan.items.length > 0 ? (
              <section>
                <h2 className="mb-2.5 px-1 text-sm font-bold text-slate-900">
                  Items to buy{" "}
                  <span className="font-medium text-slate-400">({plan.items.length})</span>
                </h2>
                <div className="space-y-2.5">
                  {plan.items.map((item, index) => (
                    <ItemMatchCard key={item.id} item={item} index={index} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Matched gigs */}
            {plan.gigs.length > 0 ? (
              <section>
                <h2 className="mb-2.5 px-1 text-sm font-bold text-slate-900">
                  Gigs you could earn from{" "}
                  <span className="font-medium text-slate-400">({plan.gigs.length})</span>
                </h2>
                <div className="space-y-2.5">
                  {plan.gigs.map((gig, index) => (
                    <GigMatchCard key={gig.id} gig={gig} index={index} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Smart suggestions */}
            {plan.suggestions.length > 0 ? (
              <Card>
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <SparkleIcon size={16} className="text-gold-500" />
                  Smart suggestions
                </h2>
                <ul className="mt-2.5 space-y-2">
                  {plan.suggestions.map((suggestion) => (
                    <li key={suggestion} className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {/* Permission notice for provisional (fresher) accounts. */}
            {!canUse ? (
              <Card className="border border-primary-200 bg-primary-50/50">
                <p className="text-xs leading-relaxed text-primary-900">
                  You can browse and shortlist as a fresher. Submit your matric number after registration to unlock escrow
                  payments and messaging landlords.
                </p>
              </Card>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
