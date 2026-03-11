import { NextRequest, NextResponse } from "next/server";
import { readTodos, writeTodos } from "../route";

export async function POST(req: NextRequest) {
  const body: { id: string; order: number }[] = await req.json();
  const todos = readTodos();

  for (const { id, order } of body) {
    const idx = todos.findIndex((t) => t.id === id);
    if (idx !== -1) {
      todos[idx].order = order;
      todos[idx].updatedAt = Date.now();
    }
  }

  writeTodos(todos);
  return NextResponse.json({ ok: true });
}
