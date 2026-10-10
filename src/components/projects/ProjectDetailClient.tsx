/**
 * src/components/projects/ProjectDetailClient.tsx
 * WHAT: One project: teaser for everyone, full pitch only after the owner
 *       approves your application; the owner sees the applicant queue.
 * WHY : This is the blind-pitch unlock flow in UI form.
 */
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { TextArea } from "@/components/ui/Input";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/SmartImage";
import { useToast } from "@/components/ui/Toast";
import { BoltIcon, LockIcon, CheckIcon, CloseIcon } from "@/components/ui/Icons";
import { useFetch } from "@/hooks/useFetch";
import { useSession } from "@/components/layout/Shell";
import { sendApi } from "@/lib/api-client";
import { PROJECT_SCOPE_LABELS, PROJECT_STAGE_LABELS, SKILL_TAGS } from "@/lib/data";
import { cn } from "@/lib/utils";

type ProjectDetail = {
  id: string;
  title: string;
  problem: string;
  domain: string;
  stage: string;
  skillsNeeded: string[];
  scope: string;
  status: string;
  institution: { shortName: string; name: string };
  owner: { id: string; fullName: string; level: string | null; department: string | null };
  isOwner: boolean;
  unlocked: boolean;
  fullDetails: string | null;
  contactNote: string | null;
  myApplication: { id: string; status: string; message: string; skillsOffered: string[] } | null;
};

type ApplicationView = {
  id: string;
  status: string;
  message: string;
  skillsOffered: string[];
  applicant: { id: string; fullName: string; avatarUrl: string | null; level: string | null; department: string | null; skills: string[] };
};

/**
 * ProjectDetailClient
 * WHAT: Fetches /api/projects/:id and renders the right state for the viewer.
 */
export function ProjectDetailClient({ id }: { id: string }) {
  const { user } = useSession();
  const toast = useToast();
  const { data, loading, refetch } = useFetch<{ project: ProjectDetail }>(`/api/projects/${id}`);
  const project = data?.project ?? null;

  // Application form state.
  const [message, setMessage] = useState("");
  const [skillsOffered, setSkillsOffered] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  // Owner queue.
  const { data: applicationsData, refetch: refetchApplications } = useFetch<{ applications: ApplicationView[] }>(
    project?.isOwner ? `/api/projects/${id}/applications` : null
  );

  function toggleSkill(skill: string) {
    setSkillsOffered((current) => (current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]));
  }

  async function apply() {
    setApplying(true);
    const result = await sendApi<{ id: string }>(`/api/projects/${id}/applications`, "POST", {
      message: message.trim(),
      skillsOffered,
    });
    setApplying(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not apply.");
      return;
    }
    toast.success("Application sent. The full pitch unlocks when the owner approves you.");
    refetch();
  }

  async function decide(applicationId: string, decision: "APPROVED" | "DECLINED") {
    const result = await sendApi<{ id: string }>(`/api/projects/${id}/applications`, "PATCH", { applicationId, decision });
    if (!result.ok) {
      toast.error(result.error ?? "Could not update the application.");
      return;
    }
    toast.success(decision === "APPROVED" ? "Approved - they can now see the full pitch." : "Declined.");
    refetchApplications();
  }

  if (loading || !project) {
    return <ListSkeleton rows={2} />;
  }

  return (
    <div className="space-y-4">
      {/* ------------------------- TEASER -------------------------------- */}
      <Card>
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <BoltIcon size={24} />
          </span>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">{project.title}</h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge tone="primary">{project.domain}</Badge>
              <Badge tone="outline">{PROJECT_STAGE_LABELS[project.stage] ?? project.stage}</Badge>
              <Badge tone={project.scope === "NATIONAL" ? "gold" : "slate"}>{PROJECT_SCOPE_LABELS[project.scope]}</Badge>
              <Badge tone="slate">{project.institution.shortName}</Badge>
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{project.problem}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {project.skillsNeeded.map((skill) => (
            <Badge key={skill} tone="slate">Needs: {skill}</Badge>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Started by {project.owner.fullName} · {project.owner.level ?? "Student"}</p>
      </Card>

      {/* ------------------------- FULL PITCH / LOCK --------------------- */}
      {project.isOwner || project.unlocked ? (
        <Card>
          <CardHeader title="Full pitch" subtitle={project.isOwner ? "Only you and approved teammates can see this." : "Unlocked for you."} />
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{project.fullDetails}</p>
          {project.contactNote ? <p className="mt-3 rounded-xl bg-gold-50 p-3 text-xs font-semibold text-gold-800">Contact: {project.contactNote}</p> : null}
        </Card>
      ) : (
        <Card className="bg-slate-900 text-white">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-gold-300">
              <LockIcon size={20} />
            </span>
            <div>
              <p className="text-sm font-bold">The full pitch is locked</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Apply below. When {project.owner.fullName.split(" ")[0]} approves you, the plan, contact and next steps unlock here.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ------------------------- APPLICATION --------------------------- */}
      {!project.isOwner && user?.role === "STUDENT" && !project.unlocked ? (
        project.myApplication ? (
          <Card>
            <p className="text-sm font-semibold text-slate-700">
              Application status:{" "}
              <span className={cn("font-extrabold", project.myApplication.status === "PENDING" ? "text-gold-700" : project.myApplication.status === "APPROVED" ? "text-green-700" : "text-danger")}>
                {project.myApplication.status}
              </span>
            </p>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Apply to collaborate" subtitle="Tell the owner what you bring. Approval unlocks the full pitch." />
            <div className="mt-3 space-y-3">
              <TextArea label="Why you?" value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="I can help because..." />
              <div>
                <p className="mc-label">Skills you offer</p>
                <div className="flex flex-wrap gap-2">
                  {SKILL_TAGS.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      aria-pressed={skillsOffered.includes(skill)}
                      className={cn(
                        "min-h-[36px] rounded-full border px-3.5 text-xs font-semibold transition-colors",
                        skillsOffered.includes(skill) ? "border-primary-600 bg-primary-600 text-white" : "border-slate-200 text-slate-700"
                      )}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
              <Button fullWidth loading={applying} onClick={apply} disabled={message.trim().length < 10 || skillsOffered.length === 0}>
                Send application
              </Button>
            </div>
          </Card>
        )
      ) : null}

      {/* ------------------------- OWNER QUEUE --------------------------- */}
      {project.isOwner ? (
        <Card>
          <CardHeader title="Applicants" subtitle="Approving someone unlocks the full pitch for them." />
          <div className="mt-3 space-y-3">
            {(applicationsData?.applications ?? []).length === 0 ? (
              <p className="text-xs text-slate-500">No applicants yet.</p>
            ) : (
              (applicationsData?.applications ?? []).map((application) => (
                <div key={application.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <Avatar src={application.applicant.avatarUrl} name={application.applicant.fullName} size={34} />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{application.applicant.fullName}</p>
                      <p className="text-[11px] text-slate-500">{[application.applicant.level, application.applicant.department].filter(Boolean).join(" · ")}</p>
                    </div>
                    <Badge tone={application.status === "APPROVED" ? "primary" : application.status === "DECLINED" ? "slate" : "gold"}>
                      {application.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-700">{application.message}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {application.skillsOffered.map((skill) => (
                      <Badge key={skill} tone="slate">{skill}</Badge>
                    ))}
                  </div>
                  {application.status === "PENDING" ? (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => decide(application.id, "APPROVED")}>
                        <CheckIcon size={14} /> Approve
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => decide(application.id, "DECLINED")}>
                        <CloseIcon size={14} /> Decline
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
