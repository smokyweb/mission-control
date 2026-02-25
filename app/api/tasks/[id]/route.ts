import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readTasks, writeTasks, saveFiles, ATTACHMENTS_DIR, Attachment } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const contentType = req.headers.get("content-type") ?? "";
  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    const newAttachments: Attachment[] = files.length > 0 ? await saveFiles(id, files) : [];
    const existing = tasks[idx].attachments ?? [];
    tasks[idx] = {
      ...tasks[idx],
      updatedAt: now,
      attachments: [...existing, ...newAttachments],
    };
  } else {
    const body = await req.json();
    tasks[idx] = {
      ...tasks[idx],
      ...body,
      id,
      updatedAt: now,
      completedAt: body.status === "completed" ? now : tasks[idx].completedAt,
      reviewedAt: body.status === "review" ? now : tasks[idx].reviewedAt,
    };
  }

  writeTasks(tasks);
  return NextResponse.json(tasks[idx]);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const url = new URL(req.url);
  const attId = url.searchParams.get("attId");

  const tasks = readTasks();

  if (attId) {
    // Delete a single attachment
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const att = tasks[idx].attachments?.find((a) => a.id === attId);
    if (att) {
      const filePath = path.join(ATTACHMENTS_DIR, id, att.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      tasks[idx].attachments = tasks[idx].attachments?.filter((a) => a.id !== attId);
      tasks[idx].updatedAt = Date.now();
      writeTasks(tasks);
    }
    return NextResponse.json({ ok: true });
  }

  // Delete whole task + its attachments folder
  const taskDir = path.join(ATTACHMENTS_DIR, id);
  if (fs.existsSync(taskDir)) fs.rmSync(taskDir, { recursive: true, force: true });
  writeTasks(tasks.filter((t) => t.id !== id));
  return NextResponse.json({ ok: true });
}
