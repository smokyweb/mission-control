import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const TODOS_FILE = path.join(os.homedir(), ".openclaw", "workspace", "todos.json");

export interface Todo {
  id: string;
  title: string;
  description?: string;
  dueDate?: string; // "YYYY-MM-DD" or undefined
  completed: boolean;
  completedAt?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export function readTodos(): Todo[] {
  try {
    if (!fs.existsSync(TODOS_FILE)) return [];
    let raw = fs.readFileSync(TODOS_FILE, "utf-8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function writeTodos(todos: Todo[]) {
  fs.mkdirSync(path.dirname(TODOS_FILE), { recursive: true });
  fs.writeFileSync(TODOS_FILE, JSON.stringify(todos, null, 2));
}

export function sortTodos(todos: Todo[]): Todo[] {
  const active = todos.filter((t) => !t.completed);
  const completed = todos.filter((t) => t.completed);

  const dated = active
    .filter((t) => t.dueDate)
    .sort((a, b) => {
      if (a.dueDate! < b.dueDate!) return -1;
      if (a.dueDate! > b.dueDate!) return 1;
      return a.order - b.order;
    });

  const undated = active
    .filter((t) => !t.dueDate)
    .sort((a, b) => a.order - b.order);

  const completedSorted = completed.sort((a, b) => {
    const ca = a.completedAt ?? "";
    const cb = b.completedAt ?? "";
    return cb.localeCompare(ca);
  });

  return [...dated, ...undated, ...completedSorted];
}

export async function GET() {
  const todos = readTodos();
  return NextResponse.json(sortTodos(todos));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const todos = readTodos();
  const now = Date.now();
  const DEDUP_WINDOW_MS = 10_000; // ignore duplicates created within 10 seconds

  const maxOrder = todos.reduce((m, t) => Math.max(m, t.order), -1);

  const createTodo = (item: Partial<Todo>, idx: number): Todo | null => {
    const title = (item.title ?? "Untitled").trim();
    const dueDate = item.dueDate;

    // Dedup: reject if same title+dueDate was created within the last 10 seconds
    const isDuplicate = todos.some(
      (t) =>
        !t.completed &&
        t.title.trim().toLowerCase() === title.toLowerCase() &&
        (t.dueDate ?? "") === (dueDate ?? "") &&
        now - t.createdAt < DEDUP_WINDOW_MS
    );
    if (isDuplicate) return null;

    const id = `todo-${now}-${Math.random().toString(36).slice(2, 7)}`;
    return {
      id,
      title,
      ...(item.description ? { description: item.description } : {}),
      ...(dueDate ? { dueDate } : {}),
      completed: false,
      order: maxOrder + 1 + idx,
      createdAt: now,
      updatedAt: now,
    };
  };

  let created: Todo[];
  if (Array.isArray(body)) {
    created = body.map((item, idx) => createTodo(item, idx)).filter((t): t is Todo => t !== null);
  } else {
    const todo = createTodo(body, 0);
    created = todo ? [todo] : [];
  }

  if (created.length === 0) {
    // All were duplicates — return 200 with existing match
    const existing = todos.find(
      (t) => !t.completed && t.title.trim().toLowerCase() === (body.title ?? "").trim().toLowerCase()
    );
    return NextResponse.json(existing ?? { ok: true, deduplicated: true }, { status: 200 });
  }

  todos.push(...created);
  writeTodos(todos);

  return NextResponse.json(created.length === 1 ? created[0] : created, { status: 201 });
}
