/**
 * POST /api/tasks/{id}/pickup
 * Called by an agent to claim a task from a busy pool peer.
 * Only allowed if the requesting agent is in the same model pool.
 * Returns the task memory so the agent can read context before starting.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { readTasks, writeTasks } from "../../route";
import { SONNET_POOL, AGENT_CHANNEL_MAP, getTaskChannel } from "../../agent-routing";

const MEMORY_DIR = path.join(os.homedir(), ".openclaw", "workspace", "task-memory");

function readMemory(taskId: string): string | null {
  const file = path.join(MEMORY_DIR, `${taskId}.md`);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

function appendMemory(taskId: string, author: string, entry: string) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  const file = path.join(MEMORY_DIR, `${taskId}.md`);
  const ts = new Date().toISOString().replace("T", " ").slice(0, 16);
  fs.appendFileSync(file, `\n## [${ts}] ${author}\n${entry.trim()}\n`, "utf8");
}

function samePool(agentA?: string, agentB?: string): boolean {
  if (!agentA || !agentB) return false;
  return SONNET_POOL.includes(agentA) && SONNET_POOL.includes(agentB);
}

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { requestingAgent } = await req.json();

  if (!requestingAgent) {
    return NextResponse.json({ error: "requestingAgent required" }, { status: 400 });
  }

  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const task = tasks[idx];

  // Only allow pickup if requester is in the same pool as the original agent
  if (!samePool(requestingAgent, task.assignedAgent)) {
    return NextResponse.json(
      { error: `${requestingAgent} is not in the same pool as ${task.assignedAgent ?? "unassigned"}` },
      { status: 403 }
    );
  }

  const previousAgent = task.assignedAgent;
  tasks[idx] = {
    ...task,
    assignedAgent: requestingAgent,
    updatedAt: Date.now(),
  };
  writeTasks(tasks);

  // Write handoff note to task memory
  appendMemory(
    id,
    "system",
    `**Task picked up by ${requestingAgent}** (previously assigned to ${previousAgent ?? "unassigned"}).\nRead above context before continuing.`
  );

  const memory = readMemory(id);

  return NextResponse.json({
    ok: true,
    task: tasks[idx],
    memory, // agent reads this to get up to speed
    previousAgent,
  });
}
