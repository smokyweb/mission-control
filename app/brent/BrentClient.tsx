"use client";

import { useCallback, useEffect, useState } from "react";

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
  assignedTo?: "kevin" | "brenthomer";
  assignedModel?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
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

export default function BrentClient() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [loading, setLoading] = useState(true);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [commentSaving, setCommentSaving] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      const all: Task[] = Array.isArray(data) ? data : [];
      setTasks(all.filter(t => t.assignedTo === "brenthomer"));
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
    await load();
  };

  const addComment = async (taskId: string) => {
    const text = commentTexts[taskId]?.trim();
    if (!text) return;
    setCommentSaving(prev => ({ ...prev, [taskId]: true }));
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "comment", author: "kevin", text }),
      });
      setCommentTexts(prev => ({ ...prev, [taskId]: "" }));
      await load();
    } finally {
      setCommentSaving(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
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
      {/* Filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {(["all", "open", "in-progress", "review", "completed"] as FilterStatus[]).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
              filter === s ? "bg-[#2A2A3E] text-white ring-2 ring-white/20" : "bg-[#1A1A2E] text-gray-400 hover:text-white"
            }`}>
            {s === "in-progress" ? "In Progress" : s === "review" ? "Needs Review" : s.charAt(0).toUpperCase() + s.slice(1)}{" "}
            <span className="text-gray-500">({counts[s]})</span>
          </button>
        ))}
      </div>

      {/* Info Banner */}
      <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3 mb-6">
        <p className="text-xs text-amber-300">Showing tasks assigned to <strong>Brent Homer</strong> (model: gpt-4o). Create new tasks for Brent from the <a href="/tasks" className="underline text-amber-200 hover:text-white">Tasks</a> page.</p>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[#1A1A2E] rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">📋</p>
          <p>{filter === "all" ? "No tasks assigned to Brent yet" : `No ${filter} tasks for Brent`}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(task => {
            const cfg = STATUS_CONFIG[task.status];
            return (
              <div key={task.id}
                className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-4 hover:border-[#3A3A4E] transition-colors">
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
                    </div>

                    {/* Comments */}
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
                                  <span className={`text-xs font-medium ${c.author === "kevin" ? "text-blue-300" : "text-purple-300"}`}>
                                    {c.author === "kevin" ? "Kevin" : "Axel"}
                                  </span>
                                  <span className="text-xs text-gray-600" suppressHydrationWarning>{formatRelativeTime(c.createdAt)}</span>
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
                    {task.status === "open" && (
                      <button onClick={() => updateStatus(task.id, "in-progress")} title="Start"
                        className="px-2 py-1 text-xs rounded bg-blue-900/40 text-blue-300 hover:bg-blue-900/70 transition-colors">▶</button>
                    )}
                    {(task.status === "open" || task.status === "in-progress") && (
                      <button onClick={() => updateStatus(task.id, "completed")} title="Complete"
                        className="px-2 py-1 text-xs rounded bg-green-900/40 text-green-300 hover:bg-green-900/70 transition-colors">✓</button>
                    )}
                    {task.status === "review" && (
                      <>
                        <button onClick={() => updateStatus(task.id, "completed")} title="Approve"
                          className="px-2 py-1 text-xs rounded bg-green-900/40 text-green-300 hover:bg-green-900/70 transition-colors">✓ Approve</button>
                        <button onClick={() => updateStatus(task.id, "in-progress")} title="Return"
                          className="px-2 py-1 text-xs rounded bg-blue-900/40 text-blue-300 hover:bg-blue-900/70 transition-colors">↩ Return</button>
                      </>
                    )}
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
