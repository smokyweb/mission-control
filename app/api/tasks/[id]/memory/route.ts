import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const MEMORY_DIR = path.join(os.homedir(), ".openclaw", "workspace", "task-memory");

function memoryPath(taskId: string) {
  return path.join(MEMORY_DIR, `${taskId}.md`);
}

type Ctx = { params: Promise<{ id: string }> };

// GET — read task memory
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const file = memoryPath(id);
  if (!fs.existsSync(file)) return NextResponse.json({ content: null });
  const content = fs.readFileSync(file, "utf8");
  return NextResponse.json({ content });
}

// POST — append a timestamped entry (agent handoff notes)
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { author, entry } = await req.json();
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  const file = memoryPath(id);
  const ts = new Date().toISOString().replace("T", " ").slice(0, 16);
  const block = `\n## [${ts}] ${author}\n${entry.trim()}\n`;
  fs.appendFileSync(file, block, "utf8");
  return NextResponse.json({ ok: true });
}

// PUT — overwrite entire memory file
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { content } = await req.json();
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.writeFileSync(memoryPath(id), content, "utf8");
  return NextResponse.json({ ok: true });
}
