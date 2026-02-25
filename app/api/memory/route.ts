import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const WORKSPACE = path.join(process.env.USERPROFILE || "C:\\Users\\kevin", ".openclaw", "workspace");
const MEMORY_FILE = path.join(WORKSPACE, "MEMORY.md");
const MEMORY_DIR = path.join(WORKSPACE, "memory");

interface MemoryFile {
  filename: string;
  content: string;
  lastModified: string;
}

export async function GET() {
  const files: MemoryFile[] = [];

  // Read MEMORY.md
  if (fs.existsSync(MEMORY_FILE)) {
    const stat = fs.statSync(MEMORY_FILE);
    const content = fs.readFileSync(MEMORY_FILE, "utf-8");
    files.push({
      filename: "MEMORY.md",
      content,
      lastModified: stat.mtime.toISOString(),
    });
  }

  // Read memory/*.md
  if (fs.existsSync(MEMORY_DIR)) {
    const entries = fs.readdirSync(MEMORY_DIR);
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const filePath = path.join(MEMORY_DIR, entry);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;
        const content = fs.readFileSync(filePath, "utf-8");
        files.push({
          filename: `memory/${entry}`,
          content,
          lastModified: stat.mtime.toISOString(),
        });
      } catch {
        // Skip unreadable files
      }
    }
  }

  return NextResponse.json({ ok: true, files });
}
