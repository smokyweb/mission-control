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

export interface Comment {
  id: string;
  author: "kevin" | "axel";
  text: string;
  createdAt: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in-progress" | "completed" | "review";
  difficulty?: "easy" | "medium" | "difficult";
  assignedTo?: "kevin" | "brenthomer";
  assignedModel?: "google/gemini-2.0-flash-lite" | "deepseek/deepseek-chat" | "openai/gpt-5.4" | "openai/gpt-5.4-pro" | "anthropic/claude-sonnet-4-6" | "openai/gpt-4o";
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  reviewedAt?: number;
  reviewSummary?: string;
  reviewQuestions?: string;
  attachments?: Attachment[];
  comments?: Comment[];
}

export function readTasks(): Task[] {
  try {
    if (!fs.existsSync(TASKS_FILE)) return [];
    let raw = fs.readFileSync(TASKS_FILE, "utf-8");
    // Strip UTF-8 BOM if present (written by PowerShell Set-Content)
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function writeTasks(tasks: Task[]) {
  fs.mkdirSync(path.dirname(TASKS_FILE), { recursive: true });
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  // Sync task context to all agent workspaces so every agent stays aware
  try {
    const { execSync } = require('child_process');
    execSync('node "C:\\Users\\kevin\\.openclaw\\workspace\\sync-tasks-to-agents.js"', { timeout: 5000 });
  } catch { /* non-critical — agents will catch up on next read */ }
}

// Notify #development channel when a new task is created
function notifyDevelopment(task: Task) {
  try {
    const { execSync } = require('child_process');
    const difficulty = task.difficulty || 'unset';
    const model = task.assignedModel ? task.assignedModel.split('/').pop() : 'default';
    const msg = `📋 **New task added to Bat Cave**\\n**${task.title}**\\nDifficulty: ${difficulty} | Model: ${model}\\nID: \`${task.id}\`${task.description ? `\\n\\n${task.description.substring(0, 200)}` : ''}`;
    execSync(`node "C:\\Users\\kevin\\.openclaw\\workspace\\notify-development.js" "${msg.replace(/"/g, '\\"')}"`, { timeout: 5000 });
  } catch (e) { /* non-critical */ }
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
  let difficulty: "easy" | "medium" | "difficult" | undefined;
  let assignedTo: "kevin" | "brenthomer" | undefined;
  let assignedModel: "google/gemini-2.0-flash-lite" | "deepseek/deepseek-chat" | "openai/gpt-5.4" | "openai/gpt-5.4-pro" | "anthropic/claude-sonnet-4-6" | "openai/gpt-4o" | undefined;
  let attachments: Attachment[] = [];

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    title = (form.get("title") as string) ?? "";
    description = (form.get("description") as string) || undefined;
    difficulty = (form.get("difficulty") as any) || undefined;
    assignedTo = (form.get("assignedTo") as any) || undefined;
    assignedModel = (form.get("assignedModel") as any) || undefined;
    const files = form.getAll("files") as File[];
    if (files.length > 0) attachments = await saveFiles(taskId, files);
  } else {
    const body = await req.json();
    title = body.title;
    description = body.description;
    difficulty = body.difficulty;
    assignedTo = body.assignedTo;
    assignedModel = body.assignedModel;
  }

  const tasks = readTasks();
  const task: Task = {
    id: taskId, title, description, status: "open",
    ...(difficulty ? { difficulty } : {}),
    ...(assignedTo ? { assignedTo } : {}),
    ...(assignedModel ? { assignedModel } : {}),
    createdAt: now, updatedAt: now,
    ...(attachments.length > 0 ? { attachments } : {}),
  };
  tasks.unshift(task);
  writeTasks(tasks);
  notifyDevelopment(task); // fire-and-forget — alert #development
  return NextResponse.json(task, { status: 201 });
}
