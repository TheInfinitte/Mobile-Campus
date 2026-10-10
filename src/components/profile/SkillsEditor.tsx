/**
 * src/components/profile/SkillsEditor.tsx
 * WHAT: A chip picker where a student tags the skills they offer.
 * WHY : The Project Hub matches "projects for you" by skill tags, so the
 *       student needs a fast way to pick and change them from their profile.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { SKILL_TAGS } from "@/lib/data";
import { BoltIcon } from "@/components/ui/Icons";

/**
 * SkillsEditor
 * WHAT: Toggle chips + save. Sends PATCH /api/profile/skills.
 */
export function SkillsEditor({ initialSkills }: { initialSkills: string[] }) {
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>(initialSkills);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...initialSkills].sort());

  /** Flips one skill on or off. */
  function toggle(skill: string) {
    setSelected((current) =>
      current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]
    );
  }

  async function save() {
    setSaving(true);
    const result = await sendApi<{ skills: string[] }>("/api/profile/skills", "PATCH", { skills: selected });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not save your skills.");
      return;
    }
    toast.success("Skills saved.");
  }

  return (
    <Card className="mt-4">
      <CardHeader
        title="My skills"
        subtitle="Used to match you with project co-founders who need exactly what you do."
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {SKILL_TAGS.map((skill) => {
          const active = selected.includes(skill);
          return (
            <button
              key={skill}
              type="button"
              onClick={() => toggle(skill)}
              aria-pressed={active}
              className={`min-h-11 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-primary-300"
              }`}
            >
              {skill}
            </button>
          );
        })}
      </div>
      <Button className="mt-3" onClick={save} loading={saving} disabled={!dirty}>
        <BoltIcon size={16} /> Save skills
      </Button>
    </Card>
  );
}
