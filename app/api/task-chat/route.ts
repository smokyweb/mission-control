/**
 * /api/task-chat
 * Direct LLM chat for a task — reads task context, calls model directly,
 * posts reply as a task comment, returns it to the browser.
 * No openclaw agent intermediary — instant and reliable.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import https from "https";

const TASKS_FILE = path.join(os.homedir(), ".openclaw", "workspace", "tasks.json");

function readTasks() {
  try {
    let raw = fs.readFileSync(TASKS_FILE, "utf8");
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch { return []; }
}

function writeTasks(tasks: unknown[]) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

function getAnthropicKey(): string {
  try {
    // Check openclaw.json env block first
    const cfg = JSON.parse(fs.readFileSync(
      path.join(os.homedir(), ".openclaw", "openclaw.json"), "utf8"
    ));
    if (cfg.env?.ANTHROPIC_API_KEY) return cfg.env.ANTHROPIC_API_KEY;

    // Check agent auth-profiles.json (most reliable location)
    const agentAuthPath = path.join(os.homedir(), ".openclaw", "agents", "axeldev", "agent", "auth-profiles.json");
    if (fs.existsSync(agentAuthPath)) {
      const agentAuth = JSON.parse(fs.readFileSync(agentAuthPath, "utf8"));
      const profiles = agentAuth.profiles || {};
      for (const p of Object.values(profiles) as Record<string, string>[]) {
        if ((p as Record<string,string>).provider === "anthropic" && (p as Record<string,string>).key) {
          return (p as Record<string,string>).key;
        }
      }
    }
    return "";
  } catch { return ""; }
}

function callAnthropic(apiKey: string, messages: {role: string; content: string}[], system: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system,
      messages,
    });
    const req = https.request({
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
      },
    }, (res) => {
      let d = ""; res.on("data", (c) => (d += c));
      res.on("end", () => {
        try {
          const j = JSON.parse(d);
          if (j.content?.[0]?.text) resolve(j.content[0].text);
          else reject(new Error(JSON.stringify(j).slice(0, 200)));
        } catch { reject(new Error(d.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    req.write(body); req.end();
  });
}

export async function POST(req: NextRequest) {
  try {
    const { taskId, comment } = await req.json();
    if (!taskId || !comment?.trim()) {
      return NextResponse.json({ error: "taskId and comment required" }, { status: 400 });
    }

    const tasks = readTasks();
    const taskIdx = tasks.findIndex((t: Record<string, unknown>) => t.id === taskId);
    if (taskIdx === -1) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const task = tasks[taskIdx] as Record<string, unknown>;

    const agent = (task.assignedAgent as string) || "axel";
    const apiKey = getAnthropicKey();
    if (!apiKey) {
      return NextResponse.json({ error: "No Anthropic API key configured" }, { status: 500 });
    }

    // Build context from recent comments
    const recentComments = ((task.comments as Record<string, unknown>[]) || [])
      .filter((c) => c.author !== "system")
      .slice(-10)
      .map((c) => `[${c.author}]: ${String(c.text || "").slice(0, 400)}`)
      .join("\n");

    const system = `You are ${agent}, an AI assistant working on this task for Kevin. Be concise, helpful, and direct. If Kevin asks for a status update, give one based on the task context. If he asks you to do something, say what you're going to do and do it. Keep replies under 300 words unless detail is needed. Always reply in first person as the agent working the task.`;

    const userMessage = `Task: ${task.title as string}
Description: ${String(task.description || "").slice(0, 500)}
Status: ${task.status as string}
Assigned model: ${task.assignedModel as string || "claude"}

Recent conversation:
${recentComments || "(no previous messages)"}

Kevin just said: "${comment}"

Reply to Kevin directly and helpfully.`;

    // Call model directly
    const reply = await callAnthropic(apiKey, [{ role: "user", content: userMessage }], system);

    // Post reply as a task comment
    const now = Date.now();
    const newComment = {
      id: `comment-${now}-chat`,
      author: agent,
      text: reply,
      createdAt: now,
    };
    const existing = (task.comments as unknown[]) || [];
    task.comments = [...existing, newComment];
    tasks[taskIdx] = task;
    writeTasks(tasks);

    return NextResponse.json({ success: true, agent, reply, replied: true });
  } catch (e: unknown) {
    console.error("[task-chat]", e);
    return NextResponse.json({ error: String(e), replied: false }, { status: 500 });
  }
}
