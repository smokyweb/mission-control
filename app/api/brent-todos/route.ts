import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const BRENT_TODOS_FILE = path.join(os.homedir(), ".openclaw", "workspace", "brent-todos.json");

interface BrentTodo {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: number;
  updatedAt: number;
}

function readTodos(): BrentTodo[] {
  try {
    if (!fs.existsSync(BRENT_TODOS_FILE)) return [];
    const raw = fs.readFileSync(BRENT_TODOS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeTodos(todos: BrentTodo[]) {
  fs.mkdirSync(path.dirname(BRENT_TODOS_FILE), { recursive: true });
  fs.writeFileSync(BRENT_TODOS_FILE, JSON.stringify(todos, null, 2));
}

export async function GET() {
  const todos = readTodos();
  return NextResponse.json(todos);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const todos = readTodos();
  const newTodo: BrentTodo = {
    id: `brent-todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: body.title || "Untitled",
    description: body.description || "",
    dueDate: body.dueDate || undefined,
    completed: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  todos.unshift(newTodo);
  writeTodos(todos);
  return NextResponse.json(newTodo, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const todos = readTodos();
  const idx = todos.findIndex((t) => t.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  todos[idx] = {
    ...todos[idx],
    ...(body.title !== undefined && { title: body.title }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.dueDate !== undefined && { dueDate: body.dueDate }),
    ...(body.completed !== undefined && {
      completed: body.completed,
      completedAt: body.completed ? new Date().toISOString() : undefined,
    }),
    updatedAt: Date.now(),
  };
  writeTodos(todos);
  return NextResponse.json(todos[idx]);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const todos = readTodos().filter((t) => t.id !== id);
  writeTodos(todos);
  return NextResponse.json({ ok: true });
}
