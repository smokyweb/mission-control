import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ATTACHMENTS_DIR, PUBLIC_TASKS_DIR, readTasks, writeTasks } from "../../../route";

type Ctx = { params: Promise<{ id: string; filename: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id, filename } = await params;

  // Prevent path traversal
  const safeFilename = path.basename(filename);

  // Verify attachment belongs to this task
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const att = task.attachments?.find((a) => a.filename === safeFilename);
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Try public dir first, then legacy dir
  const publicPath = path.join(PUBLIC_TASKS_DIR, id, safeFilename);
  const legacyPath = path.join(ATTACHMENTS_DIR, id, safeFilename);
  const filePath = fs.existsSync(publicPath) ? publicPath : legacyPath;

  if (!fs.existsSync(filePath)) return NextResponse.json({ error: "File missing" }, { status: 404 });

  const buffer = fs.readFileSync(filePath);
  const mimeType = att.mimeType || att.type || "application/octet-stream";
  const originalName = att.originalName || att.name || safeFilename;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${originalName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, filename } = await params;
  const safeFilename = path.basename(filename);

  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const att = tasks[idx].attachments?.find((a) => a.filename === safeFilename);
  if (att) {
    // Remove from both possible locations
    const publicPath = path.join(PUBLIC_TASKS_DIR, id, safeFilename);
    const legacyPath = path.join(ATTACHMENTS_DIR, id, safeFilename);
    if (fs.existsSync(publicPath)) fs.unlinkSync(publicPath);
    if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);

    tasks[idx].attachments = tasks[idx].attachments?.filter((a) => a.filename !== safeFilename);
    tasks[idx].updatedAt = Date.now();
    writeTasks(tasks);
  }

  return NextResponse.json({ ok: true });
}
