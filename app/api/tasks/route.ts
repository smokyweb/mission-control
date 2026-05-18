import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { resolveAgent, getTaskChannel, enqueueSonnetTask } from "./agent-routing";

const TASKS_FILE = path.join(os.homedir(), ".openclaw", "workspace", "tasks.json");
// Legacy dir kept for backward-compat reads; new uploads go to public/uploads
export const ATTACHMENTS_DIR = path.join(os.homedir(), ".openclaw", "workspace", "task-attachments");
export const COMMENT_ATTACHMENTS_DIR = path.join(os.homedir(), ".openclaw", "workspace", "comment-attachments");
// New public dirs (statically served by Next.js)
export const PUBLIC_TASKS_DIR = path.join(process.cwd(), "public", "uploads", "tasks");
export const PUBLIC_COMMENTS_DIR = path.join(process.cwd(), "public", "uploads", "comments");

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
  url: string;
  // legacy compat
  name?: string;
  type?: string;
}

export interface CommentAttachment {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
  url: string;
  // legacy compat
  name?: string;
  type?: string;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  attachments?: CommentAttachment[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in-progress" | "completed" | "review";
  difficulty?: "easy" | "medium" | "difficult";
  assignedTo?: "kevin" | "brenthomer";
  assignedModel?: string;
  assignedAgent?: string; // specific agent instance (e.g. axelsonnet3)
  queued?: boolean;       // true = waiting for a free agent
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
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function writeTasks(tasks: Task[]) {
  fs.mkdirSync(path.dirname(TASKS_FILE), { recursive: true });
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  try {
    const { execSync } = require("child_process");
    execSync('node "C:\\Users\\kevin\\.openclaw\\workspace\\sync-tasks-to-agents.js"', { timeout: 5000 });
  } catch { /* non-critical */ }
}

function sendDiscord(channelId: string, msg: string) {
  try {
    const { execSync } = require("child_process");
    const script = path.join("C:\\Users\\kevin\\.openclaw\\workspace\\notify-discord.js");
    execSync(`node "${script}" "${channelId}" ${JSON.stringify(msg)}`, { timeout: 5000 });
  } catch {
    try {
      const { execSync } = require("child_process");
      const cfgPath = "C:\\Users\\kevin\\.openclaw\\openclaw.json";
      const inlineScript = `
        const https=require('https'),fs=require('fs');
        const cfg=JSON.parse(fs.readFileSync(${JSON.stringify(cfgPath)},'utf8'));
        const token=cfg.channels.discord.token;
        const data=JSON.stringify({content:${JSON.stringify(msg)}});
        const r=https.request({hostname:'discord.com',path:'/api/v10/channels/${channelId}/messages',method:'POST',headers:{'Authorization':'Bot '+token,'Content-Type':'application/json','Content-Length':data.length}},()=>{});
        r.on('error',()=>{});r.write(data);r.end();
      `;
      execSync(`node -e "${inlineScript.replace(/\n/g, " ")}"`, { timeout: 5000 });
    } catch { /* non-critical */ }
  }
}

// Agent → human-readable channel name
const AGENT_CHANNEL_NAMES: Record<string, string> = {
  axeldev:           "#development",
  axelgeneral:       "#general",
  axelinbox:         "#inbox",
  axelmarketing:     "#marketing",
  axelmonitoring:    "#monitoring",
  axelbriefing:      "#briefing",
  axeloranges:       "#orangestoapples",
  axelsonnet2:       "#sonnet2",
  axelsonnet3:       "#sonnet3",
  axelsonnet4:       "#sonnet4",
  axelsonnet5:       "#sonnet5",
  axelsonnet6:       "#sonnet6",
  axelopus:          "#axelopus",
  axelgpt54:         "#axelgpt54",
  axelchat4o:        "#chat4o",
  axelchatpro:       "#chatpro",
  axeltesting:       "#testing",
  axelbatman:        "#batman-system",
  axeloutreach:      "#outreach",
  "axeloutreach-jared": "#outreach-jared",
};

function channelLabel(agentId?: string, model?: string): string {
  if (agentId && AGENT_CHANNEL_NAMES[agentId]) return `${AGENT_CHANNEL_NAMES[agentId]} (${agentId})`;
  if (agentId) return agentId;
  if (model) return model.split("/").pop() || model;
  return "unassigned";
}

/** Notify the agent's channel about a new task */
function notifyNewTask(task: Task) {
  const channelId = getTaskChannel(task.assignedAgent, task.assignedModel);
  if (!channelId) return; // no clear routing — skip rather than spam #development
  const model = task.assignedModel ? task.assignedModel.split("/").pop() : "default";
  const agent = task.assignedAgent ? ` → **${task.assignedAgent}**` : "";
  const queuedNote = task.queued ? " *(queued — all Sonnet agents busy)*" : "";
  const msg = `📋 **New task**${agent}${queuedNote}\n**${task.title}**\nModel: ${model} | ID: \`${task.id}\`${task.description ? `\n\n${task.description.substring(0, 200)}` : ""}\n\nStart working on this task now. Read the full details at http://localhost:3000/api/tasks/${task.id}`;
  sendDiscord(channelId, msg);

  // Auto-post "Got it" acknowledgment immediately so Kevin knows it was received
  const gotItMsg = `✅ Got it — **${task.assignedAgent || "agent"}** is on it: _${task.title}_`;
  sendDiscord(channelId, gotItMsg);
}

export async function saveFiles(taskId: string, files: File[]): Promise<Attachment[]> {
  const dir = path.join(PUBLIC_TASKS_DIR, taskId);
  fs.mkdirSync(dir, { recursive: true });
  const attachments: Attachment[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) continue; // skip oversized files silently
    const attId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const ext = path.extname(file.name) || "";
    const filename = `${attId}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(dir, filename), buffer);
    const url = `/uploads/tasks/${taskId}/${filename}`;
    attachments.push({
      id: attId,
      filename,
      originalName: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      uploadedAt: Date.now(),
      url,
      // legacy compat
      name: file.name,
      type: file.type,
    });
  }
  return attachments;
}

export async function saveCommentFiles(commentId: string, files: File[]): Promise<CommentAttachment[]> {
  const dir = path.join(PUBLIC_COMMENTS_DIR, commentId);
  fs.mkdirSync(dir, { recursive: true });
  const attachments: CommentAttachment[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) continue;
    const attId = `catt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const ext = path.extname(file.name) || "";
    const filename = `${attId}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(dir, filename), buffer);
    const url = `/uploads/comments/${commentId}/${filename}`;
    attachments.push({
      id: attId,
      filename,
      originalName: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      uploadedAt: Date.now(),
      url,
      // legacy compat
      name: file.name,
      type: file.type,
    });
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
  let difficulty: string | undefined;
  let assignedTo: "kevin" | "brenthomer" | undefined;
  let assignedModel: string | undefined;
  let attachments: Attachment[] = [];
  let explicitAgent: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    title = (form.get("title") as string) ?? "";
    description = (form.get("description") as string) || undefined;
    difficulty = (form.get("difficulty") as string) || undefined;
    assignedTo = (form.get("assignedTo") as any) || undefined;
    assignedModel = (form.get("assignedModel") as string) || undefined;
    explicitAgent = (form.get("assignedAgent") as string) || undefined;
    const files = form.getAll("files") as File[];
    if (files.length > 0) attachments = await saveFiles(taskId, files);
  } else {
    const body = await req.json();
    title = body.title;
    description = body.description;
    difficulty = body.difficulty;
    assignedTo = body.assignedTo;
    assignedModel = body.assignedModel;
    explicitAgent = body.assignedAgent;
  }

  // ── Agent routing ──────────────────────────────────────────────────────────
  let assignedAgent: string | undefined;
  let queued = false;

  if (explicitAgent) {
    // Caller explicitly specified an agent — honour it, skip round-robin
    assignedAgent = explicitAgent;
  } else if (assignedModel) {
    const routing = resolveAgent(assignedModel, title);
    if (routing.queued) {
      queued = true;
    } else if (routing.agentId) {
      assignedAgent = routing.agentId;
    }
  }

  const tasks = readTasks();
  const task: Task = {
    id: taskId,
    title,
    status: "open",
    ...(description ? { description } : {}),
    ...(difficulty ? { difficulty: difficulty as any } : {}),
    ...(assignedTo ? { assignedTo } : {}),
    ...(assignedModel ? { assignedModel } : {}),
    ...(assignedAgent ? { assignedAgent } : {}),
    ...(queued ? { queued: true } : {}),
    createdAt: now,
    updatedAt: now,
    ...(attachments.length > 0 ? { attachments } : {}),
  };

  // Add system comment showing channel assignment
  const assignmentLabel = channelLabel(assignedAgent, assignedModel);
  const systemComment = {
    id: `comment-${now}-system`,
    author: "system",
    text: `🤖 Assigned to **${assignmentLabel}**`,
    createdAt: now,
  };
  task.comments = [systemComment];

  tasks.unshift(task);
  writeTasks(tasks);

  // Queue the task if all Sonnet agents are busy
  if (queued) enqueueSonnetTask(taskId);

  notifyNewTask(task);

  // Auto-wake the assigned agent immediately — fire and forget (non-blocking)
  if (assignedAgent) {
    try {
      const { spawn } = require("child_process");
      const wakeScript = "C:\\Users\\kevin\\.openclaw\\workspace\\wake-agent.js";
      const child = spawn("node", [wakeScript, assignedAgent, taskId], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
    } catch { /* non-critical */ }
  }

  return NextResponse.json(task, { status: 201 });
}
