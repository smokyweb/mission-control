import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ATTACHMENTS_DIR, readTasks } from "../../../route";

type Ctx = { params: Promise<{ id: string; filename: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id, filename } = await params;

  // Verify the attachment belongs to this task (prevent path traversal)
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const att = task.attachments?.find((a) => a.filename === filename);
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filePath = path.join(ATTACHMENTS_DIR, id, filename);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: "File missing" }, { status: 404 });

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": att.type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${att.name}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
