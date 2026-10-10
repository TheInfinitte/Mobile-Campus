/**
 * src/components/admin/CommunityQueueClient.tsx
 * WHAT: Community moderation: every post WITH its true author (aliases are for
 *       the public only), plus remove/restore actions.
 * WHY : Secure anonymity = hidden from students, never hidden from moderators.
 */
"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useFetch } from "@/hooks/useFetch";
import { sendApi } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

type PostRow = {
  id: string;
  body: string;
  topic: string | null;
  isAnonymous: boolean;
  alias: string | null;
  status: string;
  createdAt: string;
  institution: string;
  replyCount: number;
  reportCount: number;
  author: { id: string; fullName: string; phone: string };
};

/**
 * CommunityQueueClient
 * WHAT: Lists community posts (reported-first ordering is server-side by date;
 *       report counts are shown so admins can triage).
 */
export function CommunityQueueClient() {
  const toast = useToast();
  const { data, loading, refetch } = useFetch<{ posts: PostRow[] }>("/api/admin/community?status=ALL");

  async function setStatus(id: string, status: "ACTIVE" | "REMOVED") {
    const result = await sendApi<{ id: string }>("/api/admin/community", "PATCH", { id, status });
    if (!result.ok) {
      toast.error(result.error ?? "Could not update.");
      return;
    }
    toast.success(status === "REMOVED" ? "Post removed." : "Post restored.");
    refetch();
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Anonymous posts show the real author HERE only. Students never see it.
      </p>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : (data?.posts ?? []).length === 0 ? (
        <Card>
          <p className="p-6 text-center text-sm text-slate-500">No community posts yet.</p>
        </Card>
      ) : (
        (data?.posts ?? []).map((post) => (
          <Card key={post.id} className={post.status === "REMOVED" ? "opacity-60" : ""}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-bold text-slate-900">
                    {post.isAnonymous ? post.alias : post.author.fullName}
                  </p>
                  {post.isAnonymous ? <Badge tone="gold">anonymous</Badge> : null}
                  {post.topic ? <Badge tone="slate">{post.topic}</Badge> : null}
                  <Badge tone="slate">{post.institution}</Badge>
                  {post.status === "REMOVED" ? <Badge tone="outline">removed</Badge> : null}
                </div>
                {/* Moderation-only true identity. */}
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Real author: {post.author.fullName} · {post.author.phone} · {formatDate(post.createdAt)} · {post.replyCount} replies · {post.reportCount} reports
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{post.body}</p>
                <div className="mt-2 flex gap-2">
                  {post.status === "ACTIVE" ? (
                    <Button size="sm" variant="secondary" onClick={() => setStatus(post.id, "REMOVED")}>Remove</Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setStatus(post.id, "ACTIVE")}>Restore</Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
