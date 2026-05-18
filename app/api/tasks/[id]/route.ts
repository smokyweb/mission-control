import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readTasks, writeTasks, saveFiles, ATTACHMENTS_DIR, Attachment, Comment } from "../route";
import { getTaskChannel, resolveRoutingAgent } from "../agent-routing";
import { execSync, spawn } from "child_process";

/** Fire-and-forget shell command — never blocks the response */
function fireAndForget(cmd: string, args: string[]) {
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore', shell: false });
    child.unref();
  } catch { /* non-critical */ }
}

function sendDiscord(channelId: string | null, msg: string) {
  if (!channelId) return;
  try {
    const script = path.join(process.cwd(), '..', '..', '.openclaw', 'workspace', 'notify-discord.js');
    fireAndForget('node', [script, channelId, msg]);
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

/**
 * Route a comment to the best available agent channel.
 * Always finds a free agent — skips busy ones.
 * Updates task.assignedAgent if rerouted. Returns resolved agent ID.
 */
function routeComment(
  tasks: ReturnType<typeof readTasks>,
  taskIdx: number,
  taskTitle: string,
  taskId: string,
  author: string,
  text: string,
): string | undefined {
  const prev = tasks[taskIdx].assignedAgent;
  const assignedModel = tasks[taskIdx].assignedModel;
  const taskStatus = tasks[taskIdx].status;

  // Resolve agent: stay with assigned if active; reassign if done and agent is busy
  const resolvedAgent = resolveRoutingAgent(prev, assignedModel, taskStatus);

  // Persist reassignment + write handoff note if agent changed
  if (resolvedAgent && resolvedAgent !== prev) {
    tasks[taskIdx].assignedAgent = resolvedAgent;
    tasks[taskIdx].updatedAt = Date.now();
    try {
      const memoryDir = "C:\\Users\\kevin\\.openclaw\\workspace\\task-memory";
      fs.mkdirSync(memoryDir, { recursive: true });
      const ts = new Date().toISOString().replace("T", " ").slice(0, 16);
      fs.appendFileSync(
        path.join(memoryDir, `${taskId}.md`),
        `\n## [${ts}] system\n**Routed to ${resolvedAgent}** (${prev ?? "unassigned"} was busy).\nKevin commented — read context above before starting.\n`,
        "utf8"
      );
    } catch { /* non-critical */ }
  }

  const channelId = getTaskChannel(resolvedAgent, assignedModel);
  if (channelId) { // only send if there's a clear channel — never fall back to #development
    const preview = text.length > 300 ? text.substring(0, 300) + "..." : text;
    const agentLabel = resolvedAgent ? ` → **${resolvedAgent}**` : "";
    const msg = `💬 **Comment on "${taskTitle}"**${agentLabel} by ${author}\n\n**Comment:** ${preview}\n\n**Task ID:** \`${taskId}\`\n**Full task:** http://localhost:3000/api/tasks/${taskId}\n\n⚡ **Action required:** Read the full task, reply to this comment in the Bat Cave, and act on it now.`;
    try { sendDiscord(channelId, msg); } catch { /* non-critical */ }
  }
  return resolvedAgent;
}

function notifyStatusChange(taskTitle: string, taskId: string, newStatus: string, summary?: string, assignedAgent?: string, assignedModel?: string) {
  try {
    let msg = '';
    const agentLabel = assignedAgent ? ` [${assignedAgent}]` : "";
    if (newStatus === 'review') {
      msg = `✅ **Task ready for review:**${agentLabel} "${taskTitle}"\n`;
      if (summary) msg += `> ${summary.slice(0, 200)}\n`;
      msg += `→ Approve or return it in Bat Cave: http://localhost:3000/tasks`;
    } else if (newStatus === 'in-progress') {
      msg = `🔧 **Started:**${agentLabel} "${taskTitle}"\nTask: \`${taskId}\``;
    } else if (newStatus === 'completed') {
      msg = `🎉 **Completed:**${agentLabel} "${taskTitle}"`;
    }
    if (msg) {
      // Send only to the agent's channel — not Kevin's DM too (avoids duplicate messages)
      const agentChannelId = getTaskChannel(assignedAgent, assignedModel);
      if (agentChannelId) {
        sendDiscord(agentChannelId, msg);
      } else {
        // Only fall back to Kevin's DM if there's no agent channel
        sendDiscord(KEVIN_DM_CHANNEL, msg);
      }
    }
  } catch { /* non-critical */ }
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const contentType = req.headers.get("content-type") ?? "";
  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const action = form.get("action") as string | null;
    const files = form.getAll("files") as File[];

    if (action === "comment") {
      // Comment with optional file attachments
      const text = (form.get("text") as string) ?? "";
      const author = (form.get("author") as string) ?? "kevin";
      const commentId = `comment-${now}-${Math.random().toString(36).slice(2, 7)}`;
      const commentAttachments = files.length > 0
        ? await (await import("../route")).saveCommentFiles(commentId, files)
        : [];

      const comment = {
        id: commentId,
        author,
        text,
        createdAt: now,
        ...(commentAttachments.length > 0 ? { attachments: commentAttachments } : {}),
      };
      const existingComments = tasks[idx].comments ?? [];
      tasks[idx] = {
        ...tasks[idx],
        updatedAt: now,
        comments: [...existingComments, comment],
      };
      // Route comment notification
      const resolvedAgent = routeComment(tasks, idx, tasks[idx].title, id, author, text);
      if (resolvedAgent && resolvedAgent !== author) {
        tasks[idx].assignedAgent = resolvedAgent;
      }
      if ((author === "kevin" || !author) && resolvedAgent) {
        const wakeScript2 = "C:\\Users\\kevin\\.openclaw\\workspace\\wake-agent.js";
        fireAndForget('node', [wakeScript2, resolvedAgent, id, text || '']);
        const taskTitle3 = tasks[idx].title || "task";
        const prompt2 = `New comment from Kevin on task ${id} ("${taskTitle3.slice(0,60)}"): ${(text || "").slice(0,300)}\n\nRead the full task at http://localhost:3000/api/tasks/${id} and respond to Kevin's comment. Post your reply as a task comment.`;
        fireAndForget('openclaw', ['agent', '--agent', resolvedAgent, '--message', prompt2, '--timeout', '120']);
      }
    } else {
      // Default multipart: add files to task attachments
      const newAttachments: Attachment[] = files.length > 0 ? await saveFiles(id, files) : [];
      const existing = tasks[idx].attachments ?? [];
      tasks[idx] = {
        ...tasks[idx],
        updatedAt: now,
        attachments: [...existing, ...newAttachments],
      };
    }
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
      // Route to free agent channel (may reassign if current agent is busy)
      const prevAgent = tasks[idx].assignedAgent;
      const resolvedAgent = routeComment(tasks, idx, tasks[idx].title, id, body.author || "kevin", body.text);
      // Persist any reassignment that routeComment made
      if (resolvedAgent && resolvedAgent !== comment.author) {
        tasks[idx].assignedAgent = resolvedAgent;
      }
      // If agent changed, add a system comment noting the new channel assignment
      if (resolvedAgent && resolvedAgent !== prevAgent) {
        const AGENT_CHANNEL_NAMES: Record<string, string> = {
          axeldev:"#development",axelgeneral:"#general",axelinbox:"#inbox",axelmarketing:"#marketing",
          axelmonitoring:"#monitoring",axelbriefing:"#briefing",axeloranges:"#orangestoapples",
          axelsonnet2:"#sonnet2",axelsonnet3:"#sonnet3",axelsonnet4:"#sonnet4",
          axelsonnet5:"#sonnet5",axelsonnet6:"#sonnet6",axelopus:"#axelopus",
          axelgpt54:"#axelgpt54",axelchat4o:"#chat4o",axelchatpro:"#chatpro",
          axeloutreach:"#outreach","axeloutreach-jared":"#outreach-jared",
        };
        const label = AGENT_CHANNEL_NAMES[resolvedAgent] ? `${AGENT_CHANNEL_NAMES[resolvedAgent]} (${resolvedAgent})` : resolvedAgent;
        const reassignComment = {
          id: `comment-${now}-reassign`,
          author: "system",
          text: `🤖 Reassigned to **${label}**`,
          createdAt: now + 1,
        };
        tasks[idx].comments = [...(tasks[idx].comments ?? []), reassignComment];
      }
      // If Kevin is commenting, triple-notify the agent immediately
      if ((body.author === "kevin" || !body.author) && resolvedAgent) {
        // Auto-post "Got it" to the agent's channel so Kevin sees immediate ack
        try {
          const channelScript = "C:\\Users\\kevin\\.openclaw\\workspace\\notify-discord.js";
          const taskTitle = tasks[idx].title || "task";
          const channelId = (() => {
            const CHAN: Record<string,string> = {
              axeldev:"1476729693481996340",axelgeneral:"1476718379124654130",axelinbox:"1476729777229533204",
              axelmarketing:"1476729745851940874",axelmonitoring:"1476729823111155782",axelbriefing:"1476729863149977772",
              axeloranges:"1481270977399750768",axelsonnet2:"1481355553434243164",axelsonnet3:"1482072224780386346",
              axelsonnet4:"1482072237975666728",axelsonnet5:"1482072281998950613",axelsonnet6:"1482072297186660574",
              axelopus:"1482075061211893881",axelgpt54:"1482069479461617787",axelchat4o:"1481639406493503549",
              axelchatpro:"1480888154230751303",axeloutreach:"1494447493818089493",
            };
            return CHAN[resolvedAgent] || null;
          })();
          if (channelId) {
            const gotIt = `✅ Got it — **${resolvedAgent}** picked up Kevin's comment on _${taskTitle.slice(0,60)}_`;
            fireAndForget('node', [channelScript, channelId, gotIt]);
          }
        } catch { /* non-critical */ }
        // Wake via file + discord (non-blocking)
        const wakeScript = "C:\\Users\\kevin\\.openclaw\\workspace\\wake-agent.js";
        fireAndForget('node', [wakeScript, resolvedAgent, id, body.text || '']);
        // Direct openclaw agent trigger — non-blocking
        const taskTitle2 = tasks[idx].title || "task";
        const prompt = `New comment from Kevin on task ${id} ("${taskTitle2.slice(0,60)}"): ${(body.text || "").slice(0,300)}\n\nRead the full task at http://localhost:3000/api/tasks/${id} and respond to Kevin's comment. Post your reply as a task comment.`;
        fireAndForget('openclaw', ['agent', '--agent', resolvedAgent, '--message', prompt, '--timeout', '120']);
      }
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
      // Never allow assignedAgent to be wiped by a partial PATCH — preserve existing value
      const existingAgent = tasks[idx].assignedAgent;
      if (!rest.assignedAgent) delete rest.assignedAgent;
      const prevStatus = tasks[idx].status;
      tasks[idx] = {
        ...tasks[idx],
        ...rest,
        id,
        updatedAt: now,
        completedAt: body.status === "completed" ? now : tasks[idx].completedAt,
        reviewedAt: body.status === "review" ? now : tasks[idx].reviewedAt,
        comments: newComments,
        // Always preserve existing assignedAgent unless explicitly replaced with a valid value
        assignedAgent: rest.assignedAgent || existingAgent,
      };

      // Proactively notify Kevin when task status changes
      if (body.status && body.status !== prevStatus) {
        notifyStatusChange(
          tasks[idx].title,
          id,
          body.status,
          body.reviewSummary ?? body.summary,
          tasks[idx].assignedAgent,
          tasks[idx].assignedModel
        );
      }

      // Auto-wake agent immediately when assignedAgent is set or changed
      const newAgent = tasks[idx].assignedAgent;
      if (newAgent && newAgent !== existingAgent) {
        // Add system comment showing new channel assignment
        const AGENT_NAMES: Record<string,string> = {
          axeldev:"#development",axelgeneral:"#general",axelinbox:"#inbox",axelmarketing:"#marketing",
          axelmonitoring:"#monitoring",axelbriefing:"#briefing",axeloranges:"#orangestoapples",
          axelsonnet2:"#sonnet2",axelsonnet3:"#sonnet3",axelsonnet4:"#sonnet4",
          axelsonnet5:"#sonnet5",axelsonnet6:"#sonnet6",axelopus:"#axelopus",
          axelgpt54:"#axelgpt54",axelchat4o:"#chat4o",axelchatpro:"#chatpro",
          axeloutreach:"#outreach","axeloutreach-jared":"#outreach-jared",
        };
        const lbl = AGENT_NAMES[newAgent] ? `${AGENT_NAMES[newAgent]} (${newAgent})` : newAgent;
        const assignComment = {
          id: `comment-${Date.now()}-assign`,
          author: "system",
          text: `🤖 Assigned to **${lbl}**`,
          createdAt: Date.now(),
        };
        tasks[idx].comments = [...(tasks[idx].comments ?? []), assignComment];
        writeTasks(tasks); // flush before agent wake so agent sees the comment
        // Both fire-and-forget — never block the response
        const wakeScript = path.join(process.cwd(), '..', '..', '.openclaw', 'workspace', 'wake-agent.js');
        fireAndForget('node', [wakeScript, newAgent, id]);
        const taskTitleAssign = tasks[idx].title || "task";
        const promptAssign = `You have been assigned a task: ${id} ("${taskTitleAssign.slice(0,80)}"). Read the full task at http://localhost:3000/api/tasks/${id} — review the description and any comments, then start working on it. Post a comment when you begin.`;
        fireAndForget('openclaw', ['agent', '--agent', newAgent, '--message', promptAssign, '--timeout', '120']);
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
