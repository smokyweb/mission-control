"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Attachment {
  id: string;
  filename: string;
  originalName?: string;
  size: number;
  mimeType?: string;
  uploadedAt?: number;
  url?: string;
  // legacy compat
  name?: string;
  type?: string;
}

interface CommentAttachment {
  id: string;
  filename: string;
  originalName?: string;
  size: number;
  mimeType?: string;
  uploadedAt?: number;
  url?: string;
  name?: string;
  type?: string;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  attachments?: CommentAttachment[];
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in-progress" | "completed" | "review";
  difficulty?: string;
  assignedTo?: string;
  assignedAgent?: string;
  assignedModel?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  reviewedAt?: number;
  reviewSummary?: string;
  reviewQuestions?: string;
  attachments?: Attachment[];
  comments?: Comment[];
}

interface PendingFile {
  file: File;
  preview?: string; // data URL for images
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  open: { label: "Open", color: "bg-yellow-900/50 text-yellow-300 border-yellow-800/50", dot: "bg-yellow-400" },
  "in-progress": { label: "In Progress", color: "bg-blue-900/50 text-blue-300 border-blue-800/50", dot: "bg-blue-400 animate-pulse" },
  review: { label: "Needs Review", color: "bg-purple-900/50 text-purple-300 border-purple-800/50", dot: "bg-purple-400 animate-pulse" },
  completed: { label: "Completed", color: "bg-green-900/50 text-green-300 border-green-800/50", dot: "bg-green-400" },
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(ts);
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentName(att: Attachment | CommentAttachment): string {
  return att.originalName || att.name || att.filename;
}

function getAttachmentMime(att: Attachment | CommentAttachment): string {
  return att.mimeType || att.type || "";
}

function getAttachmentUrl(att: Attachment, taskId: string): string {
  if (att.url) return att.url;
  return `/api/tasks/${taskId}/attachments/${att.filename}`;
}

function getCommentAttachmentUrl(att: CommentAttachment, commentId: string): string {
  if (att.url) return att.url;
  return `/uploads/comments/${commentId}/${att.filename}`;
}

function isImage(mime: string, name: string): boolean {
  if (mime.startsWith("image/")) return true;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
}

function isVideo(mime: string, name: string): boolean {
  if (mime.startsWith("video/")) return true;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "webm", "mov", "avi"].includes(ext);
}

function isPdf(mime: string, name: string): boolean {
  if (mime === "application/pdf") return true;
  return (name.split(".").pop()?.toLowerCase() ?? "") === "pdf";
}

function isCsv(mime: string, name: string): boolean {
  if (mime === "text/csv") return true;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ["csv", "xls", "xlsx"].includes(ext);
}

function isWord(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ["doc", "docx"].includes(ext);
}

function FileTypeIcon({ mime, name, size = "text-3xl" }: { mime: string; name: string; size?: string }) {
  if (isImage(mime, name)) return <span className={size}>🖼️</span>;
  if (isVideo(mime, name)) return <span className={size}>🎬</span>;
  if (isPdf(mime, name)) return <span className={size}>📄</span>;
  if (isCsv(mime, name)) return <span className={size}>📊</span>;
  if (isWord(name)) return <span className={size}>📝</span>;
  if (mime.startsWith("text/")) return <span className={size}>📃</span>;
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("7z")) return <span className={size}>📦</span>;
  return <span className={size}>📎</span>;
}

// ─── Task Attachment Card ────────────────────────────────────────────────────
function AttachmentCard({
  att,
  taskId,
  onDelete,
  onLightbox,
}: {
  att: Attachment;
  taskId: string;
  onDelete: (id: string) => void;
  onLightbox: (url: string) => void;
}) {
  const url = getAttachmentUrl(att, taskId);
  const name = getAttachmentName(att);
  const mime = getAttachmentMime(att);
  const imgFile = isImage(mime, name);
  const vidFile = isVideo(mime, name);

  return (
    <div className="relative group rounded-lg overflow-hidden border border-[#2A2A3E] bg-[#0A0A0F]">
      {imgFile ? (
        <button
          onClick={() => onLightbox(url)}
          className="block w-full aspect-square"
          title={name}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} className="w-full h-full object-cover" loading="lazy" />
        </button>
      ) : vidFile ? (
        <div className="aspect-square flex flex-col items-center justify-center p-2 gap-1">
          <video
            src={url}
            className="w-full max-h-[80%] object-contain rounded"
            controls
            preload="metadata"
          />
          <span className="text-xs text-gray-400 text-center break-all leading-tight truncate w-full">{name}</span>
          <span className="text-xs text-gray-600">{formatBytes(att.size)}</span>
        </div>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          download={name}
          className="flex flex-col items-center justify-center aspect-square gap-2 p-3 hover:bg-[#1A1A2E] transition-colors"
          title={name}
        >
          <FileTypeIcon mime={mime} name={name} />
          <span className="text-xs text-gray-400 text-center break-all leading-tight line-clamp-2">{name}</span>
          <span className="text-xs text-gray-600">{formatBytes(att.size)}</span>
        </a>
      )}

      {/* Delete button */}
      <button
        onClick={() => onDelete(att.id)}
        title="Delete attachment"
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700/80"
      >
        ✕
      </button>

      {/* Filename on hover for images */}
      {imgFile && (
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-xs text-gray-300 truncate opacity-0 group-hover:opacity-100 transition-opacity">
          {name}
        </div>
      )}
    </div>
  );
}

// ─── Comment Attachment Inline Display ──────────────────────────────────────
function CommentAttachmentItem({
  att,
  commentId,
  onLightbox,
}: {
  att: CommentAttachment;
  commentId: string;
  onLightbox: (url: string) => void;
}) {
  const url = getCommentAttachmentUrl(att, commentId);
  const name = getAttachmentName(att);
  const mime = getAttachmentMime(att);
  const imgFile = isImage(mime, name);
  const vidFile = isVideo(mime, name);

  if (imgFile) {
    return (
      <button onClick={() => onLightbox(url)} className="block rounded-lg overflow-hidden border border-[#2A2A3E]" title={name}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className="max-w-[200px] max-h-[150px] object-cover" loading="lazy" />
      </button>
    );
  }
  if (vidFile) {
    return (
      <div className="rounded-lg overflow-hidden border border-[#2A2A3E] max-w-[280px]">
        <video src={url} className="w-full" controls preload="metadata" />
        <div className="px-2 py-1 text-xs text-gray-400 truncate">{name}</div>
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={name}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0A0A0F] border border-[#2A2A3E] hover:border-[#3A3A4E] transition-colors text-sm text-gray-300 max-w-[280px]"
    >
      <FileTypeIcon mime={mime} name={name} size="text-lg" />
      <span className="truncate">{name}</span>
      <span className="text-xs text-gray-600 shrink-0">{formatBytes(att.size)}</span>
    </a>
  );
}

// ─── Pending File Preview (before comment submit) ───────────────────────────
function PendingFilePreview({ pf, onRemove }: { pf: PendingFile; onRemove: () => void }) {
  const mime = pf.file.type;
  const name = pf.file.name;
  const imgFile = isImage(mime, name);

  return (
    <div className="relative group inline-flex flex-col items-center border border-[#2A2A3E] rounded-lg overflow-hidden bg-[#0A0A0F] max-w-[100px]">
      {imgFile && pf.preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pf.preview} alt={name} className="w-[100px] h-[80px] object-cover" />
      ) : (
        <div className="w-[100px] h-[80px] flex flex-col items-center justify-center gap-1">
          <FileTypeIcon mime={mime} name={name} size="text-2xl" />
        </div>
      )}
      <div className="px-1 py-0.5 text-xs text-gray-400 truncate w-full text-center">{name}</div>
      <button
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function TaskDetailClient({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const commentFileRef = useRef<HTMLInputElement>(null);

  // Task attachment state
  const [actionSaving, setActionSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const taskFileRef = useRef<HTMLInputElement>(null);

  // Lightbox
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) {
        setError(res.status === 404 ? "Task not found" : "Failed to load task");
        return;
      }
      setTask(await res.json());
    } catch {
      setError("Failed to load task");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  const [agentWaiting, setAgentWaiting] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");

  // ── Chat scroll ref ───────────────────────────────────────────────────
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on initial load
  useEffect(() => {
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'auto' }), 200);
  }, [task?.id]);

  // ── Task actions ─────────────────────────────────────────────────────────
  const updateStatus = async (status: string) => {
    setActionSaving(true);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setActionSaving(false);
    }
  };

  // ── Task file upload ─────────────────────────────────────────────────────
  const uploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      arr.forEach((f) => form.append("files", f));
      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        alert(err.error ?? "Upload failed");
        return;
      }
      await load();
    } finally {
      setUploading(false);
      if (taskFileRef.current) taskFileRef.current.value = "";
    }
  };

  const handleTaskFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  };

  const deleteAttachment = async (attId: string) => {
    if (!confirm("Delete this attachment?")) return;
    await fetch(`/api/tasks/${taskId}?attId=${attId}`, { method: "DELETE" });
    await load();
  };

  // ── Comment file handling ─────────────────────────────────────────────────
  const addPendingFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const newPending: PendingFile[] = await Promise.all(
      arr.map(
        (file) =>
          new Promise<PendingFile>((resolve) => {
            if (file.type.startsWith("image/")) {
              const reader = new FileReader();
              reader.onload = (e) => resolve({ file, preview: e.target?.result as string });
              reader.readAsDataURL(file);
            } else {
              resolve({ file });
            }
          })
      )
    );
    setPendingFiles((prev) => [...prev, ...newPending]);
  };

  const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addPendingFiles(e.target.files);
    if (commentFileRef.current) commentFileRef.current.value = "";
  };

  const removePendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const addComment = async () => {
    const text = commentText.trim();
    if (!text && pendingFiles.length === 0) return;
    setCommentSaving(true);
    try {
      if (pendingFiles.length > 0) {
        // Use multipart to send files + comment together
        const form = new FormData();
        form.append("action", "comment");
        form.append("author", "kevin");
        form.append("text", text);
        pendingFiles.forEach((pf) => form.append("files", pf.file));
        await fetch(`/api/tasks/${taskId}`, { method: "PATCH", body: form });
      } else {
        await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "comment", author: "kevin", text }),
        });
      }
      setCommentText("");
      setPendingFiles([]);
      await load();

      // Trigger agent chat — get reply inline, no polling needed
      const currentAgent = task?.assignedAgent ?? "";
      if (currentAgent && text) {
        setAgentWaiting(true);
        setAgentStatus(`⏳ ${currentAgent} is responding...`);
        try {
          const chatRes = await fetch("/api/task-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId, comment: text, author: "kevin" }),
          });
          const chatData = await chatRes.json();
          if (chatData.reply) {
            // Add agent reply directly to local state — no re-fetch needed
            const agentComment = {
              id: `comment-${Date.now()}-chat`,
              author: currentAgent,
              text: chatData.reply,
              createdAt: Date.now(),
            };
            setTask(prev => prev ? {
              ...prev,
              comments: [...(prev.comments || []), agentComment]
            } : prev);
            setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            setAgentStatus(`✅ ${currentAgent} replied`);
          } else {
            setAgentStatus(`✅ ${currentAgent} is working on it`);
          }
        } catch {
          setAgentStatus("⚠️ Agent notification failed");
        } finally {
          setAgentWaiting(false);
          setTimeout(() => setAgentStatus(""), 5000);
        }
      }
    } finally {
      setCommentSaving(false);
    }
  };

  // ── Keyboard shortcut: Ctrl+Enter to send comment ────────────────────────
  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      addComment();
    }
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] p-6">
        <div className="max-w-5xl mx-auto">
          <div className="h-6 w-24 bg-[#1A1A2E] rounded animate-pulse mb-6" />
          <div className="h-10 w-96 bg-[#1A1A2E] rounded animate-pulse mb-4" />
          <div className="h-6 w-64 bg-[#1A1A2E] rounded animate-pulse mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-40 bg-[#1A1A2E] rounded-xl animate-pulse" />
              <div className="h-60 bg-[#1A1A2E] rounded-xl animate-pulse" />
            </div>
            <div className="h-80 bg-[#1A1A2E] rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error || !task) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] p-6">
        <div className="max-w-5xl mx-auto">
          <Link href="/tasks" className="text-gray-400 hover:text-white transition-colors text-sm mb-6 inline-flex items-center gap-2">
            <span>&larr;</span> Back to Tasks
          </Link>
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-400 text-lg">{error || "Task not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG["completed"];

  return (
    <>
      <div className="min-h-screen bg-[#0A0A0F] p-6">
        <div className="max-w-5xl mx-auto">
          {/* Back link */}
          <Link href="/tasks" className="text-gray-400 hover:text-white transition-colors text-sm mb-6 inline-flex items-center gap-2">
            <span>&larr;</span> Back to Tasks
          </Link>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{task.title}</h1>
              <span className={`text-sm px-2.5 py-1 rounded-full border ${cfg.color}`}>
                <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 font-mono">ID: {task.id}</p>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {task.assignedModel && (
                <span className="text-sm text-gray-400">Model: <span className="text-gray-300">{task.assignedModel}</span></span>
              )}
              {task.difficulty && (
                <span className="text-sm text-gray-400">Difficulty: <span className="text-gray-300">{task.difficulty}</span></span>
              )}
              {task.assignedTo && (
                <span className="text-sm text-gray-400">Assigned to: <span className="text-gray-300">{task.assignedTo === "brenthomer" ? "Brent Homer" : "Kevin"}</span></span>
              )}
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left / Main column */}
            <div className="lg:col-span-2 space-y-5">
              {/* Description */}
              {task.description && (
                <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-400 mb-2">Description</p>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              {/* Review Summary */}
              {task.status === "review" && task.reviewSummary && (
                <div className="bg-purple-900/20 border border-purple-800/40 rounded-xl p-4">
                  <p className="text-sm font-semibold text-purple-300 mb-2">📋 What was done</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{task.reviewSummary}</p>
                </div>
              )}

              {/* Review Questions */}
              {task.reviewQuestions && (
                <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-4">
                  <p className="text-sm font-semibold text-yellow-300 mb-2">❓ Questions</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{task.reviewQuestions}</p>
                </div>
              )}

              {/* ── Attachments Section ─────────────────────────────────── */}
              <div
                className={`bg-[#1A1A2E] border rounded-xl p-4 transition-colors ${dragOver ? "border-blue-500/60 bg-blue-900/10" : "border-[#2A2A3E]"}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-400">Attachments</p>
                    {task.attachments && task.attachments.length > 0 && (
                      <span className="text-xs text-gray-600 bg-[#0A0A0F] px-1.5 py-0.5 rounded-full border border-[#2A2A3E]">
                        {task.attachments.length}
                      </span>
                    )}
                  </div>
                  <label
                    className={`cursor-pointer px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                      uploading
                        ? "opacity-50 cursor-not-allowed bg-[#2A2A3E] text-gray-500"
                        : "bg-[#2A2A3E] text-gray-300 hover:text-white hover:bg-[#3A3A4E]"
                    }`}
                  >
                    {uploading ? "Uploading…" : "＋ Add Files"}
                    <input
                      ref={taskFileRef}
                      type="file"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={handleTaskFileChange}
                    />
                  </label>
                </div>

                {dragOver && (
                  <div className="mb-3 rounded-lg border-2 border-dashed border-blue-500/50 bg-blue-900/10 py-4 text-center text-sm text-blue-300">
                    Drop files here to upload
                  </div>
                )}

                {task.attachments && task.attachments.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {task.attachments.map((att) => (
                      <AttachmentCard
                        key={att.id}
                        att={att}
                        taskId={task.id}
                        onDelete={deleteAttachment}
                        onLightbox={setLightbox}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    No attachments yet. Drop files here or click &quot;Add Files&quot;.
                  </p>
                )}
              </div>

{/* ── Live Chat Section ───────────────────────────────────────── */}
              <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl overflow-hidden flex flex-col">
                {/* Chat header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A3E]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-300">Chat</span>
                    {task.comments && task.comments.length > 0 && (
                      <span className="text-xs text-gray-600 bg-[#0A0A0F] px-1.5 py-0.5 rounded-full border border-[#2A2A3E]">
                        {task.comments.length}
                      </span>
                    )}
                  </div>
                  {task.assignedAgent && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      {task.assignedAgent}
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div className="flex flex-col gap-3 p-4 min-h-[200px] max-h-[480px] overflow-y-auto">
                  {(!task.comments || task.comments.length === 0) && (
                    <p className="text-sm text-gray-600 text-center py-8">No messages yet.</p>
                  )}
                  {task.comments?.map((cm) => {
                    const isKevin = cm.author === 'kevin';
                    const isSystem = cm.author === 'system';
                    if (isSystem) {
                      return (
                        <div key={cm.id} className="text-center">
                          <span className="text-xs text-gray-600 italic" suppressHydrationWarning>{cm.text} · {formatRelativeTime(cm.createdAt)}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={cm.id} className={`flex gap-2 ${isKevin ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm self-end ${isKevin ? 'bg-blue-600/30' : 'bg-purple-600/30'}`}>
                          {isKevin ? '👤' : '⚙️'}
                        </div>
                        <div className={`max-w-[75%] flex flex-col gap-1 ${isKevin ? 'items-end' : 'items-start'}`}>
                          <span className="text-xs text-gray-500" suppressHydrationWarning>
                            {isKevin ? 'You' : cm.author} · {formatRelativeTime(cm.createdAt)}
                          </span>
                          {cm.text && (
                            <div className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${isKevin ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-[#0F0F1F] border border-[#2A2A3E] text-gray-200 rounded-bl-sm'}`}>
                              {cm.text}
                            </div>
                          )}
                          {cm.attachments && cm.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              {cm.attachments.map((att) => (
                                <CommentAttachmentItem key={att.id} att={att} commentId={cm.id} onLightbox={setLightbox} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>

                {/* Add comment */}
                {/* Add comment */}
                <div className="border-t border-[#2A2A3E] pt-3">
                  <textarea
                    placeholder="Add a comment… (Ctrl+Enter to send)"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={handleCommentKeyDown}
                    rows={3}
                    className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none"
                  />

                  {/* Pending file previews */}
                  {pendingFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {pendingFiles.map((pf, i) => (
                        <PendingFilePreview key={i} pf={pf} onRemove={() => removePendingFile(i)} />
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    {/* Paperclip button */}
                    <label
                      className="cursor-pointer p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-[#2A2A3E] transition-colors"
                      title="Attach files"
                    >
                      {/* Paperclip SVG */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                      <input
                        ref={commentFileRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleCommentFileChange}
                      />
                    </label>

                    <button
                      onClick={addComment}
                      disabled={(!commentText.trim() && pendingFiles.length === 0) || commentSaving || agentWaiting}
                      className="px-4 py-1.5 text-sm rounded-lg bg-[#2A2A3E] text-gray-300 hover:text-white hover:bg-[#3A3A4E] disabled:opacity-40 transition-colors"
                    >
                      {commentSaving ? "Sending…" : agentWaiting ? "Waiting…" : "Send"}
                    </button>
                  </div>
                  {agentStatus && (
                    <div className="mt-2 text-xs text-blue-400 flex items-center gap-2">
                      {agentWaiting && (
                        <span className="inline-block w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                      )}
                      {agentStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-5">
              {/* Metadata card */}
              <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-4">
                <p className="text-sm font-medium text-gray-400 mb-3">Details</p>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Status</span>
                    <span className={`text-sm px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  {task.assignedModel && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Model</span>
                      <span className="text-sm text-gray-300">{task.assignedModel.split("/").pop()}</span>
                    </div>
                  )}
                  {task.difficulty && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Difficulty</span>
                      <span className="text-sm text-gray-300 capitalize">{task.difficulty}</span>
                    </div>
                  )}
                  {task.assignedTo && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Assigned To</span>
                      <span className="text-sm text-gray-300">{task.assignedTo === "brenthomer" ? "Brent Homer" : "Kevin"}</span>
                    </div>
                  )}
                  <div className="border-t border-[#2A2A3E] pt-3">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-500">Created</span>
                      <span className="text-sm text-gray-300" suppressHydrationWarning>{formatDate(task.createdAt)}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-500">Updated</span>
                      <span className="text-sm text-gray-300" suppressHydrationWarning>{formatRelativeTime(task.updatedAt)}</span>
                    </div>
                    {task.completedAt && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Completed</span>
                        <span className="text-sm text-gray-300" suppressHydrationWarning>{formatDate(task.completedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-4">
                <p className="text-sm font-medium text-gray-400 mb-3">Actions</p>
                <div className="space-y-2">
                  {task.status === "open" && (
                    <button
                      onClick={() => updateStatus("in-progress")}
                      disabled={actionSaving}
                      className="w-full px-4 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 bg-blue-900/40 text-blue-300 hover:bg-blue-900/70 border border-blue-800/50"
                    >
                      ▶ Start Task
                    </button>
                  )}
                  {task.status === "in-progress" && (
                    <>
                      <button
                        onClick={() => updateStatus("review")}
                        disabled={actionSaving}
                        className="w-full px-4 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 bg-purple-900/40 text-purple-300 hover:bg-purple-900/70 border border-purple-800/50"
                      >
                        📨 Send for Review
                      </button>
                      <button
                        onClick={() => updateStatus("completed")}
                        disabled={actionSaving}
                        className="w-full px-4 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 bg-green-900/40 text-green-300 hover:bg-green-900/70 border border-green-800/50"
                      >
                        ✓ Mark Complete
                      </button>
                    </>
                  )}
                  {task.status === "review" && (
                    <>
                      <button
                        onClick={() => updateStatus("completed")}
                        disabled={actionSaving}
                        className="w-full px-4 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #f5c200, #e6a800)", color: "#000" }}
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => updateStatus("in-progress")}
                        disabled={actionSaving}
                        className="w-full px-4 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 bg-blue-900/40 text-blue-300 hover:bg-blue-900/70 border border-blue-800/50"
                      >
                        ↩ Return
                      </button>
                    </>
                  )}
                  {task.status === "completed" && (
                    <button
                      onClick={() => updateStatus("open")}
                      disabled={actionSaving}
                      className="w-full px-4 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 bg-yellow-900/40 text-yellow-300 hover:bg-yellow-900/70 border border-yellow-800/50"
                    >
                      🔄 Reopen
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-lg transition-colors"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Full size"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
