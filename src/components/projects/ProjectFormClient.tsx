/**
 * src/components/projects/ProjectFormClient.tsx
 * WHAT: The blind-pitch creation form: public teaser fields plus the private
 *       full pitch that stays locked until the owner approves someone.
 * WHY : Separating "public" and "private" inputs in the form teaches creators
 *       exactly what strangers will see.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select, TextArea, Segmented } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { PROJECT_DOMAINS, SKILL_TAGS } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * ProjectFormClient
 * WHAT: Collects and submits the pitch.
 */
export function ProjectFormClient() {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [domain, setDomain] = useState<string>(PROJECT_DOMAINS[0]);
  const [stage, setStage] = useState("IDEA");
  const [scope, setScope] = useState("SAME_SCHOOL");
  const [skillsNeeded, setSkillsNeeded] = useState<string[]>([]);
  const [fullDetails, setFullDetails] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** Toggles a needed-skill tag. */
  function toggleSkill(skill: string) {
    setSkillsNeeded((current) => (current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const result = await sendApi<{ id: string }>("/api/projects", "POST", {
      title: title.trim(),
      problem: problem.trim(),
      domain,
      stage,
      scope,
      skillsNeeded,
      fullDetails: fullDetails.trim(),
      contactNote: contactNote.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save the project.");
      return;
    }
    toast.success("Pitch created. Approve applicants to unlock the full details.");
    router.push(`/projects/${result.data?.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <CardHeader title="What the public sees" subtitle="Keep it high-level - this is your protection." />
        <div className="mt-3 space-y-3">
          <Input label="Project title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Campus Eats Map" required />
          <TextArea label="The problem (public teaser)" value={problem} onChange={(event) => setProblem(event.target.value)} rows={3} placeholder="Freshers waste money on bad food because..." required />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Domain" value={domain} onChange={(event) => setDomain(event.target.value)} options={PROJECT_DOMAINS.map((option) => ({ value: option, label: option }))} />
            <Select label="Stage" value={stage} onChange={(event) => setStage(event.target.value)} options={[
              { value: "IDEA", label: "Idea stage" },
              { value: "PROTOTYPE", label: "Prototype built" },
              { value: "MVP", label: "MVP live" },
              { value: "LAUNCHED", label: "Launched" },
            ]} />
          </div>
          <div>
            <p className="mc-label">Who can join?</p>
            <Segmented
              ariaLabel="Who can join?"
              value={scope}
              onChange={setScope}
              options={[
                { value: "SAME_SCHOOL", label: "Same school only" },
                { value: "NATIONAL", label: "All schools (national)" },
              ]}
            />
          </div>
          <div>
            <p className="mc-label">Skills you need</p>
            <div className="flex flex-wrap gap-2">
              {SKILL_TAGS.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  aria-pressed={skillsNeeded.includes(skill)}
                  className={cn(
                    "min-h-[36px] rounded-full border px-3.5 text-xs font-semibold transition-colors",
                    skillsNeeded.includes(skill) ? "border-primary-600 bg-primary-600 text-white" : "border-slate-200 text-slate-700"
                  )}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="The full pitch (private)" subtitle="Shown ONLY to applicants you approve." />
        <div className="mt-3 space-y-3">
          <TextArea label="Full details, plan and what you need" value={fullDetails} onChange={(event) => setFullDetails(event.target.value)} rows={5} placeholder="The real plan, the tech, the business model, the equity idea..." required />
          <Input label="Contact note (optional)" value={contactNote} onChange={(event) => setContactNote(event.target.value)} placeholder="e.g. WhatsApp me after approval" />
        </div>
      </Card>

      {error ? <p className="rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}
      <Button type="submit" fullWidth loading={saving}>
        Publish blind pitch
      </Button>
    </form>
  );
}
