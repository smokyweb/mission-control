import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const WORKSPACE = path.join(process.env.USERPROFILE || "C:\\Users\\kevin", ".openclaw", "workspace");
const CONTENT_FILE = path.join(WORKSPACE, "content-pipeline.json");
const UPLOADS_DIR = path.join(WORKSPACE, "uploads");

interface ContentThumbnail {
  filename: string;
  originalName: string;
}

interface ContentItem {
  id: string;
  title: string;
  type: "Video" | "Blog" | "Post";
  description: string;
  script: string;
  stage: "idea" | "scripting" | "thumbnail" | "filming" | "published";
  createdAt: string;
  updatedAt: string;
  thumbnail: ContentThumbnail | null;
}

function ensureDirs() {
  if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function readContent(): ContentItem[] {
  ensureDirs();
  if (!fs.existsSync(CONTENT_FILE)) return [];
  try {
    const data = fs.readFileSync(CONTENT_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeContent(items: ContentItem[]) {
  ensureDirs();
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(items, null, 2), "utf-8");
}

export async function GET() {
  const items = readContent();
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const title = formData.get("title") as string;
    const type = (formData.get("type") as ContentItem["type"]) || "Video";
    const description = (formData.get("description") as string) || "";
    const script = (formData.get("script") as string) || "";
    const stage = (formData.get("stage") as ContentItem["stage"]) || "idea";

    if (!title) {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }

    let thumbnail: ContentThumbnail | null = null;
    const file = formData.get("thumbnail");
    if (file instanceof File && file.size > 0) {
      const ext = path.extname(file.name);
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      ensureDirs();
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
      thumbnail = { filename, originalName: file.name };
    }

    const now = new Date().toISOString();
    const item: ContentItem = {
      id: `content-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      type,
      description,
      script,
      stage,
      createdAt: now,
      updatedAt: now,
      thumbnail,
    };

    const items = readContent();
    items.push(item);
    writeContent(items);

    return NextResponse.json({ ok: true, item });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const formData = await req.formData();
    const id = formData.get("id") as string;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Content ID is required" }, { status: 400 });
    }

    const items = readContent();
    const idx = items.findIndex((item) => item.id === id);
    if (idx === -1) {
      return NextResponse.json({ ok: false, error: "Content not found" }, { status: 404 });
    }

    const title = formData.get("title") as string | null;
    const type = formData.get("type") as ContentItem["type"] | null;
    const description = formData.get("description") as string | null;
    const script = formData.get("script") as string | null;
    const stage = formData.get("stage") as ContentItem["stage"] | null;

    if (title !== null) items[idx].title = title;
    if (type !== null) items[idx].type = type;
    if (description !== null) items[idx].description = description;
    if (script !== null) items[idx].script = script;
    if (stage !== null) items[idx].stage = stage;
    items[idx].updatedAt = new Date().toISOString();

    const file = formData.get("thumbnail");
    if (file instanceof File && file.size > 0) {
      const ext = path.extname(file.name);
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      ensureDirs();
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
      items[idx].thumbnail = { filename, originalName: file.name };
    }

    writeContent(items);
    return NextResponse.json({ ok: true, item: items[idx] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ ok: false, error: "Content ID is required" }, { status: 400 });
    }

    const items = readContent();
    const filtered = items.filter((item) => item.id !== id);
    if (filtered.length === items.length) {
      return NextResponse.json({ ok: false, error: "Content not found" }, { status: 404 });
    }
    writeContent(filtered);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
