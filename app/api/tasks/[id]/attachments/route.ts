import { NextRequest, NextResponse } from "next/server";
import { readTasks, writeTasks, saveFiles } from "../../route";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const form = await req.formData();
  const files = form.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  // Accept all file types — max 50MB each (enforced in saveFiles)
  const newAttachments = await saveFiles(id, files);
  const existing = tasks[idx].attachments ?? [];
  tasks[idx] = {
    ...tasks[idx],
    updatedAt: Date.now(),
    attachments: [...existing, ...newAttachments],
  };

  writeTasks(tasks);
  return NextResponse.json({ attachments: tasks[idx].attachments }, { status: 201 });
}
