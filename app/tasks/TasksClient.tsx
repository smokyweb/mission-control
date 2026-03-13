"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  filename: string;
}

interface Comment {
  id: string;
  author: "kevin" | "axel";
  text: string;
  createdAt: number;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in-progress" | "completed" | "review";
  difficulty?: "gemini" | "deepseek" | "chat" | "chatpro" | "sonnet";
  assignedTo?: "kevin" | "brenthomer";
  assignedModel?: "google/gemini-2.5-flash" | "deepseek/deepseek-chat" | "openai/gpt-5.4" | "openai/gpt-5.4-pro" | "anthropic/claude-sonnet-4-6" | "openai/gpt-4o";
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  reviewedAt?: number;
  reviewSummary?: string;
  reviewQuestions?: string;
  attachments?: Attachment[];
  comments?: Comment[];
}

type FilterStatus = "all" | "open" | "in-progress" | "review" | "completed";

const STATUS_CONFIG = {
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

function isImage(type: string) {
  return type.startsWith("image/");
}

function fileIcon(type: string, name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (isImage(type)) return "🖼️";
  if (type === "application/pdf" || ext === "pdf") return "📄";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
  return "📎";
}

function difficultyToModel(difficulty: "gemini" | "deepseek" | "chat" | "chatpro" | "sonnet" | null): string | undefined {
  switch (difficulty) {
    case "gemini":
      return "google/gemini-2.5-flash";
    case "deepseek":
      return "deepseek/deepseek-chat";
    case "chat":
      return "openai/gpt-5.4";
    case "chatpro":
      return "openai/gpt-5.4-pro";
    case "sonnet":
      return "anthropic/claude-sonnet-4-6";
    default:
      return undefined;
  }
}

// ── Attachment chip (on task card) ─────────────────────────────────────────
function AttachmentChip({ att, taskId, onDelete }: { att: Attachment; taskId: string; onDelete: () => void }) {
  const url = `/api/tasks/${taskId}/attachments/${att.filename}`;
  return (
    <div className="flex items-center gap-1.5 bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-2 py-1 group/chip">
      {isImage(att.type) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={att.name} className="w-8 h-8 object-cover rounded" />
      ) : (
        <span className="text-base leading-none">{fileIcon(att.type, att.name)}</span>
      )}
      <a href={url} target="_blank" rel="noreferrer"
        className="text-xs text-gray-300 hover:text-white truncate max-w-[120px]" title={att.name}>
        {att.name}
      </a>
      <span className="text-xs text-gray-600 shrink-0">{formatBytes(att.size)}</span>
      <button onClick={onDelete}
        className="text-gray-600 hover:text-red-400 opacity-0 group-hover/chip:opacity-100 transition-opacity text-xs ml-0.5 leading-none">
        ✕
      </button>
    </div>
  );
}

// ── File Drop Zone ─────────────────────────────────────────────────────────
function FileDropZone({ files, onFiles }: { files: File[]; onFiles: (f: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (!next.find(x => x.name === f.name && x.size === f.size)) next.push(f);
    }
    onFiles(next);
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl px-4 py-5 text-center cursor-pointer transition-colors
          ${dragging ? "border-blue-500 bg-blue-900/10" : "border-[#2A2A3E] hover:border-[#3A3A5E] hover:bg-[#1A1A2E]/50"}`}
      >
        <p className="text-2xl mb-1">📎</p>
        <p className="text-xs text-gray-400">Drop files here or <span className="text-blue-400 underline">browse</span></p>
        <p className="text-xs text-gray-600 mt-0.5">Images, PDFs, docs, spreadsheets…</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip"
        className="hidden"
        onChange={e => addFiles(e.target.files)}
      />

      {/* Staged file previews */}
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-2 py-1">
              {isImage(f.type) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={URL.createObjectURL(f)} alt={f.name} className="w-8 h-8 object-cover rounded" />
              ) : (
                <span className="text-base leading-none">{fileIcon(f.type, f.name)}</span>
              )}
              <span className="text-xs text-gray-300 truncate max-w-[120px]">{f.name}</span>
              <span className="text-xs text-gray-600 shrink-0">{formatBytes(f.size)}</span>
              <button onClick={() => onFiles(files.filter((_, j) => j !== i))}
                className="text-gray-600 hover:text-red-400 text-xs ml-0.5 leading-none">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function TasksClient() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDifficulty, setNewDifficulty] = useState<"gemini" | "deepseek" | "chat" | "chatpro" | "sonnet">("chat");
  const [newAssignedTo, setNewAssignedTo] = useState<"kevin" | "brenthomer">("kevin");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  // Review modal state
  const [reviewModal, setReviewModal] = useState<{ taskId: string; title: string } | null>(null);
  const [reviewSummary, setReviewSummary] = useState("");
  const [reviewQuestions, setReviewQuestions] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  // Return feedback modal state
  const [returnModal, setReturnModal] = useState<{ taskId: string; title: string } | null>(null);
  const [returnFeedback, setReturnFeedback] = useState("");
  const [returnSaving, setReturnSaving] = useState(false);

  // Approve with note modal state
  const [approveModal, setApproveModal] = useState<{ taskId: string; title: string } | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [approveSaving, setApproveSaving] = useState(false);

  // Inline comment state (keyed by task id)
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [commentSaving, setCommentSaving] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      console.log("Loaded tasks:", data);
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: Task["status"], comment?: { author: string; text: string }) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    const body: Record<string, unknown> = { status };
    if (comment) body.comment = comment;
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  };

  const submitReturn = async () => {
    if (!returnModal || !returnFeedback.trim()) return;
    setReturnSaving(true);
    try {
      await updateStatus(returnModal.taskId, "in-progress", { author: "kevin", text: returnFeedback.trim() });
      setReturnModal(null);
      setReturnFeedback("");
    } finally {
      setReturnSaving(false);
    }
  };

  const submitApprove = async () => {
    if (!approveModal) return;
    setApproveSaving(true);
    try {
      const comment = approveNote.trim() ? { author: "kevin", text: approveNote.trim() } : undefined;
      await updateStatus(approveModal.taskId, "completed", comment);
      setApproveModal(null);
      setApproveNote("");
    } finally {
      setApproveSaving(false);
    }
  };

  const addComment = async (taskId: string) => {
    const text = commentTexts[taskId]?.trim();
    if (!text) return;
    setCommentSaving(prev => ({ ...prev, [taskId]: true }));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "comment", author: "kevin", text }),
      });
      if (!res.ok) {
        console.error("Failed to add comment:", await res.text());
        return;
      }
      setCommentTexts(prev => ({ ...prev, [taskId]: "" }));
      await load();
    } finally {
      setCommentSaving(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const openReviewModal = (task: Task) => {
    setReviewSummary(task.reviewSummary ?? "");
    setReviewQuestions(task.reviewQuestions ?? "");
    setReviewModal({ taskId: task.id, title: task.title });
  };

  const submitReview = async () => {
    if (!reviewModal) return;
    setReviewSaving(true);
    try {
      const patch = { status: "review" as const, reviewSummary, reviewQuestions };
      setTasks(prev => prev.map(t => t.id === reviewModal.taskId ? { ...t, ...patch } : t));
      await fetch(`/api/tasks/${reviewModal.taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setReviewModal(null);
      setReviewSummary("");
      setReviewQuestions("");
    } finally {
      setReviewSaving(false);
    }
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  };

  const deleteAttachment = async (taskId: string, attId: string) => {
    await fetch(`/api/tasks/${taskId}?attId=${attId}`, { method: "DELETE" });
    setTasks(prev => prev.map(t => t.id === taskId
      ? { ...t, attachments: t.attachments?.filter(a => a.id !== attId) }
      : t));
  };

  const addTask = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      // When assigned to Brent, always use gpt-4o; otherwise use the agent picker
      const assignedModel = newAssignedTo === "brenthomer" ? "openai/gpt-4o" : difficultyToModel(newDifficulty);
      let res: Response;
      if (stagedFiles.length > 0) {
        const form = new FormData();
        form.append("title", newTitle.trim());
        if (newDesc.trim()) form.append("description", newDesc.trim());
        if (newDifficulty) form.append("difficulty", newDifficulty);
        form.append("assignedTo", newAssignedTo);
        if (assignedModel) form.append("assignedModel", assignedModel);
        stagedFiles.forEach(f => form.append("files", f));
        res = await fetch("/api/tasks", { method: "POST", body: form });
      } else {
        res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newTitle.trim(),
            description: newDesc.trim() || undefined,
            difficulty: newDifficulty,
            assignedTo: newAssignedTo,
            assignedModel: assignedModel || undefined,
          }),
        });
      }
      const task = await res.json();
      setTasks(prev => [task, ...prev]);
      setNewTitle("");
      setNewDesc("");
      setNewDifficulty("chat");
      setNewAssignedTo("kevin");
      setStagedFiles([]);
      setShowAdd(false);
    } finally {
      setSaving(false);
    }
  };

  const filtered = tasks.filter(t => filter === "all" || t.status === filter);
  const counts = {
    all: tasks.length,
    open: tasks.filter(t => t.status === "open").length,
    "in-progress": tasks.filter(t => t.status === "in-progress").length,
    review: tasks.filter(t => t.status === "review").length,
    completed: tasks.filter(t => t.status === "completed").length,
  };

  return (
    <div>
      {/* Filter + Add */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {(["all", "open", "in-progress", "review", "completed"] as FilterStatus[]).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
              filter === s ? "bg-[#2A2A3E] text-white ring-2 ring-white/20" : "bg-[#1A1A2E] text-gray-400 hover:text-white"
            } ${s === "review" && counts.review > 0 && filter !== "review" ? "ring-1 ring-purple-500/50" : ""}`}>
            {s === "in-progress" ? "In Progress" : s === "review" ? "Needs Review" : s.charAt(0).toUpperCase() + s.slice(1)}{" "}
            <span className={s === "review" && counts.review > 0 ? "text-purple-400 font-bold" : "text-gray-500"}>({counts[s]})</span>
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: "#f5c200", color: "#000" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#ffd633")}
          onMouseLeave={e => (e.currentTarget.style.background = "#f5c200")}>
          + Add Task
        </button>
      </div>

      {/* Add Task Form */}
      {showAdd && (
        <div className="bg-[#1A1A2E] border border-blue-500/30 rounded-xl p-5 mb-6 animate-in fade-in duration-200">
          <h3 className="text-sm font-medium text-white mb-3">New Task</h3>
          <input
            type="text"
            placeholder="Task title…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTask()}
            className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 mb-3 text-sm"
            autoFocus
          />
          <textarea
            placeholder="Description (optional)…"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            rows={2}
            className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 mb-3 text-sm resize-none"
          />

          {/* Difficulty Selection */}
          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-2 font-medium">Agent (auto-assigns model)</label>
            <div className="flex gap-3">
              {[
                { value: "gemini"   as const, label: "✦ Gemini",   hint: "gemini-2.5-flash",  color: "bg-blue-900/30 border-blue-700/50 text-blue-300" },
                { value: "deepseek" as const, label: "⚡ DeepSeek", hint: "deepseek-chat",      color: "bg-purple-900/30 border-purple-700/50 text-purple-300" },
                { value: "chat"     as const, label: "💬 Chat",     hint: "gpt-5.4 (default)",  color: "bg-green-900/30 border-green-700/50 text-green-300" },
                { value: "chatpro"  as const, label: "🚀 Chat Pro", hint: "gpt-5.4-pro",        color: "bg-cyan-900/30 border-cyan-700/50 text-cyan-300" },
        { value: "sonnet"   as const, label: "🧠 Sonnet",   hint: "claude-sonnet-4-6",  color: "bg-orange-900/30 border-orange-700/50 text-orange-300" },
              ].map(option => (
                <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="difficulty"
                    checked={newDifficulty === option.value}
                    onChange={() => setNewDifficulty(option.value)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${option.color} ${newDifficulty === option.value ? 'ring-1 ring-white/30' : ''}`}>
                    {option.label}
                  </span>
                  {newDifficulty === option.value && <span className="text-xs text-gray-500">({option.hint})</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Assign To */}
          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-2 font-medium">Assign to</label>
            <div className="flex gap-3">
              {[
                { value: "kevin" as const, label: "Kevin", hint: "Default", color: "bg-blue-900/30 border-blue-700/50 text-blue-300" },
                { value: "brenthomer" as const, label: "Brent Homer", hint: "gpt-4o", color: "bg-amber-900/30 border-amber-700/50 text-amber-300" },
              ].map(option => (
                <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="assignedTo"
                    checked={newAssignedTo === option.value}
                    onChange={() => setNewAssignedTo(option.value)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${option.color} ${newAssignedTo === option.value ? 'ring-1 ring-white/30' : ''}`}>
                    {option.label}
                  </span>
                  {newAssignedTo === option.value && <span className="text-xs text-gray-500">({option.hint})</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Attachments */}
          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-2">Attachments</label>
            <FileDropZone files={stagedFiles} onFiles={setStagedFiles} />
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowAdd(false); setStagedFiles([]); }}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button onClick={addTask} disabled={saving || !newTitle.trim()}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium">
              {saving ? "Saving…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={e => { if (e.target === e.currentTarget) setReviewModal(null); }}>
          <div className="bg-[#1A1A2E] border border-purple-500/40 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-base font-semibold text-white mb-1">👁 Send for Review</h2>
            <p className="text-xs text-gray-400 mb-4 truncate">Task: <span className="text-purple-300">{reviewModal.title}</span></p>

            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">📋 What did you do? <span className="text-gray-600">(summary)</span></label>
              <textarea
                value={reviewSummary}
                onChange={e => setReviewSummary(e.target.value)}
                placeholder="Briefly describe what was completed, changed, or implemented…"
                rows={4}
                className="w-full bg-[#0A0A0F] border border-[#2A2A3E] focus:border-purple-500/50 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none text-sm resize-none"
                autoFocus
              />
            </div>

            <div className="mb-5">
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">❓ Questions for Kevin <span className="text-gray-600">(optional)</span></label>
              <textarea
                value={reviewQuestions}
                onChange={e => setReviewQuestions(e.target.value)}
                placeholder="Any decisions you need input on, things to verify, or open questions…"
                rows={3}
                className="w-full bg-[#0A0A0F] border border-[#2A2A3E] focus:border-yellow-500/50 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none text-sm resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setReviewModal(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={submitReview} disabled={reviewSaving || !reviewSummary.trim()}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                {reviewSaving ? "Sending…" : "Send for Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Feedback Modal */}
      {returnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={e => { if (e.target === e.currentTarget) setReturnModal(null); }}>
          <div className="bg-[#1A1A2E] border border-blue-500/40 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-base font-semibold text-white mb-1">↩ Return Task</h2>
            <p className="text-xs text-gray-400 mb-4 truncate">Task: <span className="text-blue-300">{returnModal.title}</span></p>

            <div className="mb-5">
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">What needs to be fixed?</label>
              <textarea
                value={returnFeedback}
                onChange={e => setReturnFeedback(e.target.value)}
                placeholder="What needs to be fixed?"
                rows={4}
                className="w-full bg-[#0A0A0F] border border-[#2A2A3E] focus:border-blue-500/50 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none text-sm resize-none"
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => { setReturnModal(null); setReturnFeedback(""); }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={submitReturn} disabled={returnSaving || !returnFeedback.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                {returnSaving ? "Returning…" : "Return with Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve with Note Modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={e => { if (e.target === e.currentTarget) setApproveModal(null); }}>
          <div className="bg-[#1A1A2E] border border-green-500/40 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-base font-semibold text-white mb-1">✓ Approve Task</h2>
            <p className="text-xs text-gray-400 mb-4 truncate">Task: <span className="text-green-300">{approveModal.title}</span></p>

            <div className="mb-5">
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Add a note <span className="text-gray-600">(optional)</span></label>
              <textarea
                value={approveNote}
                onChange={e => setApproveNote(e.target.value)}
                placeholder="Any notes or feedback…"
                rows={3}
                className="w-full bg-[#0A0A0F] border border-[#2A2A3E] focus:border-green-500/50 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none text-sm resize-none"
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => { setApproveModal(null); setApproveNote(""); }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={submitApprove} disabled={approveSaving}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                {approveSaving ? "Approving…" : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[#1A1A2E] rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">✅</p>
          <p>{filter === "all" ? "No tasks yet" : `No ${filter} tasks`}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(task => {
            const cfg = STATUS_CONFIG[task.status];
            return (
              <div key={task.id}
                className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-4 hover:border-[#3A3A4E] transition-colors animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${cfg.dot}`} />

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === "completed" ? "line-through text-gray-500" : "text-white"}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                      {task.assignedTo === "brenthomer" && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-900/30 border-amber-700/50 text-amber-300">Brent</span>
                      )}
                      <span className="text-xs text-gray-600" suppressHydrationWarning>{formatDate(task.createdAt)}</span>
                      {task.completedAt && (
                        <span className="text-xs text-gray-600" suppressHydrationWarning>Done {formatDate(task.completedAt)}</span>
                      )}
                      {task.reviewedAt && (
                        <span className="text-xs text-gray-600" suppressHydrationWarning>Sent for review {formatDate(task.reviewedAt)}</span>
                      )}
                      {task.comments && task.comments.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800/50 text-gray-300 border border-gray-700/50">
                          💬 {task.comments.length}
                        </span>
                      )}
                    </div>

                    {/* Review summary & questions */}
                    {task.status === "review" && (task.reviewSummary || task.reviewQuestions) && (
                      <div className="mt-3 space-y-2">
                        {task.reviewSummary && (
                          <div className="bg-purple-900/20 border border-purple-800/40 rounded-lg px-3 py-2">
                            <p className="text-xs font-semibold text-purple-300 mb-1">📋 What was done</p>
                            <p className="text-xs text-gray-300 whitespace-pre-wrap">{task.reviewSummary}</p>
                          </div>
                        )}
                        {task.reviewQuestions && (
                          <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-lg px-3 py-2">
                            <p className="text-xs font-semibold text-yellow-300 mb-1">❓ Questions for you</p>
                            <p className="text-xs text-gray-300 whitespace-pre-wrap">{task.reviewQuestions}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Attachments */}
                    {task.attachments && task.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {task.attachments.map(att => (
                          <AttachmentChip key={att.id} att={att} taskId={task.id}
                            onDelete={() => deleteAttachment(task.id, att.id)} />
                        ))}
                      </div>
                    )}

                    {/* Comments Thread */}
                    {task.comments && task.comments.length > 0 && (
                      <div className="mt-3 border-t border-[#2A2A3E] pt-3">
                        <p className="text-xs font-medium text-gray-500 mb-2">Comments</p>
                        <div className="space-y-2">
                          {task.comments.map(c => (
                            <div key={c.id} className="flex gap-2">
                              <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold ${
                                c.author === "kevin" ? "bg-blue-600/30 text-blue-300" : "bg-purple-600/30 text-purple-300"
                              }`}>
                                {c.author === "kevin" ? "K" : "A"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-medium ${
                                    c.author === "kevin" ? "text-blue-300" : "text-purple-300"
                                  }`}>
                                    {c.author === "kevin" ? "Kevin" : "Axel"}
                                  </span>
                                  <span className="text-xs text-gray-600" suppressHydrationWarning>
                                    {formatRelativeTime(c.createdAt)}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-300 mt-0.5 whitespace-pre-wrap">{c.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add Comment */}
                    <div className={`mt-3 flex gap-2 ${!task.comments?.length ? "border-t border-[#2A2A3E] pt-3" : ""}`}>
                      <input
                        type="text"
                        placeholder="Add a comment…"
                        value={commentTexts[task.id] ?? ""}
                        onChange={e => setCommentTexts(prev => ({ ...prev, [task.id]: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && addComment(task.id)}
                        className="flex-1 bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                      />
                      <button
                        onClick={() => addComment(task.id)}
                        disabled={!commentTexts[task.id]?.trim() || commentSaving[task.id]}
                        className="px-3 py-1.5 text-xs rounded-lg bg-[#2A2A3E] text-gray-300 hover:text-white hover:bg-[#3A3A4E] disabled:opacity-40 transition-colors shrink-0"
                      >
                        {commentSaving[task.id] ? "…" : "Add Comment"}
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    {/* Open: start */}
                    {task.status === "open" && (
                      <button onClick={() => updateStatus(task.id, "in-progress")} title="Start"
                        className="px-2 py-1 text-xs rounded bg-blue-900/40 text-blue-300 hover:bg-blue-900/70 transition-colors">▶</button>
                    )}
                    {/* In-progress: send to review or complete */}
                    {task.status === "in-progress" && (
                      <button onClick={() => openReviewModal(task)} title="Send for Review"
                        className="px-2 py-1 text-xs rounded bg-purple-900/40 text-purple-300 hover:bg-purple-900/70 transition-colors">👁 Review</button>
                    )}
                    {(task.status === "open" || task.status === "in-progress") && (
                      <button onClick={() => updateStatus(task.id, "completed")} title="Complete"
                        className="px-2 py-1 text-xs rounded bg-green-900/40 text-green-300 hover:bg-green-900/70 transition-colors">✓</button>
                    )}
                    {/* Review: approve or return */}
                    {task.status === "review" && (
                      <>
                        <button onClick={() => setApproveModal({ taskId: task.id, title: task.title })} title="Approve & Complete"
                          className="px-2 py-1 text-xs rounded bg-green-900/40 text-green-300 hover:bg-green-900/70 transition-colors">✓ Approve</button>
                        <button onClick={() => setReturnModal({ taskId: task.id, title: task.title })} title="Return to In Progress"
                          className="px-2 py-1 text-xs rounded bg-blue-900/40 text-blue-300 hover:bg-blue-900/70 transition-colors">↩ Return</button>
                      </>
                    )}
                    {/* Completed: reopen */}
                    {task.status === "completed" && (
                      <button onClick={() => updateStatus(task.id, "open")} title="Reopen"
                        className="px-2 py-1 text-xs rounded bg-yellow-900/40 text-yellow-300 hover:bg-yellow-900/70 transition-colors">↩</button>
                    )}
                    <button onClick={() => deleteTask(task.id)} title="Delete"
                      className="px-2 py-1 text-xs rounded bg-red-900/40 text-red-400 hover:bg-red-900/70 transition-colors">✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
