import { NextRequest, NextResponse } from "next/server";
import { readTodos, writeTodos } from "../route";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const todos = readTodos();
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const todo = todos[idx];

  if (body.title !== undefined) todo.title = body.title;
  if (body.description !== undefined) todo.description = body.description;
  if ("dueDate" in body) todo.dueDate = body.dueDate ?? undefined;
  if (body.order !== undefined) todo.order = body.order;
  if (body.completed !== undefined) {
    todo.completed = body.completed;
    todo.completedAt = body.completed ? new Date().toISOString() : undefined;
  }
  todo.updatedAt = Date.now();

  todos[idx] = todo;
  writeTodos(todos);
  return NextResponse.json(todo);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const todos = readTodos();
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  todos.splice(idx, 1);
  writeTodos(todos);
  return NextResponse.json({ ok: true });
}
