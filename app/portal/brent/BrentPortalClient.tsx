"use client";
export const dynamic = "force-dynamic";

import { useState, useCallback, useEffect, useMemo } from "react";
import Image from "next/image";

// ── Types ──────────────────────────────────────────────────────────────────
interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: number;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in-progress" | "completed" | "review";
  assignedTo?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  comments?: Comment[];
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
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  calendar: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const PORTAL_PASSWORD = "brent2026";
const GOLD = "#f5c200";
const GOLD_DIM = "rgba(245,194,0,0.12)";
const GOLD_BORDER = "rgba(245,194,0,0.25)";

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
  // Cloudflare Access already enforces auth — skip password gate
  const [authed, setAuthed] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthed(true); setError("");
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
  const [tab, setTab] = useState<"tasks" | "todos" | "calendar">("calendar");
  const [loading, setLoading] = useState(true);
  const [healthy, setHealthy] = useState<boolean | null>(null);

  // Edit task state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Comments state
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

  // Todo form state
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoDue, setNewTodoDue] = useState("");
  const [todoSaving, setTodoSaving] = useState(false);

  // Calendar state
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventFormDate, setEventFormDate] = useState("");
  const [eventFormSummary, setEventFormSummary] = useState("");
  const [eventFormDesc, setEventFormDesc] = useState("");
  const [eventFormStart, setEventFormStart] = useState("09:00");
  const [eventFormEnd, setEventFormEnd] = useState("10:00");
  const [eventFormAllDay, setEventFormAllDay] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventSaving, setEventSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>("");

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealthy(data.ok);
    } catch {
      setHealthy(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [taskRes, todoRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/brent-todos"),
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

  const [calError, setCalError] = useState<string | null>(null);

  const loadCalendar = useCallback(async () => {
    try {
      setCalError(null);
      const start = new Date(calYear, calMonth, -6);
      const end = new Date(calYear, calMonth + 1, 13);
      const res = await fetch(`/api/brent-gcal?start=${start.toISOString()}&end=${end.toISOString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          setCalError(data.error);
          setEvents([]);
        } else {
          setEvents(Array.isArray(data) ? data : []);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setCalError(data.error || "Failed to load calendar");
        setEvents([]);
      }
    } catch {
      setCalError("Calendar connection error");
      setEvents([]);
    }
  }, [calYear, calMonth]);

  useEffect(() => {
    loadData();
    loadCalendar();
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [loadData, loadCalendar, checkHealth]);


  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskProject, setNewTaskProject] = useState<"general" | "photohealthy" | "testing">("general");
  const [addingTask, setAddingTask] = useState(false);

  const PROJECT_MAP = {
    general:      { label: "General",       assignedModel: "openai/gpt-5.4",              assignedAgent: "axelgpt54",     channel: "1482069479461617787" },
    photohealthy: { label: "Photo Healthy", assignedModel: "anthropic/claude-sonnet-4-6", assignedAgent: "axelsonnet3",   channel: "1483088075746971779" },
    testing:      { label: "Testing",       assignedModel: "openai/gpt-5.4",              assignedAgent: "axeltesting",   channel: "1481635299867234409" },
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer aa1b53c2607f680636130babfa49bb97f4cd82c62fe429f7" },
        body: JSON.stringify({ title: newTaskTitle.trim(), description: newTaskDesc.trim(), assignedTo: "brenthomer", project: newTaskProject, assignedModel: PROJECT_MAP[newTaskProject].assignedModel, assignedAgent: PROJECT_MAP[newTaskProject].assignedAgent, difficulty: "medium", status: "open" }),
      });
      if (res.ok) {
        setNewTaskTitle("");
        setNewTaskDesc("");
        setShowAddTask(false);
        await loadData();
      }
    } finally {
      setAddingTask(false);
    }
  };
  const updateTaskStatus = async (id: string, status: string) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadData();
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditTitle("");
    setEditDescription("");
  };

  const saveEdit = async () => {
    if (!editingTaskId || !editTitle.trim()) return;
    setEditSaving(true);
    try {
      await fetch(`/api/tasks/${editingTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), description: editDescription.trim() || undefined }),
      });
      cancelEditing();
      await loadData();
    } finally {
      setEditSaving(false);
    }
  };

  const addComment = async (taskId: string) => {
    if (!newComment.trim()) return;
    setCommentSaving(true);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "comment", author: "brent", text: newComment.trim() }),
      });
      setNewComment("");
      await loadData();
    } finally {
      setCommentSaving(false);
    }
  };

  const toggleComments = (taskId: string) => {
    setExpandedTaskId(prev => prev === taskId ? null : taskId);
    setNewComment("");
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    setTodoSaving(true);
    try {
      await fetch("/api/brent-todos", {
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
    await fetch(`/api/brent-todos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed: true }),
    });
    await loadData();
  };

  const openEventForm = (dateStr: string, event?: GCalEvent) => {
    setEventFormDate(dateStr);
    if (event) {
      setEditingEventId(event.id);
      setEventFormSummary(event.summary);
      setEventFormDesc(event.description || "");
      if (event.start.date) {
        setEventFormAllDay(true);
        setEventFormStart("09:00");
        setEventFormEnd("10:00");
      } else if (event.start.dateTime) {
        setEventFormAllDay(false);
        const s = new Date(event.start.dateTime);
        const e = new Date(event.end.dateTime!);
        setEventFormStart(`${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`);
        setEventFormEnd(`${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`);
      }
    } else {
      setEditingEventId(null);
      setEventFormSummary("");
      setEventFormDesc("");
      setEventFormAllDay(false);
      setEventFormStart("09:00");
      setEventFormEnd("10:00");
    }
    setEventFormOpen(true);
  };

  const closeEventForm = () => {
    setEventFormOpen(false);
    setEditingEventId(null);
    setEventFormSummary("");
    setEventFormDesc("");
  };

  const saveEvent = async () => {
    if (!eventFormSummary.trim()) return;
    setEventSaving(true);
    try {
      const startBody = eventFormAllDay
        ? { date: eventFormDate }
        : { dateTime: new Date(`${eventFormDate}T${eventFormStart}`).toISOString() };
      const endBody = eventFormAllDay
        ? { date: eventFormDate }
        : { dateTime: new Date(`${eventFormDate}T${eventFormEnd}`).toISOString() };
      if (editingEventId) {
        await fetch("/api/brent-gcal", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingEventId, summary: eventFormSummary.trim(), description: eventFormDesc.trim() || undefined, start: startBody, end: endBody }),
        });
      } else {
        await fetch("/api/brent-gcal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary: eventFormSummary.trim(), description: eventFormDesc.trim() || undefined, start: startBody, end: endBody }),
        });
      }
      closeEventForm();
      await loadCalendar();
    } finally {
      setEventSaving(false);
    }
  };

  const deleteEvent = async (id: string) => {
    await fetch(`/api/brent-gcal?id=${id}`, { method: "DELETE" });
    closeEventForm();
    await loadCalendar();
  };

  const activeTodos = useMemo(() => todos.filter(t => !t.completed), [todos]);

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }, []);

  // Initialize selectedDay to today on first render
  useEffect(() => {
    if (!selectedDay) setSelectedDay(todayStr);
  }, [todayStr, selectedDay]);

  const calendarDays = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();
    const days: { day: number; currentMonth: boolean; dateStr: string }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const dt = new Date(calYear, calMonth - 1, d);
      days.push({ day: d, currentMonth: false, dateStr: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dt = new Date(calYear, calMonth, i);
      days.push({ day: i, currentMonth: true, dateStr: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` });
    }
    while (days.length % 7 !== 0) {
      const d = days.length - firstDay - daysInMonth + 1;
      const dt = new Date(calYear, calMonth + 1, d);
      days.push({ day: d, currentMonth: false, dateStr: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` });
    }
    return days;
  }, [calYear, calMonth]);

  const eventsMap = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const map: Record<string, GCalEvent[]> = {};
    for (const ev of events) {
      let dateStr = ev.start.date;
      if (!dateStr && ev.start.dateTime) {
        const d = new Date(ev.start.dateTime);
        dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
      if (!dateStr) continue;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(ev);
    }
    return map;
  }, [events]);

  const navigateMonth = (delta: number) => {
    const d = new Date(calYear, calMonth + delta, 1);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid #2A2A3E", borderRadius: "6px",
    padding: "10px 12px", color: "#fff", fontSize: "14px", outline: "none", width: "100%", boxSizing: "border-box",
  };

  const sidebarLinks: { key: typeof tab; label: string; icon: string }[] = [
    { key: "calendar", label: "Calendar",  icon: "/icons/icon-7.png"  },
    { key: "tasks",    label: "My Tasks",  icon: "/icons/icon-17.png" },
    { key: "todos",    label: "To-Dos",    icon: "/icons/icon-17.png" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ── Left Sidebar (matches NavBar.tsx exactly) ── */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "220px",
          background: "#000",
          borderRight: `1px solid ${GOLD_BORDER}`,
          display: "flex",
          flexDirection: "column",
          zIndex: 50,
          overflowY: "auto",
        }}
      >
        {/* Logo Header */}
        <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${GOLD_BORDER}`, cursor: "pointer" }} onClick={() => setTab("calendar")}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Image
                src="/batman-logo.jpg"
                alt="Brent Portal"
                width={42}
                height={42}
                style={{ borderRadius: "50%", border: `2px solid ${GOLD}`, display: "block" }}
              />
              <div style={{
                position: "absolute", inset: -3, borderRadius: "50%",
                boxShadow: `0 0 12px ${GOLD}55`, pointerEvents: "none",
              }} />
            </div>
            <div>
              <div style={{ color: GOLD, fontWeight: 800, fontSize: "15px", letterSpacing: "0.08em", lineHeight: 1 }}>
                BAT CAVE
              </div>
              <div style={{ color: "rgba(245,194,0,0.45)", fontSize: "10px", letterSpacing: "0.12em", marginTop: "3px" }}>
                BRENT PORTAL
              </div>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, padding: "16px 12px" }}>
          {sidebarLinks.map(({ key, label, icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  marginBottom: "2px",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "13px",
                  fontWeight: active ? 700 : 400,
                  color: active ? GOLD : "rgba(255,255,255,0.55)",
                  background: active ? GOLD_DIM : "transparent",
                  borderLeft: active ? `3px solid ${GOLD}` : "3px solid transparent",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.9)";
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)";
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }
                }}
              >
                <Image
                  src={icon}
                  alt={label}
                  width={22}
                  height={22}
                  style={{
                    filter: active
                      ? "invert(82%) sepia(100%) saturate(800%) hue-rotate(5deg) brightness(103%)"
                      : "invert(1) opacity(0.5)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ letterSpacing: "0.03em" }}>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Batman Image */}
        <div style={{ padding: "0", overflow: "hidden" }}>
          <Image
            src="/batman-face.png"
            alt="Batman"
            width={220}
            height={165}
            style={{ display: "block", width: "100%", height: "auto", opacity: 0.85 }}
          />
        </div>

        {/* Gateway Status */}
        <div style={{
          padding: "16px 20px",
          borderTop: `1px solid ${GOLD_BORDER}`,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}>
          <span style={{
            width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
            background: healthy === null ? GOLD : healthy ? "#22c55e" : "#ef4444",
            boxShadow: healthy ? "0 0 6px #22c55e88" : healthy === false ? "0 0 6px #ef444488" : `0 0 6px ${GOLD}88`,
          }} />
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}>
            {healthy === null ? "CONNECTING…" : healthy ? "GATEWAY ONLINE" : "GATEWAY OFFLINE"}
          </span>
        </div>

        {/* Gold bottom accent */}
        <div style={{ height: "3px", background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
      </aside>

      {/* ── Main Content (offset by sidebar width) ── */}
      <main style={{ flex: 1, background: "#0A0A0F", overflowY: "auto", minHeight: "100vh", marginLeft: "220px" }}>
        <div style={{ maxWidth: "100%", padding: "32px 24px" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", paddingTop: "60px" }}>Loading…</div>
        ) : (
          <>
            {/* ── Tasks Tab ── */}
            {tab === "tasks" && (
              <div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
                  <button onClick={() => setShowAddTask(v => !v)} style={{ background: showAddTask ? "transparent" : "linear-gradient(135deg, #f5c200, #e6a800)", color: showAddTask ? "rgba(255,255,255,0.5)" : "#000", border: showAddTask ? "1px solid #2A2A3E" : "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", cursor: "pointer", fontWeight: 700 }}>
                    {showAddTask ? "Cancel" : "+ Add Task"}
                  </button>
                </div>
                {showAddTask && (
                  <div style={{ background: "#1a1a2e", border: "1px solid rgba(139,92,246,0.3)", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
                    <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Task title..." style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", padding: "10px 12px", color: "#fff", fontSize: "14px", marginBottom: "8px", boxSizing: "border-box" }} />
                    <textarea value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} placeholder="Description (optional)..." rows={3} style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", padding: "10px 12px", color: "#fff", fontSize: "14px", marginBottom: "10px", resize: "vertical", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
                      {(["general", "photohealthy", "testing"] as const).map(p => (
                        <label key={p} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px", color: newTaskProject === p ? "#8b5cf6" : "rgba(255,255,255,0.5)" }}>
                          <input type="radio" name="project" value={p} checked={newTaskProject === p} onChange={() => setNewTaskProject(p)} style={{ accentColor: "#8b5cf6" }} />
                          {PROJECT_MAP[p].label}
                        </label>
                      ))}
                    </div>
                    <button onClick={addTask} disabled={addingTask || !newTaskTitle.trim()} style={{ background: addingTask || !newTaskTitle.trim() ? "rgba(245,194,0,0.4)" : "linear-gradient(135deg, #f5c200, #e6a800)", color: "#000", border: "none", borderRadius: "8px", padding: "9px 20px", fontSize: "13px", cursor: addingTask || !newTaskTitle.trim() ? "not-allowed" : "pointer", fontWeight: 700 }}>
                      {addingTask ? "Adding..." : "Add Task"}
                    </button>
                  </div>
                )}
                {tasks.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.25)" }}>
                    <div style={{ fontSize: "36px", marginBottom: "10px" }}>📋</div>
                    No tasks assigned to you yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {tasks.map(task => {
                      const sc = STATUS_COLORS[task.status] || STATUS_COLORS.open;
                      const isEditing = editingTaskId === task.id;
                      const isExpanded = expandedTaskId === task.id;
                      const commentCount = task.comments?.length || 0;
                      return (
                        <div key={task.id} style={{
                          background: "#1A1A2E", border: "1px solid #2A2A3E", borderRadius: "10px", padding: "14px 16px",
                        }}>
                          {isEditing ? (
                            /* ── Inline Edit Form ── */
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <input
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                placeholder="Task title..."
                                autoFocus
                                style={{ ...inputStyle, fontWeight: 500 }}
                              />
                              <textarea
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                                placeholder="Description (optional)..."
                                rows={3}
                                style={{ ...inputStyle, resize: "vertical" }}
                              />
                              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                <button onClick={cancelEditing} style={{
                                  padding: "6px 14px", background: "transparent", border: "1px solid #2A2A3E",
                                  borderRadius: "6px", color: "rgba(255,255,255,0.4)", fontSize: "12px", cursor: "pointer",
                                }}>
                                  Cancel
                                </button>
                                <button onClick={saveEdit} disabled={editSaving || !editTitle.trim()} style={{
                                  padding: "6px 16px", background: editSaving || !editTitle.trim() ? "rgba(139,92,246,0.4)" : "#8b5cf6",
                                  border: "none", borderRadius: "6px", color: "#fff", fontWeight: 600, fontSize: "12px",
                                  cursor: editSaving || !editTitle.trim() ? "not-allowed" : "pointer",
                                }}>
                                  {editSaving ? "Saving..." : "Save"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* ── Normal Task Display ── */
                            <div>
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
                                  <button onClick={() => startEditing(task)}
                                    style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px", border: "none", cursor: "pointer", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                                    Edit
                                  </button>
                                  <button onClick={() => toggleComments(task.id)}
                                    style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px", border: "none", cursor: "pointer", background: isExpanded ? "rgba(245,194,0,0.15)" : "rgba(255,255,255,0.08)", color: isExpanded ? GOLD : "rgba(255,255,255,0.5)" }}>
                                    {commentCount > 0 ? `${commentCount}` : ""} Comments
                                  </button>
                                  {task.status === "open" && (
                                    <button onClick={() => updateTaskStatus(task.id, "in-progress")}
                                      style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px", border: "none", cursor: "pointer", background: "rgba(59,130,246,0.2)", color: "#60a5fa" }}>
                                      Start
                                    </button>
                                  )}
                                  {task.status === "in-progress" && (
                                    <button onClick={() => updateTaskStatus(task.id, "completed")}
                                      style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px", border: "none", cursor: "pointer", background: "rgba(34,197,94,0.2)", color: "#4ade80" }}>
                                      Done
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* ── Comments Section ── */}
                              {isExpanded && (
                                <div style={{ marginTop: "12px", borderTop: "1px solid #2A2A3E", paddingTop: "12px" }}>
                                  {commentCount > 0 && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
                                      {task.comments!.map(c => (
                                        <div key={c.id} style={{
                                          background: "rgba(255,255,255,0.03)", borderRadius: "6px", padding: "8px 10px",
                                        }}>
                                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                            <span style={{ fontSize: "11px", fontWeight: 600, color: c.author === "brent" ? GOLD : "#60a5fa" }}>
                                              {c.author}
                                            </span>
                                            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }} suppressHydrationWarning>
                                              {formatDate(c.createdAt)}
                                            </span>
                                          </div>
                                          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", margin: 0, whiteSpace: "pre-wrap" }}>
                                            {c.text}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div style={{ display: "flex", gap: "8px" }}>
                                    <input
                                      value={newComment}
                                      onChange={e => setNewComment(e.target.value)}
                                      placeholder="Add a comment..."
                                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(task.id); } }}
                                      style={{ ...inputStyle, flex: 1, fontSize: "12px", padding: "8px 10px" }}
                                    />
                                    <button onClick={() => addComment(task.id)} disabled={commentSaving || !newComment.trim()} style={{
                                      padding: "8px 14px", background: commentSaving || !newComment.trim() ? "rgba(245,194,0,0.3)" : "linear-gradient(135deg, #f5c200, #e6a800)",
                                      border: "none", borderRadius: "6px", color: "#000", fontWeight: 700, fontSize: "12px",
                                      cursor: commentSaving || !newComment.trim() ? "not-allowed" : "pointer", flexShrink: 0,
                                    }}>
                                      {commentSaving ? "..." : "Send"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
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
                      padding: "8px 16px", background: "linear-gradient(135deg, #f5c200, #e6a800)", border: "none",
                      borderRadius: "8px", color: "#000", fontSize: "13px", cursor: "pointer", fontWeight: 700,
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
                          padding: "6px 16px", background: todoSaving || !newTodoTitle.trim() ? "rgba(245,194,0,0.4)" : "linear-gradient(135deg, #f5c200, #e6a800)", border: "none", borderRadius: "6px",
                          color: "#000", fontWeight: 700, fontSize: "12px", cursor: todoSaving || !newTodoTitle.trim() ? "not-allowed" : "pointer",
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
                {/* Calendar Error / Reconnect Banner */}
                {calError && (
                  <div style={{
                    background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)",
                    borderRadius: "10px", padding: "14px 16px", marginBottom: "16px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                  }}>
                    <div>
                      <p style={{ color: "#ef4444", fontWeight: 600, margin: "0 0 4px", fontSize: "14px" }}>⚠️ Calendar Disconnected</p>
                      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", margin: 0 }}>{calError}</p>
                    </div>
                    <a
                      href="/api/brent-gcal-auth"
                      style={{
                        padding: "8px 16px", borderRadius: "8px", background: GOLD,
                        color: "#000", fontWeight: 700, fontSize: "13px", textDecoration: "none",
                        whiteSpace: "nowrap", flexShrink: 0,
                      }}
                    >
                      🔗 Reconnect Calendar
                    </a>
                  </div>
                )}
                {/* Month Navigation */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <button onClick={() => navigateMonth(-1)} style={{
                    width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #2A2A3E",
                    background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", fontSize: "16px",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>&#8249;</button>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <h2 style={{ color: "#fff", fontSize: "16px", fontWeight: 600, margin: 0 }}>
                      {new Date(calYear, calMonth).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                    </h2>
                    {(calMonth !== new Date().getMonth() || calYear !== new Date().getFullYear()) && (
                      <button onClick={() => { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()); }} style={{
                        padding: "3px 10px", borderRadius: "12px", border: `1px solid ${GOLD_BORDER}`,
                        background: "transparent", color: GOLD, fontSize: "11px", cursor: "pointer", fontWeight: 600,
                      }}>Today</button>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button onClick={() => openEventForm(todayStr)} style={{
                      background: "linear-gradient(135deg, #f5c200, #e6a800)", color: "#000", fontWeight: 700,
                      borderRadius: "8px", padding: "8px 18px", fontSize: "13px", border: "none", cursor: "pointer",
                    }}>+ Add Event</button>
                    <button onClick={() => navigateMonth(1)} style={{
                      width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #2A2A3E",
                      background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", fontSize: "16px",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>&#8250;</button>
                  </div>
                </div>

                <div style={{ width: "100%" }}>
                {/* Day-of-Week Headers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", marginBottom: "1px" }}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                    <div key={d} style={{
                      textAlign: "center", fontSize: "11px", color: "rgba(255,255,255,0.35)",
                      padding: "6px 0", fontWeight: 600, letterSpacing: "0.04em",
                    }}>{d}</div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px",
                  background: "#2A2A3E", border: "1px solid #2A2A3E", borderRadius: "8px", overflow: "hidden",
                }}>
                  {calendarDays.map((cd, i) => {
                    const dayEvents = eventsMap[cd.dateStr] || [];
                    const isToday = cd.dateStr === todayStr;
                    const isSelected = cd.dateStr === selectedDay;
                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedDay(cd.dateStr)}
                        style={{
                          background: isToday ? "rgba(245,194,0,0.04)" : "#1A1A2E",
                          minHeight: "80px", padding: "4px",
                          opacity: cd.currentMonth ? 1 : 0.3,
                          cursor: "pointer",
                          transition: "background 0.1s",
                          border: isSelected && !isToday ? `2px solid ${GOLD}` : "2px solid transparent",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = isToday ? "rgba(245,194,0,0.08)" : "rgba(255,255,255,0.03)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isToday ? "rgba(245,194,0,0.04)" : "#1A1A2E"; }}
                      >
                        <div style={{
                          fontSize: "12px", fontWeight: isToday ? 700 : 400,
                          color: isToday ? "#000" : "rgba(255,255,255,0.7)",
                          width: "22px", height: "22px", lineHeight: "22px", textAlign: "center",
                          borderRadius: "50%", background: isToday ? GOLD : "transparent",
                          marginBottom: "2px",
                        }}>
                          {cd.day}
                        </div>
                        {dayEvents.slice(0, 3).map(ev => (
                          <div
                            key={ev.id}
                            onClick={e => { e.stopPropagation(); openEventForm(cd.dateStr, ev); }}
                            style={{
                              fontSize: "10px", color: "#fff", background: "rgba(245,194,0,0.15)",
                              borderLeft: `2px solid ${GOLD}`, padding: "1px 4px", marginBottom: "1px",
                              borderRadius: "2px", overflow: "hidden", textOverflow: "ellipsis",
                              whiteSpace: "nowrap", cursor: "pointer",
                            }}
                            title={ev.summary}
                          >
                            {ev.start.dateTime ? formatEventTime(ev) + " " : ""}{ev.summary}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", paddingLeft: "4px" }}>
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                </div>

                {/* Selected Day Detail Panel */}
                {selectedDay && (
                  <div style={{
                    background: "#1A1A2E", border: "1px solid #2A2A3E", borderRadius: "12px",
                    padding: "20px", marginTop: "16px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                      <div style={{ color: "#fff", fontSize: "14px", fontWeight: 600 }}>
                        {(() => {
                          const d = new Date(selectedDay + "T00:00:00");
                          return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
                        })()}
                      </div>
                      <button
                        onClick={() => openEventForm(selectedDay)}
                        style={{
                          padding: "4px 12px", background: "rgba(245,194,0,0.15)", border: `1px solid ${GOLD_BORDER}`,
                          borderRadius: "6px", color: GOLD, fontSize: "12px", cursor: "pointer", fontWeight: 600,
                        }}
                      >+ Add</button>
                    </div>
                    {(eventsMap[selectedDay] || []).length === 0 ? (
                      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", textAlign: "center", padding: "16px 0" }}>
                        No events — click + Add Event to create one
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {(eventsMap[selectedDay] || []).map(ev => (
                          <div
                            key={ev.id}
                            className="selected-day-event-row"
                            style={{
                              display: "flex", alignItems: "flex-start", gap: "10px",
                              borderLeft: `2px solid ${GOLD}`, padding: "8px 10px",
                              borderRadius: "4px", background: "rgba(255,255,255,0.02)",
                              position: "relative",
                            }}
                            onMouseEnter={e => {
                              const btns = e.currentTarget.querySelector("[data-actions]") as HTMLElement | null;
                              if (btns) btns.style.opacity = "1";
                            }}
                            onMouseLeave={e => {
                              const btns = e.currentTarget.querySelector("[data-actions]") as HTMLElement | null;
                              if (btns) btns.style.opacity = "0";
                            }}
                          >
                            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", width: "70px", flexShrink: 0, paddingTop: "1px" }}>
                              {ev.start.date ? "All day" : ev.start.dateTime ? new Date(ev.start.dateTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : ""}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: "#fff", fontSize: "14px" }}>{ev.summary}</div>
                              {ev.description && (
                                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", marginTop: "2px" }}>{ev.description}</div>
                              )}
                            </div>
                            <div data-actions style={{
                              display: "flex", gap: "4px", opacity: 0, transition: "opacity 0.15s", flexShrink: 0,
                            }}>
                              <button
                                onClick={() => openEventForm(selectedDay, ev)}
                                style={{
                                  padding: "3px 8px", background: "rgba(255,255,255,0.08)", border: "none",
                                  borderRadius: "4px", cursor: "pointer", fontSize: "13px", lineHeight: 1,
                                }}
                                title="Edit"
                              >✏️</button>
                              <button
                                onClick={async () => {
                                  await fetch(`/api/brent-gcal?id=${ev.id}`, { method: "DELETE" });
                                  await loadCalendar();
                                }}
                                style={{
                                  padding: "3px 8px", background: "rgba(255,255,255,0.08)", border: "none",
                                  borderRadius: "4px", cursor: "pointer", fontSize: "13px", lineHeight: 1,
                                }}
                                title="Delete"
                              >🗑️</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Event Form Modal */}
                {eventFormOpen && (
                  <div
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
                    onClick={closeEventForm}
                  >
                    <div onClick={e => e.stopPropagation()} style={{
                      background: "#1A1A2E", border: "1px solid #2A2A3E", borderRadius: "12px",
                      padding: "20px", width: "100%", maxWidth: "380px",
                    }}>
                      <h3 style={{ color: "#fff", fontSize: "15px", fontWeight: 600, margin: "0 0 14px" }}>
                        {editingEventId ? "Edit Event" : "New Event"}
                      </h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <input value={eventFormSummary} onChange={e => setEventFormSummary(e.target.value)} placeholder="Event title" autoFocus style={inputStyle} />
                        <input value={eventFormDesc} onChange={e => setEventFormDesc(e.target.value)} placeholder="Description (optional)" style={inputStyle} />
                        <input type="date" value={eventFormDate} onChange={e => setEventFormDate(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
                          <input type="checkbox" checked={eventFormAllDay} onChange={e => setEventFormAllDay(e.target.checked)} style={{ accentColor: GOLD }} />
                          All day
                        </label>
                        {!eventFormAllDay && (
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <input type="time" value={eventFormStart} onChange={e => setEventFormStart(e.target.value)} style={{ ...inputStyle, flex: 1, colorScheme: "dark" }} />
                            <span style={{ color: "rgba(255,255,255,0.3)" }}>to</span>
                            <input type="time" value={eventFormEnd} onChange={e => setEventFormEnd(e.target.value)} style={{ ...inputStyle, flex: 1, colorScheme: "dark" }} />
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
                        {editingEventId && (
                          <button onClick={() => deleteEvent(editingEventId)} style={{
                            padding: "8px 14px", background: "rgba(239,68,68,0.15)", border: "none",
                            borderRadius: "6px", color: "#f87171", fontSize: "13px", cursor: "pointer", marginRight: "auto",
                          }}>Delete</button>
                        )}
                        <button onClick={closeEventForm} style={{
                          padding: "8px 14px", background: "transparent", border: "1px solid #2A2A3E",
                          borderRadius: "6px", color: "rgba(255,255,255,0.5)", fontSize: "13px", cursor: "pointer",
                        }}>Cancel</button>
                        <button onClick={saveEvent} disabled={eventSaving || !eventFormSummary.trim()} style={{
                          padding: "8px 18px", background: eventSaving || !eventFormSummary.trim() ? "rgba(245,194,0,0.4)" : "linear-gradient(135deg, #f5c200, #e6a800)",
                          border: "none", borderRadius: "6px", color: "#000", fontWeight: 700, fontSize: "13px",
                          cursor: eventSaving || !eventFormSummary.trim() ? "not-allowed" : "pointer",
                        }}>{eventSaving ? "Saving…" : "Save"}</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        </div>
      </main>
    </div>
  );
}

