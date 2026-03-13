"use client";

import { useState, useCallback, useEffect, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
interface Task {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in-progress" | "completed" | "review";
  assignedTo?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface Todo {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

interface GCalEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  calendar: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const PORTAL_PASSWORD = "brent2024";
const GOLD = "#f5c200";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: "rgba(234,179,8,0.15)", text: "#facc15" },
  "in-progress": { bg: "rgba(59,130,246,0.15)", text: "#60a5fa" },
  review: { bg: "rgba(168,85,247,0.15)", text: "#c084fc" },
  completed: { bg: "rgba(34,197,94,0.15)", text: "#4ade80" },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDueDate(d: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (d === today) return "Today";
  if (d === tomorrow) return "Tomorrow";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dueDateColor(d: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (d < today) return "#f87171";
  if (d === today) return GOLD;
  return "#a0a0b0";
}

function formatEventTime(ev: GCalEvent): string {
  if (ev.start.date) return "All day";
  if (ev.start.dateTime) {
    const s = new Date(ev.start.dateTime);
    return s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return "";
}

// ── Portal Component ───────────────────────────────────────────────────────
export default function BrentPortal() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === PORTAL_PASSWORD) {
      setAuthed(true);
      setError("");
    } else {
      setError("Incorrect password");
    }
  };

  if (!authed) {
    return (
      <div style={{ background: "#0A0A0F", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <form onSubmit={handleLogin} style={{
          background: "#1A1A2E", border: "1px solid #2A2A3E", borderRadius: "16px",
          padding: "40px", width: "100%", maxWidth: "360px", textAlign: "center",
        }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔒</div>
          <h1 style={{ color: "#fff", fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>Brent Homer Portal</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", marginBottom: "24px" }}>Enter your password to continue</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            style={{
              width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)",
              border: error ? "1px solid #ef4444" : "1px solid #2A2A3E", borderRadius: "8px",
              padding: "12px 16px", color: "#fff", fontSize: "14px", outline: "none", marginBottom: "12px",
            }}
          />
          {error && <p style={{ color: "#ef4444", fontSize: "12px", marginBottom: "8px" }}>{error}</p>}
          <button type="submit" style={{
            width: "100%", padding: "12px", background: GOLD, color: "#000",
            border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: "pointer",
          }}>
            Sign In
          </button>
        </form>
      </div>
    );
  }

  return <BrentDashboard />;
}

// ── Dashboard (after auth) ─────────────────────────────────────────────────
function BrentDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [tab, setTab] = useState<"tasks" | "todos" | "calendar">("tasks");
  const [loading, setLoading] = useState(true);

  // Todo form state
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoDue, setNewTodoDue] = useState("");
  const [todoSaving, setTodoSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [taskRes, todoRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/todos"),
      ]);
      const allTasks: Task[] = await taskRes.json();
      setTasks(Array.isArray(allTasks) ? allTasks.filter(t => t.assignedTo === "brenthomer") : []);
      const allTodos: Todo[] = await todoRes.json();
      setTodos(Array.isArray(allTodos) ? allTodos : []);
    } catch {
      setTasks([]);
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCalendar = useCallback(async () => {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start.getTime() + 7 * 86400000);
      const res = await fetch(`/api/gcal?start=${start.toISOString()}&end=${end.toISOString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(Array.isArray(data) ? data : []);
      }
    } catch {
      setEvents([]);
    }
  }, []);

  useEffect(() => { loadData(); loadCalendar(); }, [loadData, loadCalendar]);

  const updateTaskStatus = async (id: string, status: string) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadData();
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    setTodoSaving(true);
    try {
      await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTodoTitle.trim(), dueDate: newTodoDue || undefined }),
      });
      setNewTodoTitle("");
      setNewTodoDue("");
      setShowTodoForm(false);
      await loadData();
    } finally {
      setTodoSaving(false);
    }
  };

  const completeTodo = async (id: string) => {
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    await loadData();
  };

  const activeTodos = useMemo(() => todos.filter(t => !t.completed), [todos]);

  // Group calendar events by day
  const eventsByDay = useMemo(() => {
    const grouped: Record<string, GCalEvent[]> = {};
    for (const ev of events) {
      const dateStr = ev.start.date || (ev.start.dateTime ? new Date(ev.start.dateTime).toISOString().slice(0, 10) : "");
      if (!dateStr) continue;
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(ev);
    }
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid #2A2A3E", borderRadius: "6px",
    padding: "10px 12px", color: "#fff", fontSize: "14px", outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ background: "#0A0A0F", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{
        background: "#1A1A2E", borderBottom: "1px solid #2A2A3E",
        padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: "18px", fontWeight: 700, margin: 0 }}>Brent Homer</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", margin: "2px 0 0" }}>Personal Dashboard</p>
        </div>
        <div style={{ display: "flex", gap: "4px", background: "#0A0A0F", borderRadius: "8px", padding: "3px" }}>
          {(["tasks", "todos", "calendar"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "6px 16px", borderRadius: "6px", border: "none", cursor: "pointer",
              fontSize: "13px", fontWeight: tab === t ? 600 : 400,
              background: tab === t ? "#2A2A3E" : "transparent",
              color: tab === t ? "#fff" : "rgba(255,255,255,0.45)",
            }}>
              {t === "tasks" ? "My Tasks" : t === "todos" ? "To-Dos" : "Calendar"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "24px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", paddingTop: "60px" }}>Loading…</div>
        ) : (
          <>
            {/* ── Tasks Tab ── */}
            {tab === "tasks" && (
              <div>
                {tasks.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.25)" }}>
                    <div style={{ fontSize: "36px", marginBottom: "10px" }}>📋</div>
                    No tasks assigned to you yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {tasks.map(task => {
                      const sc = STATUS_COLORS[task.status] || STATUS_COLORS.open;
                      return (
                        <div key={task.id} style={{
                          background: "#1A1A2E", border: "1px solid #2A2A3E", borderRadius: "10px", padding: "14px 16px",
                        }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                            <div style={{ flex: 1 }}>
                              <p style={{
                                color: task.status === "completed" ? "rgba(255,255,255,0.35)" : "#fff",
                                fontSize: "14px", fontWeight: 500, margin: 0,
                                textDecoration: task.status === "completed" ? "line-through" : "none",
                              }}>
                                {task.title}
                              </p>
                              {task.description && (
                                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", marginTop: "4px" }}>
                                  {task.description}
                                </p>
                              )}
                              <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
                                <span style={{
                                  fontSize: "11px", padding: "2px 8px", borderRadius: "12px",
                                  background: sc.bg, color: sc.text, fontWeight: 500,
                                }}>
                                  {task.status === "in-progress" ? "In Progress" : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                                </span>
                                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }} suppressHydrationWarning>
                                  {formatDate(task.createdAt)}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                              {task.status === "open" && (
                                <button onClick={() => updateTaskStatus(task.id, "in-progress")}
                                  style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px", border: "none", cursor: "pointer", background: "rgba(59,130,246,0.2)", color: "#60a5fa" }}>
                                  ▶ Start
                                </button>
                              )}
                              {task.status === "in-progress" && (
                                <button onClick={() => updateTaskStatus(task.id, "completed")}
                                  style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px", border: "none", cursor: "pointer", background: "rgba(34,197,94,0.2)", color: "#4ade80" }}>
                                  ✓ Done
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Todos Tab ── */}
            {tab === "todos" && (
              <div>
                <div style={{ marginBottom: "16px" }}>
                  {!showTodoForm ? (
                    <button onClick={() => setShowTodoForm(true)} style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "8px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid #2A2A3E",
                      borderRadius: "8px", color: "rgba(255,255,255,0.6)", fontSize: "13px", cursor: "pointer",
                    }}>
                      + Add To-Do
                    </button>
                  ) : (
                    <form onSubmit={handleAddTodo} style={{
                      background: "#1A1A2E", border: "1px solid #2A2A3E", borderRadius: "10px", padding: "14px",
                      display: "flex", flexDirection: "column", gap: "8px",
                    }}>
                      <input autoFocus placeholder="What needs to be done?" value={newTodoTitle} onChange={e => setNewTodoTitle(e.target.value)} required style={inputStyle} />
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <input type="date" value={newTodoDue} onChange={e => setNewTodoDue(e.target.value)}
                          style={{ ...inputStyle, width: "auto", fontSize: "12px", colorScheme: "dark" }} />
                        <div style={{ flex: 1 }} />
                        <button type="button" onClick={() => { setShowTodoForm(false); setNewTodoTitle(""); setNewTodoDue(""); }}
                          style={{ padding: "6px 12px", background: "transparent", border: "1px solid #2A2A3E", borderRadius: "6px", color: "rgba(255,255,255,0.4)", fontSize: "12px", cursor: "pointer" }}>
                          Cancel
                        </button>
                        <button type="submit" disabled={todoSaving || !newTodoTitle.trim()} style={{
                          padding: "6px 16px", background: GOLD, border: "none", borderRadius: "6px",
                          color: "#000", fontWeight: 700, fontSize: "12px", cursor: "pointer", opacity: todoSaving ? 0.7 : 1,
                        }}>
                          {todoSaving ? "Adding…" : "Add"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {activeTodos.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.25)" }}>
                    <div style={{ fontSize: "36px", marginBottom: "10px" }}>✓</div>
                    All caught up!
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {activeTodos.map(todo => (
                      <div key={todo.id} style={{
                        background: "#1A1A2E", border: "1px solid #2A2A3E", borderRadius: "8px",
                        padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px",
                      }}>
                        <button onClick={() => completeTodo(todo.id)} style={{
                          width: "18px", height: "18px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.25)",
                          background: "transparent", cursor: "pointer", flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {todo.title}
                          </div>
                        </div>
                        {todo.dueDate && (
                          <span style={{ fontSize: "11px", color: dueDateColor(todo.dueDate), flexShrink: 0 }}>
                            {formatDueDate(todo.dueDate)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Calendar Tab ── */}
            {tab === "calendar" && (
              <div>
                {eventsByDay.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.25)" }}>
                    <div style={{ fontSize: "36px", marginBottom: "10px" }}>📅</div>
                    No upcoming events this week.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {eventsByDay.map(([dateStr, dayEvents]) => {
                      const d = new Date(dateStr + "T00:00:00");
                      const dayLabel = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
                      const isToday = dateStr === new Date().toISOString().slice(0, 10);
                      return (
                        <div key={dateStr}>
                          <div style={{
                            fontSize: "12px", fontWeight: 600, marginBottom: "6px",
                            color: isToday ? GOLD : "rgba(255,255,255,0.5)",
                            letterSpacing: "0.04em",
                          }}>
                            {isToday ? "TODAY" : dayLabel.toUpperCase()}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {dayEvents.map(ev => (
                              <div key={ev.id} style={{
                                background: "#1A1A2E", border: "1px solid #2A2A3E", borderRadius: "8px",
                                padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px",
                              }}>
                                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", flexShrink: 0, minWidth: "55px" }}>
                                  {formatEventTime(ev)}
                                </span>
                                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)" }}>{ev.summary}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
