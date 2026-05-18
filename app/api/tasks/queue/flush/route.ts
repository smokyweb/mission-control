import { NextResponse } from "next/server";
import { readTasks, writeTasks } from "../../route";
import { flushSonnetQueue, getTaskChannel } from "../../agent-routing";

export async function GET() {
  const assigned = flushSonnetQueue();
  if (assigned.length === 0) return NextResponse.json({ assigned: [] });

  // Update each task with its new assignedAgent
  const tasks = readTasks();
  for (const { taskId, agentId } of assigned) {
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      tasks[idx].assignedAgent = agentId;
      tasks[idx].queued = false;
      tasks[idx].updatedAt = Date.now();
    }
  }
  writeTasks(tasks);

  return NextResponse.json({ assigned });
}
