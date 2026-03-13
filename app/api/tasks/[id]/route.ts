import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readTasks, writeTasks, saveFiles, ATTACHMENTS_DIR, Attachment, Comment } from "../route";
import { execSync } from "child_process";

// Route comment notifications to the right Discord channel based on assignedModel
const MODEL_CHANNEL_MAP: Record<string, string> = {
  "anthropic/claude-sonnet-4-6": "1476729693481996340", // #development → axeldev
  "openai/gpt-5.2":              "1476718379124654130", // #general → axelgeneral
  "openai/gpt-5.4":              "1476718379124654130", // #general → axelgeneral
  "openai/gpt-4o":               "1476718379124654130", // #chat4o → axelchat4o
  "google/gemini-2.5-flash":     "1476729745851940874", // #marketing → axelmarketing
  "google/gemini-2.0-flash-lite":"1476718379124654130", // #general → axelgeneral
  "deepseek/deepseek-chat":      "1476729693481996340", // #development → axeldev
};

function getNotifyChannel(assignedModel?: string): string {
  if (!assignedModel) return "1476729693481996340"; // default → #development
  return MODEL_CHANNEL_MAP[assignedModel] ?? "1476729693481996340";
}

function sendDiscord(channelId: string, msg: string) {
  try {
    const script = path.join(process.cwd(), '..', '..', '.openclaw', 'workspace', 'notify-discord.js');
    execSync(`node "${script}" "${channelId}" ${JSON.stringify(msg)}`, { timeout: 5000 });
  } catch {
    // fallback: inline
    try {
      const cfgPath = 'C:\\Users\\kevin\\.openclaw\\openclaw.json';
      const inlineScript = `
        const https=require('https'),fs=require('fs');
        const cfg=JSON.parse(fs.readFileSync(${JSON.stringify(cfgPath)},'utf8'));
        const token=cfg.channels.discord.token;
        const data=JSON.stringify({content:${JSON.stringify(msg)}});
        const r=https.request({hostname:'discord.com',path:'/api/v10/channels/${channelId}/messages',method:'POST',headers:{'Authorization':'Bot '+token,'Content-Type':'application/json','Content-Length':data.length}},()=>{});
        r.on('error',()=>{});r.write(data);r.end();
      `;
      execSync(`node -e "${inlineScript.replace(/\n/g,' ')}"`, { timeout: 5000 });
    } catch { /* non-critical */ }
  }
}

// Kevin's DM channel with Axel bot
const KEVIN_DM_CHANNEL = '1475663353589399769';

function notifyComment(taskTitle: string, taskId: string, author: string, text: string, assignedModel?: string) {
  try {
    const channelId = getNotifyChannel(assignedModel);
    const preview = text.length > 120 ? text.substring(0, 120) + "..." : text;
    const msg = `💬 **Comment on "${taskTitle}"** by ${author}\n${preview}\nTask: \`${taskId}\``;
    sendDiscord(channelId, msg);
  } catch { /* non-critical */ }
}

function notifyStatusChange(taskTitle: string, taskId: string, newStatus: string, summary?: string, assignedModel?: string) {
  try {
    let msg = '';
    if (newStatus === 'review') {
      msg = `✅ **Task ready for review:** "${taskTitle}"\n`;
      if (summary) msg += `> ${summary.slice(0, 200)}\n`;
      msg += `→ Approve or return it in Bat Cave: http://localhost:3000/tasks`;
    } else if (newStatus === 'in-progress') {
      msg = `🔧 **Started work on:** "${taskTitle}"\nTask: \`${taskId}\``;
    } else if (newStatus === 'completed') {
      msg = `🎉 **Task completed:** "${taskTitle}"`;
    }
    if (msg) {
      // Always notify Kevin's DM channel
      sendDiscord(KEVIN_DM_CHANNEL, msg);
      // Also notify the agent's channel
      const agentChannelId = getNotifyChannel(assignedModel);
      if (agentChannelId !== KEVIN_DM_CHANNEL) {
        sendDiscord(agentChannelId, msg);
      }
    }
  } catch { /* non-critical */ }
}

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

    // Handle adding a comment
    if (body.action === "comment") {
      const comment: Comment = {
        id: `comment-${now}-${Math.random().toString(36).slice(2, 7)}`,
        author: body.author,
        text: body.text,
        createdAt: now,
      };
      const existing = tasks[idx].comments ?? [];
      tasks[idx] = {
        ...tasks[idx],
        updatedAt: now,
        comments: [...existing, comment],
      };
      // Notify the right agent channel based on task's assignedModel
      notifyComment(tasks[idx].title, id, body.author || "kevin", body.text, tasks[idx].assignedModel);
    } else {
      // Build optional comment if provided alongside a status change
      let newComments = tasks[idx].comments;
      if (body.comment && body.comment.text) {
        const comment: Comment = {
          id: `comment-${now}-${Math.random().toString(36).slice(2, 7)}`,
          author: body.comment.author,
          text: body.comment.text,
          createdAt: now,
        };
        newComments = [...(newComments ?? []), comment];
      }

      const { comment: _comment, ...rest } = body;
      const prevStatus = tasks[idx].status;
      tasks[idx] = {
        ...tasks[idx],
        ...rest,
        id,
        updatedAt: now,
        completedAt: body.status === "completed" ? now : tasks[idx].completedAt,
        reviewedAt: body.status === "review" ? now : tasks[idx].reviewedAt,
        comments: newComments,
      };

      // Proactively notify Kevin when task status changes
      if (body.status && body.status !== prevStatus) {
        notifyStatusChange(
          tasks[idx].title,
          id,
          body.status,
          body.reviewSummary ?? body.summary,
          tasks[idx].assignedModel
        );
      }
    }
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
