/**
 * src/components/study/StudyVaultClient.tsx
 * WHAT: The Study Vault: browse + download with credits, upload to earn, and
 *       the peer request board.
 * WHY : Give-to-get in one screen: freshers start with welcome credits; after
 *       that, contributing is how the vault (and your balance) grows.
 */
"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { CapIcon, ImageIcon, PlusIcon } from "@/components/ui/Icons";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { useFetch } from "@/hooks/useFetch";
import { useSession } from "@/components/layout/Shell";
import { sendApi } from "@/lib/api-client";
import { STUDY_KIND_LABELS } from "@/lib/data";
import { formatDate } from "@/lib/utils";

type DocView = {
  id: string;
  department: string;
  courseCode: string;
  title: string;
  kind: string;
  description: string | null;
  pages: number | null;
  downloads: number;
  status: string;
  createdAt: string;
  uploaderName: string;
  isMine: boolean;
};

type RequestView = {
  id: string;
  department: string;
  courseCode: string;
  details: string | null;
  status: string;
  createdAt: string;
  requesterName: string;
  requesterLevel: string | null;
  isMine: boolean;
};

/**
 * StudyVaultClient
 * WHAT: Everything on the vault page.
 */
export function StudyVaultClient() {
  const { user } = useSession();
  const toast = useToast();

  const [department, setDepartment] = useState("");
  const [course, setCourse] = useState("");
  const url = `/api/study${department || course ? `?department=${encodeURIComponent(department)}&course=${encodeURIComponent(course)}` : ""}`;
  const { data, loading, refetch } = useFetch<{ documents: DocView[]; credits: number; uploadsApproved: number; welcomeCredits: number }>(url);
  const { data: requestsData, refetch: refetchRequests } = useFetch<{ requests: RequestView[] }>("/api/study/requests");

  // Upload modal state.
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upTitle, setUpTitle] = useState("");
  const [upDepartment, setUpDepartment] = useState("");
  const [upCourse, setUpCourse] = useState("");
  const [upKind, setUpKind] = useState("PAST_QUESTION");
  const [upFile, setUpFile] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Request modal state.
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqDepartment, setReqDepartment] = useState("");
  const [reqCourse, setReqCourse] = useState("");
  const [reqDetails, setReqDetails] = useState("");
  const [requesting, setRequesting] = useState(false);

  const credits = data?.credits ?? 0;

  /** Downloads one document, spending a credit server-side. */
  async function download(doc: DocView) {
    const result = await sendApi<{ fileUrl: string; creditsLeft: number }>(`/api/study/${doc.id}/download`, "POST");
    if (!result.ok || !result.data) {
      toast.error(result.error ?? "Download failed.");
      return;
    }
    refetch();
    // Open the file in a new tab so the student can save it.
    window.open(result.data.fileUrl, "_blank", "noopener");
    toast.success(`Downloaded. ${result.data.creditsLeft} credit${result.data.creditsLeft === 1 ? "" : "s"} left.`);
  }

  /** Submits an upload for moderation. */
  async function upload() {
    setUploading(true);
    const result = await sendApi<{ id: string }>("/api/study", "POST", {
      title: upTitle.trim(),
      department: upDepartment.trim(),
      courseCode: upCourse.trim(),
      kind: upKind,
      fileUrl: upFile[0],
    });
    setUploading(false);
    if (!result.ok) {
      toast.error(result.error ?? "Upload failed.");
      return;
    }
    setUploadOpen(false);
    setUpTitle("");
    setUpFile([]);
    toast.success("Submitted! You earn 2 credits when a moderator approves it.");
    refetch();
  }

  /** Posts a material request to the board. */
  async function postRequest() {
    setRequesting(true);
    const result = await sendApi<{ id: string }>("/api/study/requests", "POST", {
      department: reqDepartment.trim(),
      courseCode: reqCourse.trim(),
      details: reqDetails.trim() || undefined,
    });
    setRequesting(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not post the request.");
      return;
    }
    setRequestOpen(false);
    toast.success("Request posted. Seniors in your school can now see it.");
    refetchRequests();
  }

  /** The requester marks their own request fulfilled/closed. */
  async function closeRequest(request: RequestView, status: "FILLED" | "CLOSED") {
    const result = await sendApi<{ id: string }>(`/api/study/requests/${request.id}`, "PATCH", { status });
    if (result.ok) {
      toast.success(status === "FILLED" ? "Marked as filled - thank you!" : "Request closed.");
      refetchRequests();
    }
  }

  const documents = useMemo(() => data?.documents ?? [], [data]);

  return (
    <div className="space-y-4">
      {/* ------------------------- CREDITS BANNER ------------------------ */}
      <Card className={credits === 0 ? "bg-gold-50" : "bg-primary-50"}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-primary-700">
            <CapIcon size={22} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-slate-900">
              {user ? `${credits} download credit${credits === 1 ? "" : "s"} left` : "Sign in to download"}
            </p>
            <p className="text-xs text-slate-600">
              {user
                ? credits === 0
                  ? "Upload a past question or note to earn 2 credits - that is how the vault stays full."
                  : "New uploads earn you 2 credits each when approved."
                : "Freshers get free welcome credits to start studying."}
            </p>
          </div>
          {user?.role === "STUDENT" ? (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <PlusIcon size={14} /> Upload
            </Button>
          ) : null}
        </div>
      </Card>

      {/* ------------------------- FILTERS ------------------------------- */}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Department" value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Computer Science" />
        <Input label="Course code" value={course} onChange={(event) => setCourse(event.target.value)} placeholder="CSC 201" />
      </div>

      {/* ------------------------- DOCUMENTS ----------------------------- */}
      {loading ? (
        <ListSkeleton rows={3} />
      ) : documents.length === 0 ? (
        <Card>
          <p className="p-6 text-center text-sm text-slate-500">No materials yet for this filter. Upload the first one!</p>
        </Card>
      ) : (
        documents.map((doc) => (
          <Card key={doc.id}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <ImageIcon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-bold text-slate-900">{doc.title}</p>
                  <Badge tone="primary">{STUDY_KIND_LABELS[doc.kind] ?? doc.kind}</Badge>
                  {doc.status !== "APPROVED" ? <Badge tone="gold">{doc.status}</Badge> : null}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {doc.department} · {doc.courseCode} · by {doc.uploaderName} · {formatDate(doc.createdAt)} · {doc.downloads} downloads
                </p>
                {doc.description ? <p className="mt-1 text-xs text-slate-600">{doc.description}</p> : null}
                <div className="mt-2">
                  <Button size="sm" onClick={() => download(doc)} disabled={doc.status !== "APPROVED"}>
                    Download {doc.isMine ? "(yours)" : "- 1 credit"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))
      )}

      {/* ------------------------- REQUEST BOARD ------------------------- */}
      <Card>
        <CardHeader
          title="Request board"
          subtitle="Need something that is not here? Ask the seniors in your school."
          action={
            user?.role === "STUDENT" ? (
              <Button size="sm" variant="secondary" onClick={() => setRequestOpen(true)}>
                <PlusIcon size={14} /> Request
              </Button>
            ) : undefined
          }
        />
        <div className="mt-3 space-y-3">
          {(requestsData?.requests ?? []).length === 0 ? (
            <p className="text-xs text-slate-500">No open requests right now.</p>
          ) : (
            (requestsData?.requests ?? []).map((request) => (
              <div key={request.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-bold text-slate-900">{request.courseCode}</p>
                  <Badge tone="slate">{request.department}</Badge>
                  <Badge tone={request.status === "OPEN" ? "gold" : "primary"}>{request.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {request.details ?? "No extra details."} — {request.requesterName} ({request.requesterLevel ?? "Student"})
                </p>
                {request.isMine && request.status === "OPEN" ? (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => closeRequest(request, "FILLED")}>
                      Mark filled
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => closeRequest(request, "CLOSED")}>
                      Close
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* ------------------------- UPLOAD MODAL -------------------------- */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload a material">
        <div className="space-y-3">
          <Input label="Title" value={upTitle} onChange={(event) => setUpTitle(event.target.value)} placeholder="CSC 201 Past Questions 2023" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Department" value={upDepartment} onChange={(event) => setUpDepartment(event.target.value)} placeholder="Computer Science" />
            <Input label="Course code" value={upCourse} onChange={(event) => setUpCourse(event.target.value)} placeholder="CSC 201" />
          </div>
          <Select
            label="Type"
            value={upKind}
            onChange={(event) => setUpKind(event.target.value)}
            options={Object.entries(STUDY_KIND_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <ImageUploader label="Scans / photos of the material" maxImages={1} folder="study" onChange={setUpFile} />
          <Button fullWidth loading={uploading} onClick={upload} disabled={!upTitle || !upDepartment || !upCourse || upFile.length === 0}>
            Submit for review (+2 credits on approval)
          </Button>
        </div>
      </Modal>

      {/* ------------------------- REQUEST MODAL ------------------------- */}
      <Modal open={requestOpen} onClose={() => setRequestOpen(false)} title="Request a material">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Department" value={reqDepartment} onChange={(event) => setReqDepartment(event.target.value)} placeholder="Mathematics" />
            <Input label="Course code" value={reqCourse} onChange={(event) => setReqCourse(event.target.value)} placeholder="MTH 101" />
          </div>
          <Input label="Details (optional)" value={reqDetails} onChange={(event) => setReqDetails(event.target.value)} placeholder="e.g. 2022 paper with answers" />
          <Button fullWidth loading={requesting} onClick={postRequest} disabled={!reqDepartment || !reqCourse}>
            Post request
          </Button>
        </div>
      </Modal>
    </div>
  );
}
