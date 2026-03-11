"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/app/components/PageHeader";

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

const GOLD = "#f5c200";

function formatDueDate(d: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (d === today) return "Today";
  if (d === tomorrow) return "Tomorrow";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function dueDateColor(d: string): { bg: string; text: string } {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (d < today) return { bg: "rgba(239,68,68,0.18)", text: "#f87171" };
  if (d === today) return { bg: "rgba(245, 194, 0,0.18)", text: "#f5c200" };
  if (d === tomorrow) return { bg: "rgba(59,130,246,0.18)", text: "#93c5fd" };
  return { bg: "rgba(100,100,120,0.25)", text: "#a0a0b0" };
}

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [taskCreated, setTaskCreated] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const dragOriginIdx = useRef<number>(-1);

  // Add form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDue, setNewDue] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch("/api/todos");
      if (res.ok) setTodos(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), description: newDesc.trim() || undefined, dueDate: newDue || undefined }),
      });
      if (res.ok) { setNewTitle(""); setNewDesc(""); setNewDue(""); setShowAddForm(false); fetchTodos(); }
    } finally { setSaving(false); }
  };

  const handleSaveEdit = async (id: string, title: string, description: string, dueDate: string) => {
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        dueDate: dueDate || null,
      }),
    });
    setEditingId(null);
    fetchTodos();
  };

  const handleComplete = async (todo: Todo) => {
    await fetch(`/api/todos/${todo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }) });
    fetchTodos();
  };

  const handleUncomplete = async (todo: Todo) => {
    await fetch(`/api/todos/${todo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: false }) });
    fetchTodos();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    fetchTodos();
  };

  const handleCreateTask = async (todo: Todo) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: todo.title, description: todo.description }),
    });
    if (res.ok) setTaskCreated((prev) => ({ ...prev, [todo.id]: true }));
  };

  const undated = useMemo(() => todos.filter((t) => !t.completed && !t.dueDate), [todos]);
  const undatedRef = useRef(undated);
  useEffect(() => { undatedRef.current = undated; }, [undated]);

  const dragIdRef = useRef<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragIdRef.current = id;
    setDragId(id);
    dragOriginIdx.current = undatedRef.current.findIndex((t) => t.id === id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const currentDragId = dragIdRef.current;
    if (!currentDragId || currentDragId === targetId) { dragIdRef.current = null; setDragId(null); setDragOverId(null); return; }
    const items = [...undatedRef.current];
    const fromIdx = items.findIndex((t) => t.id === currentDragId);
    const toIdx = items.findIndex((t) => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { dragIdRef.current = null; setDragId(null); setDragOverId(null); return; }
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    const updates = items.map((t, i) => ({ id: t.id, order: i * 10 }));
    dragIdRef.current = null;
    setDragId(null); setDragOverId(null);
    setTodos((prev) => { const map = new Map(updates.map((u) => [u.id, u.order])); return prev.map((t) => (map.has(t.id) ? { ...t, order: map.get(t.id)! } : t)); });
    await fetch("/api/todos/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    fetchTodos();
  };

  const handleDragEnd = () => { dragIdRef.current = null; setDragId(null); setDragOverId(null); };

  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);
  const dated = activeTodos.filter((t) => t.dueDate);
  const undatedDisplay = activeTodos.filter((t) => !t.dueDate);

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid #2A2A3E", borderRadius: "6px",
    padding: "9px 12px", color: "#fff", fontSize: "14px", outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ background: "#0A0A0F", minHeight: "100vh" }}>
      <PageHeader title="To-Dos" subtitle="Personal task list — things to get done" icon="✅" />
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "24px 16px" }}>

        {/* Add button / form */}
        <div style={{ marginBottom: "20px" }}>
          {!showAddForm ? (
            <button onClick={() => setShowAddForm(true)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", background: "rgba(245, 194, 0,0.12)", border: `1px solid rgba(245, 194, 0,0.3)`, borderRadius: "8px", color: GOLD, fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
              <span style={{ fontSize: "18px", lineHeight: 1 }}>+</span> Add To-Do
            </button>
          ) : (
            <form onSubmit={handleAdd} style={{ background: "#1A1A2E", border: "1px solid #2A2A3E", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <input autoFocus placeholder="Title (required)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required style={inputStyle} />
              <textarea placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", fontSize: "13px" }} />
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", flexShrink: 0 }}>Due date:</label>
                <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #2A2A3E", borderRadius: "6px", padding: "6px 10px", color: "#fff", fontSize: "13px", outline: "none", colorScheme: "dark" }} />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="submit" disabled={saving || !newTitle.trim()} style={{ padding: "8px 18px", background: GOLD, border: "none", borderRadius: "6px", color: "#000", fontWeight: 700, fontSize: "13px", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Adding…" : "Add"}
                </button>
                <button type="button" onClick={() => { setShowAddForm(false); setNewTitle(""); setNewDesc(""); setNewDue(""); }} style={{ padding: "8px 14px", background: "transparent", border: "1px solid #2A2A3E", borderRadius: "6px", color: "rgba(255,255,255,0.45)", fontSize: "13px", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {loading ? (
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "14px", textAlign: "center", paddingTop: "40px" }}>Loading…</div>
        ) : (
          <>
            {dated.length > 0 && (
              <div style={{ marginBottom: "8px" }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", marginBottom: "8px", textTransform: "uppercase" }}>Scheduled</div>
                {dated.map((todo) => (
                  <TodoCard key={todo.id} todo={todo} taskCreated={taskCreated[todo.id]} isEditing={editingId === todo.id}
                    onEdit={() => setEditingId(todo.id)} onCancelEdit={() => setEditingId(null)} onSaveEdit={handleSaveEdit}
                    onComplete={handleComplete} onDelete={handleDelete} onCreateTask={handleCreateTask} draggable={false} />
                ))}
              </div>
            )}

            {undatedDisplay.length > 0 && (
              <div style={{ marginBottom: "8px" }}>
                {dated.length > 0 && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", marginBottom: "8px", textTransform: "uppercase" }}>Unscheduled</div>}
                {undatedDisplay.map((todo) => (
                  <TodoCard key={todo.id} todo={todo} taskCreated={taskCreated[todo.id]} isEditing={editingId === todo.id}
                    onEdit={() => setEditingId(todo.id)} onCancelEdit={() => setEditingId(null)} onSaveEdit={handleSaveEdit}
                    onComplete={handleComplete} onDelete={handleDelete} onCreateTask={handleCreateTask}
                    draggable={true} isDragging={dragId === todo.id} isDragOver={dragOverId === todo.id}
                    onDragStart={(e) => handleDragStart(e, todo.id)} onDragOver={(e) => handleDragOver(e, todo.id)}
                    onDrop={(e) => handleDrop(e, todo.id)} onDragEnd={handleDragEnd} />
                ))}
              </div>
            )}

            {activeTodos.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.2)", fontSize: "14px" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>✓</div>
                Nothing on the list. Add a to-do to get started.
              </div>
            )}

            {completedTodos.length > 0 && (
              <div style={{ marginTop: "24px", borderTop: "1px solid #1A1A2E", paddingTop: "16px" }}>
                <button onClick={() => setShowCompleted((v) => !v)} style={{ display: "flex", alignItems: "center", gap: "6px", background: "transparent", border: "none", color: "rgba(255,255,255,0.35)", fontSize: "12px", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", padding: "0 0 12px" }}>
                  <span style={{ transform: showCompleted ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▶</span>
                  Completed ({completedTodos.length})
                </button>
                {showCompleted && completedTodos.map((todo) => (
                  <TodoCard key={todo.id} todo={todo} taskCreated={taskCreated[todo.id]} isEditing={false}
                    onEdit={() => {}} onCancelEdit={() => {}} onSaveEdit={handleSaveEdit}
                    onComplete={handleComplete} onUncomplete={handleUncomplete} onDelete={handleDelete}
                    onCreateTask={handleCreateTask} draggable={false} isCompleted />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface TodoCardProps {
  todo: Todo;
  taskCreated?: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, title: string, description: string, dueDate: string) => void;
  onComplete: (todo: Todo) => void;
  onUncomplete?: (todo: Todo) => void;
  onDelete: (id: string) => void;
  onCreateTask: (todo: Todo) => void;
  draggable?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  isCompleted?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

function TodoCard({
  todo, taskCreated, isEditing, onEdit, onCancelEdit, onSaveEdit,
  onComplete, onUncomplete, onDelete, onCreateTask,
  draggable = false, isDragging = false, isDragOver = false, isCompleted = false,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: TodoCardProps) {
  const [hovered, setHovered] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [editDesc, setEditDesc] = useState(todo.description ?? "");
  const [editDue, setEditDue] = useState(todo.dueDate ?? "");
  const [editSaving, setEditSaving] = useState(false);

  // Reset edit state when entering edit mode
  const handleEditClick = () => {
    setEditTitle(todo.title);
    setEditDesc(todo.description ?? "");
    setEditDue(todo.dueDate ?? "");
    onEdit();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    setEditSaving(true);
    await onSaveEdit(todo.id, editTitle, editDesc, editDue);
    setEditSaving(false);
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid #3A3A4E", borderRadius: "6px",
    padding: "7px 10px", color: "#fff", fontSize: "13px", outline: "none", width: "100%", boxSizing: "border-box",
  };

  if (isEditing) {
    return (
      <div style={{ background: "#1A1A2E", border: `1px solid rgba(245, 194, 0,0.35)`, borderRadius: "8px", padding: "14px", marginBottom: "6px" }}>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" required style={{ ...inputStyle, fontSize: "14px", fontWeight: 500 }} />
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description (optional)" rows={2}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>Due date:</label>
            <input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #3A3A4E", borderRadius: "6px", padding: "5px 8px", color: "#fff", fontSize: "12px", outline: "none", colorScheme: "dark" }} />
            {editDue && (
              <button type="button" onClick={() => setEditDue("")}
                style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", background: "transparent", border: "none", cursor: "pointer" }}>
                ✕ Clear
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
            <button type="submit" disabled={editSaving || !editTitle.trim()}
              style={{ padding: "6px 16px", background: GOLD, border: "none", borderRadius: "6px", color: "#000", fontWeight: 700, fontSize: "12px", cursor: "pointer", opacity: editSaving ? 0.7 : 1 }}>
              {editSaving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={onCancelEdit}
              style={{ padding: "6px 12px", background: "transparent", border: "1px solid #2A2A3E", borderRadius: "6px", color: "rgba(255,255,255,0.4)", fontSize: "12px", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: isDragOver ? "rgba(245, 194, 0,0.06)" : "#1A1A2E",
        border: `1px solid ${isDragOver ? "rgba(245, 194, 0,0.3)" : "#2A2A3E"}`,
        borderRadius: "8px", padding: "11px 14px", marginBottom: "6px",
        display: "flex", alignItems: "center", gap: "10px",
        opacity: isDragging ? 0.4 : isCompleted ? 0.55 : 1,
        cursor: draggable ? (isDragging ? "grabbing" : "grab") : "default",
        transition: "opacity 0.15s, border-color 0.15s",
        userSelect: "none", // prevent text selection interfering with drag
      }}
    >
      {/* Drag handle */}
      {draggable && (
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "13px", flexShrink: 0, lineHeight: 1, letterSpacing: "-1px" }}>
          ⋮⋮
        </div>
      )}

      {/* Complete checkbox */}
      <button
        draggable={false}
        onClick={(e) => { e.stopPropagation(); isCompleted ? onUncomplete?.(todo) : onComplete(todo); }}
        style={{ width: "18px", height: "18px", borderRadius: "50%", border: isCompleted ? "2px solid #22c55e" : "2px solid rgba(255,255,255,0.25)", background: isCompleted ? "#22c55e" : "transparent", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", transition: "all 0.15s" }}>
        {isCompleted ? "✓" : ""}
      </button>

      {/* Title + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14px", fontWeight: 500, color: isCompleted ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.9)", textDecoration: isCompleted ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {todo.title}
        </div>
        {todo.description && (
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.38)", lineHeight: 1.4, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {todo.description}
          </div>
        )}
        {/* Action buttons — only show when hovered and NOT dragging */}
        {!isCompleted && hovered && !isDragging && (
          <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
            <button draggable={false} onClick={(e) => { e.stopPropagation(); handleEditClick(); }}
              style={{ fontSize: "11px", padding: "2px 8px", background: "rgba(245, 194, 0,0.1)", border: "1px solid rgba(245, 194, 0,0.25)", borderRadius: "5px", color: GOLD, cursor: "pointer" }}>
              ✏️ Edit
            </button>
            {taskCreated ? (
              <span style={{ fontSize: "11px", color: "#22c55e", padding: "2px 8px", background: "rgba(34,197,94,0.12)", borderRadius: "5px" }}>→ Task ✓</span>
            ) : (
              <button draggable={false} onClick={(e) => { e.stopPropagation(); onCreateTask(todo); }}
                style={{ fontSize: "11px", padding: "2px 8px", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: "5px", color: "#93c5fd", cursor: "pointer" }}>
                + Create Task
              </button>
            )}
          </div>
        )}
      </div>

      {/* Due date — right side */}
      {todo.dueDate && (
        <span style={{
          flexShrink: 0, padding: "3px 9px", borderRadius: "12px", fontSize: "11px", fontWeight: 600,
          background: dueDateColor(todo.dueDate).bg, color: dueDateColor(todo.dueDate).text,
          letterSpacing: "0.02em", whiteSpace: "nowrap",
        }}>
          📅 {formatDueDate(todo.dueDate)}
        </span>
      )}

      {/* Delete */}
      <button draggable={false} onClick={(e) => { e.stopPropagation(); onDelete(todo.id); }}
        style={{ opacity: hovered && !isDragging ? 0.55 : 0, transition: "opacity 0.15s", background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "13px", padding: "2px 4px", flexShrink: 0 }}>
        ✕
      </button>
    </div>
  );
}
