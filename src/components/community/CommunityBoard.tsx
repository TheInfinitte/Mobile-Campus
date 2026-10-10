/**
 * src/components/community/CommunityBoard.tsx
 * WHAT: The community (gist) board: composer with Anonymous Mode, topic chips,
 *       threaded replies, report and author-delete.
 * WHY : Real identities by default build trust; the anonymous toggle protects
 *       sensitive posts. The server hides anonymous author ids - this client
 *       simply renders whatever the API returns.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TextArea, Select, Checkbox } from "@/components/ui/Input";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/SmartImage";
import { useToast } from "@/components/ui/Toast";
import { ChatIcon, SendIcon, TrashIcon, AlertIcon } from "@/components/ui/Icons";
import { ReportModal } from "@/components/shared/ReportModal";
import { useFetch } from "@/hooks/useFetch";
import { useSession } from "@/components/layout/Shell";
import { sendApi } from "@/lib/api-client";
import { COMMUNITY_TOPICS } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** One post as the API returns it. Anonymous posts have author = null. */
type PostView = {
  id: string;
  topic: string | null;
  body: string;
  isAnonymous: boolean;
  alias: string | null;
  replyCount: number;
  createdAt: string;
  author: { id: string; fullName: string; avatarUrl: string | null; level: string | null; department: string | null } | null;
  isMine: boolean;
};

/** GET helper - sendApi only covers mutating verbs. */
async function getJson<T>(url: string): Promise<{ ok: boolean; data: T | null; error?: string }> {
  try {
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    const payload = (await response.json()) as { data?: T; error?: string };
    if (!response.ok || payload.error) return { ok: false, data: null, error: payload.error ?? "Request failed" };
    return { ok: true, data: (payload.data as T) ?? null };
  } catch {
    return { ok: false, data: null, error: "Could not reach the server." };
  }
}

type ReplyView = {
  id: string;
  body: string;
  createdAt: string;
  isAnonymous: boolean;
  alias: string | null;
  isMine: boolean;
  author: { id: string; fullName: string; avatarUrl: string | null } | null;
};

/**
 * CommunityBoard
 * WHAT: The whole board in one client component.
 */
export function CommunityBoard() {
  const { user } = useSession();
  const toast = useToast();

  // Topic filter chip state.
  const [topic, setTopic] = useState("");
  const url = `/api/community${topic ? `?topic=${encodeURIComponent(topic)}` : ""}`;
  const { data, loading, refetch } = useFetch<{ posts: PostView[] }>(url);

  // Composer state.
  const [body, setBody] = useState("");
  const [composerTopic, setComposerTopic] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);

  // Which post's replies are expanded, plus the reply form.
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [replies, setReplies] = useState<ReplyView[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [replyAnonymous, setReplyAnonymous] = useState(false);
  const [replying, setReplying] = useState(false);

  // Report flow.
  const [reportPost, setReportPost] = useState<PostView | null>(null);

  /** Publishes a new post. */
  async function publish() {
    if (!user) return;
    setPosting(true);
    const result = await sendApi<{ id: string }>("/api/community", "POST", {
      body: body.trim(),
      topic: composerTopic || undefined,
      isAnonymous: anonymous,
    });
    setPosting(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not post.");
      return;
    }
    setBody("");
    setAnonymous(false);
    toast.success(anonymous ? "Posted anonymously." : "Posted to the board.");
    refetch();
  }

  /** Loads and shows the replies under a post. */
  async function toggleReplies(post: PostView) {
    if (openPostId === post.id) {
      setOpenPostId(null);
      return;
    }
    setOpenPostId(post.id);
    const result = await getJson<{ replies: ReplyView[] }>(`/api/community/${post.id}`);
    if (result.ok && result.data) setReplies(result.data.replies);
  }

  /** Adds a reply to the open post. */
  async function reply(post: PostView) {
    setReplying(true);
    const result = await sendApi<{ id: string }>(`/api/community/${post.id}`, "POST", {
      body: replyBody.trim(),
      isAnonymous: replyAnonymous,
    });
    setReplying(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not reply.");
      return;
    }
    setReplyBody("");
    setReplyAnonymous(false);
    const refreshed = await getJson<{ replies: ReplyView[] }>(`/api/community/${post.id}`);
    if (refreshed.ok && refreshed.data) setReplies(refreshed.data.replies);
    refetch();
  }

  /** The author soft-deletes their own post. */
  async function remove(post: PostView) {
    const result = await sendApi<{ id: string }>(`/api/community/${post.id}`, "DELETE");
    if (result.ok) {
      toast.success("Post removed.");
      refetch();
    } else {
      toast.error(result.error ?? "Could not remove the post.");
    }
  }

  return (
    <div className="space-y-4">
      {/* ------------------------- COMPOSER ------------------------------ */}
      <Card>
        <CardHeader
          title="Say something"
          subtitle={anonymous ? "Posting as an alias - moderators can still trace abuse." : "Your name shows by default. Switch on anonymous for sensitive posts."}
        />
        <div className="mt-3 space-y-3">
          <TextArea label="Your post" value={body} onChange={(event) => setBody(event.target.value)} rows={3} placeholder="Campus gist, a question, a confession..." />
          <Select
            label="Topic (optional)"
            value={composerTopic}
            onChange={(event) => setComposerTopic(event.target.value)}
            options={[{ value: "", label: "No topic" }, ...COMMUNITY_TOPICS.map((option) => ({ value: option, label: option }))]}
          />
          <Checkbox checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} label="Post anonymously (shown as an alias)" />
          {user ? (
            <Button fullWidth loading={posting} onClick={publish} disabled={body.trim().length < 5}>
              Post to the board
            </Button>
          ) : (
            <p className="rounded-xl bg-slate-100 p-3 text-xs font-semibold text-slate-600">Sign in to join the conversation.</p>
          )}
        </div>
      </Card>

      {/* ------------------------- TOPIC CHIPS --------------------------- */}
      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        <button
          type="button"
          onClick={() => setTopic("")}
          aria-pressed={topic === ""}
          className={cn(
            "min-h-[36px] shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors",
            topic === "" ? "border-primary-600 bg-primary-600 text-white" : "border-slate-200 bg-white text-slate-700"
          )}
        >
          All topics
        </button>
        {COMMUNITY_TOPICS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTopic(option)}
            aria-pressed={topic === option}
            className={cn(
              "min-h-[36px] shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors",
              topic === option ? "border-primary-600 bg-primary-600 text-white" : "border-slate-200 bg-white text-slate-700"
            )}
          >
            {option}
          </button>
        ))}
      </div>

      {/* ------------------------- POSTS --------------------------------- */}
      {loading ? (
        <ListSkeleton rows={3} />
      ) : (data?.posts ?? []).length === 0 ? (
        <Card>
          <p className="p-6 text-center text-sm text-slate-500">No posts yet - start the conversation.</p>
        </Card>
      ) : (
        (data?.posts ?? []).map((post) => (
          <Card key={post.id}>
            {/* Identity row: real name or alias, never both. */}
            <div className="flex items-start gap-3">
              {post.isAnonymous ? (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                  <ChatIcon size={18} />
                </span>
              ) : (
                <Avatar src={post.author?.avatarUrl} name={post.author?.fullName ?? "?"} size={40} />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  {post.isAnonymous ? post.alias : post.author?.fullName}
                  {post.isMine ? <span className="ml-1 text-[10px] font-semibold text-slate-400">(you)</span> : null}
                </p>
                <p className="text-[11px] text-slate-500">
                  {post.isAnonymous ? "Anonymous" : [post.author?.level, post.author?.department].filter(Boolean).join(" · ") || "Student"} · {formatDate(post.createdAt)}
                </p>
              </div>
              {post.topic ? <Badge tone="gold">{post.topic}</Badge> : null}
            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{post.body}</p>

            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
              <Button size="sm" variant="secondary" onClick={() => toggleReplies(post)}>
                <ChatIcon size={14} /> {post.replyCount} repl{post.replyCount === 1 ? "y" : "ies"}
              </Button>
              <button type="button" onClick={() => setReportPost(post)} className="inline-flex min-h-[36px] items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-slate-500 hover:text-danger">
                <AlertIcon size={14} /> Report
              </button>
              {post.isMine ? (
                <button type="button" onClick={() => remove(post)} className="ml-auto inline-flex min-h-[36px] items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-slate-500 hover:text-danger">
                  <TrashIcon size={14} /> Delete
                </button>
              ) : null}
            </div>

            {/* ------------------- REPLIES ------------------------------- */}
            {openPostId === post.id ? (
              <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
                {replies.map((replyItem) => (
                  <div key={replyItem.id} className="flex items-start gap-2">
                    {replyItem.isAnonymous ? (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                        <ChatIcon size={14} />
                      </span>
                    ) : (
                      <Avatar src={replyItem.author?.avatarUrl} name={replyItem.author?.fullName ?? "?"} size={32} />
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-900">{replyItem.isAnonymous ? replyItem.alias : replyItem.author?.fullName}</p>
                      <p className="text-xs leading-relaxed text-slate-700">{replyItem.body}</p>
                    </div>
                  </div>
                ))}

                {user ? (
                  <div className="space-y-2">
                    <TextArea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} rows={2} placeholder="Write a reply..." label="Reply" />
                    <div className="flex items-center gap-3">
                      <Checkbox checked={replyAnonymous} onChange={(event) => setReplyAnonymous(event.target.checked)} label="Reply anonymously" />
                      <Button size="sm" loading={replying} onClick={() => reply(post)} disabled={replyBody.trim().length < 2}>
                        <SendIcon size={14} /> Reply
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>
        ))
      )}

      {/* Report modal for whichever post was flagged. */}
      <ReportModal
        open={Boolean(reportPost)}
        onClose={() => setReportPost(null)}
        communityPostId={reportPost?.id}
        subject={reportPost ? (reportPost.isAnonymous ? reportPost.alias ?? "an anonymous post" : `${reportPost.author?.fullName}'s post`) : ""}
      />
    </div>
  );
}
