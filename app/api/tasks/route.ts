import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const TASKS_FILE = path.join(os.homedir(), ".openclaw", "workspace", "tasks.json");
export const ATTACHMENTS_DIR = path.join(os.homedir(), ".openclaw", "workspace", "task-attachments");

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  filename: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in-progress" | "completed" | "review";
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  reviewedAt?: number;
  reviewSummary?: string;
  reviewQuestions?: string;
  attachments?: Attachment[];
}

export function readTasks(): Task[] {
  try {
    if (!fs.existsSync(TASKS_FILE)) return [];
    return JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function writeTasks(tasks: Task[]) {
  fs.mkdirSync(path.dirname(TASKS_FILE), { recursive: true });
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

export async function saveFiles(taskId: string, files: File[]): Promise<Attachment[]> {
  const dir = path.join(ATTACHMENTS_DIR, taskId);
  fs.mkdirSync(dir, { recursive: true });
  const attachments: Attachment[] = [];
  for (const file of files) {
    const attId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const ext = path.extname(file.name) || "";
    const filename = `${attId}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(dir, filename), buffer);
    attachments.push({ id: attId, name: file.name, type: file.type, size: file.size, filename });
  }
  return attachments;
}

export async function GET() {
  return NextResponse.json(readTasks());
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const now = Date.now();
  const taskId = `task-${now}-${Math.random().toString(36).slice(2, 7)}`;

  let title = "";
  let description: string | undefined;
  let attachments: Attachment[] = [];

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    title = (form.get("title") as string) ?? "";
    description = (form.get("description") as string) || undefined;
    const files = form.getAll("files") as File[];
    if (files.length > 0) attachments = await saveFiles(taskId, files);
  } else {
    const body = await req.json();
    title = body.title;
    description = body.description;
  }

  const tasks = readTasks();
  const task: Task = {
    id: taskId, title, description, status: "open",
    createdAt: now, updatedAt: now,
    ...(attachments.length > 0 ? { attachments } : {}),
  };
  tasks.unshift(task);
  writeTasks(tasks);
  return NextResponse.json(task, { status: 201 });
}
