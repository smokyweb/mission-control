"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  filename: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in-progress" | "completed" | "review";
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  reviewedAt?: number;
  reviewSummary?: string;
  reviewQuestions?: string;
  attachments?: Attachment[];
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
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  // Review modal state
  const [reviewModal, setReviewModal] = useState<{ taskId: string; title: string } | null>(null);
  const [reviewSummary, setReviewSummary] = useState("");
  const [reviewQuestions, setReviewQuestions] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: Task["status"]) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
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
      let res: Response;
      if (stagedFiles.length > 0) {
        const form = new FormData();
        form.append("title", newTitle.trim());
        if (newDesc.trim()) form.append("description", newDesc.trim());
        stagedFiles.forEach(f => form.append("files", f));
        res = await fetch("/api/tasks", { method: "POST", body: form });
      } else {
        res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle.trim(), description: newDesc.trim() || undefined }),
        });
      }
      const task = await res.json();
      setTasks(prev => [task, ...prev]);
      setNewTitle("");
      setNewDesc("");
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
          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
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
                      <span className="text-xs text-gray-600" suppressHydrationWarning>{formatDate(task.createdAt)}</span>
                      {task.completedAt && (
                        <span className="text-xs text-gray-600" suppressHydrationWarning>Done {formatDate(task.completedAt)}</span>
                      )}
                      {task.reviewedAt && (
                        <span className="text-xs text-gray-600" suppressHydrationWarning>Sent for review {formatDate(task.reviewedAt)}</span>
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
                        <button onClick={() => updateStatus(task.id, "completed")} title="Approve & Complete"
                          className="px-2 py-1 text-xs rounded bg-green-900/40 text-green-300 hover:bg-green-900/70 transition-colors">✓ Approve</button>
                        <button onClick={() => updateStatus(task.id, "in-progress")} title="Return to In Progress"
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
