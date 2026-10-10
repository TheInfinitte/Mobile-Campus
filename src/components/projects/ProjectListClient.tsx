/**
 * src/components/projects/ProjectListClient.tsx
 * WHAT: Blind-pitch project list with an "All" and a skill-matched "For you" tab.
 * WHY : Public cards show ONLY the teaser (problem, domain, stage, skills) so
 *       ideas cannot be copied. The full pitch unlocks after approval.
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Card, EmptyState } from "@/components/ui/Card";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { BoltIcon, LockIcon, PeopleIcon, PlusIcon } from "@/components/ui/Icons";
import { useFetch } from "@/hooks/useFetch";
import { useSession } from "@/components/layout/Shell";
import { PROJECT_SCOPE_LABELS, PROJECT_STAGE_LABELS } from "@/lib/data";
import { cn } from "@/lib/utils";

type ProjectView = {
  id: string;
  title: string;
  problem: string;
  domain: string;
  stage: string;
  skillsNeeded: string[];
  scope: string;
  institution: string;
  applicationCount: number;
  owner: { id: string; fullName: string; level: string | null };
  myApplicationStatus: string | null;
};

/**
 * ProjectListClient
 * WHAT: Fetches and renders the teaser cards.
 */
export function ProjectListClient() {
  const { user } = useSession();
  const [tab, setTab] = useState<"all" | "forYou">("all");
  const url = tab === "forYou" ? "/api/projects?tab=forYou" : "/api/projects";
  const { data, loading } = useFetch<{ projects: ProjectView[] }>(url);

  return (
    <div className="space-y-4">
      {/* Tabs + create button */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {(["all", "forYou"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={cn(
                "min-h-[36px] rounded-lg px-3.5 text-xs font-bold transition-colors",
                tab === key ? "bg-primary-600 text-white" : "text-slate-600"
              )}
            >
              {key === "all" ? "All projects" : "For you"}
            </button>
          ))}
        </div>
        {user?.role === "STUDENT" ? (
          <Link href="/projects/new" className="mc-btn-primary ml-auto inline-flex h-10 items-center gap-1.5 px-3.5 text-xs">
            <PlusIcon size={15} /> Pitch a project
          </Link>
        ) : null}
      </div>

      {tab === "forYou" ? (
        <p className="rounded-xl bg-primary-50 p-3 text-xs font-medium text-primary-800">
          Matched using the skills on your profile. Add or edit your skills from your Profile page.
        </p>
      ) : null}

      {loading ? (
        <ListSkeleton rows={3} />
      ) : (data?.projects ?? []).length === 0 ? (
        <EmptyState
          icon={<BoltIcon size={28} />}
          title={tab === "forYou" ? "No matches yet" : "No open projects yet"}
          message={tab === "forYou" ? "Add your skills on your profile and teams that need them will show up here." : "Be the first - pitch an idea and find your co-founders."}
        />
      ) : (
        (data?.projects ?? []).map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`} className="block">
            <Card className="transition-shadow hover:shadow-md">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                  <BoltIcon size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-bold text-slate-900">{project.title}</p>
                    {project.scope === "NATIONAL" ? <Badge tone="gold">{PROJECT_SCOPE_LABELS[project.scope]}</Badge> : <Badge tone="slate">{project.institution}</Badge>}
                    <Badge tone="outline">{PROJECT_STAGE_LABELS[project.stage] ?? project.stage}</Badge>
                    {project.myApplicationStatus ? <VerifiedBadge /> : null}
                  </div>
                  {/* BLIND PITCH: only the high-level problem is public. */}
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{project.problem}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone="primary">{project.domain}</Badge>
                    {project.skillsNeeded.map((skill) => (
                      <Badge key={skill} tone="slate">{skill}</Badge>
                    ))}
                    <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <LockIcon size={12} /> Full pitch locked
                      <span className="ml-2 inline-flex items-center gap-1"><PeopleIcon size={12} /> {project.applicationCount}</span>
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}
