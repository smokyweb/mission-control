/**
 * Agent Routing — maps agents to channels, handles Sonnet round-robin + queue
 */
import fs from "fs";
import path from "path";

// ── Agent → Discord channel ID ──────────────────────────────────────────────
export const AGENT_CHANNEL_MAP: Record<string, string> = {
  main:           "1489389552144617543", // #verticalize
  axeldev:        "1476729693481996340", // #development
  axelbatman:     "1486090672049229835", // #batman-system
  axelsonnet2:    "1481355553434243164", // #sonnet2
  axelsonnet3:    "1482072224780386346", // #sonnet3
  axelsonnet4:    "1482072237975666728", // #sonnet4
  axelsonnet5:    "1482072281998950613", // #sonnet5
  axelsonnet6:    "1482072297186660574", // #sonnet6
  axelopus:       "1482075061211893881", // #axelopus
  axelgeneral:    "1476718379124654130", // #general
  axelgpt54:      "1482069479461617787", // #axelgpt54
  axelchatgpt542: "1483545609293140018", // #axelchatgpt54-2
  axelchatpro:    "1480888154230751303", // #chatpro
  axelchat4o:     "1481639406493503549", // #chat4o
  axeltesting:    "1481635299867234409", // #testing
  axelinbox:      "1476729777229533204", // #inbox
  axelmarketing:  "1476729745851940874", // #marketing
  axelmonitoring: "1476729823111155782", // #monitoring
  axelbriefing:   "1476729863149977772", // #briefing
  axeloranges:    "1481270977399750768", // #orangestoapples
};

// ── Model → default single agent (for non-pooled models) ───────────────────
// NOTE: axelgeneral (#general) is NEVER a task-routing target — conversation only
const MODEL_DEFAULT_AGENT: Record<string, string> = {
  "anthropic/claude-opus-4-6":   "axelopus",
  "openai/gpt-5.4":              "axelgpt54",   // routes to #axelgpt54, NOT #general
  "openai/gpt-5.4-pro":          "axelchatpro",
  "openai/gpt-4o":               "axelchat4o",
  "deepseek/deepseek-chat":      "axelinbox",
  "google/gemini-2.5-flash":     "axelmarketing",
  "google/gemini-2.0-flash-lite":"axelgpt54",   // also routes to #axelgpt54
};

export function isSonnetModel(model?: string) {
  return model === "anthropic/claude-sonnet-4-6";
}

// ── Project-specific forced routing ────────────────────────────────────────
// Tasks whose title matches these keywords ALWAYS go to the specified agent,
// regardless of model or round-robin. Kevin's explicit requirement.
export const PROJECT_FORCE_ROUTING: Array<{ pattern: RegExp; agent: string }> = [
  { pattern: /zoompay|zoom.pay|myzoompay/i, agent: "axeldev" },
  { pattern: /verticalize/i, agent: "main" }, // All Verticalize tasks → #verticalize channel
];

// ── Sonnet pool (round-robin) ───────────────────────────────────────────────
// axeldev is intentionally NOT in the pool — it only receives explicitly assigned tasks
export const SONNET_POOL = [
  "axelsonnet2", "axelsonnet3",
  "axelsonnet4", "axelsonnet5", "axelsonnet6",
];

const ROUTING_STATE_FILE = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".openclaw", "workspace", "task-routing.json"
);

interface RoutingState {
  sonnetRoundRobinIndex: number;
  queue: string[]; // task IDs waiting for a free Sonnet agent
}

function readState(): RoutingState {
  try {
    const raw = fs.readFileSync(ROUTING_STATE_FILE, "utf8");
    return JSON.parse(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw);
  } catch {
    return { sonnetRoundRobinIndex: 0, queue: [] };
  }
}

function writeState(state: RoutingState) {
  fs.writeFileSync(ROUTING_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

const AGENTS_DIR = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".openclaw", "agents"
);

/** Read an agent's sessions file and return the most recent activity timestamp (ms) */
function agentLastActive(agentId: string): number {
  try {
    const file = path.join(AGENTS_DIR, agentId, "sessions", "sessions.json");
    const raw = fs.readFileSync(file, "utf8");
    const sessions: Record<string, { updatedAt?: number }> = JSON.parse(
      raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
    );
    let latest = 0;
    for (const s of Object.values(sessions)) {
      const ms = s.updatedAt ? (s.updatedAt > 1e12 ? s.updatedAt : s.updatedAt * 1000) : 0;
      if (ms > latest) latest = ms;
    }
    return latest;
  } catch { return 0; }
}

const BUSY_WINDOW_MS = 10 * 60 * 1000; // active within last 10 min = busy

/** Returns true if the agent has had session activity in the last 10 minutes */
export function isAgentBusy(agentId: string): boolean {
  const last = agentLastActive(agentId);
  return last > 0 && Date.now() - last < BUSY_WINDOW_MS;
}

/**
 * Pick the next available Sonnet agent (round-robin, skip busy ones).
 * Returns null if all are busy → caller should queue the task.
 * Optionally skip a specific agent (e.g. the one already assigned).
 */
export function pickSonnetAgent(skipAgent?: string): string | null {
  const state = readState();
  const start = state.sonnetRoundRobinIndex % SONNET_POOL.length;

  for (let i = 0; i < SONNET_POOL.length; i++) {
    const idx = (start + i) % SONNET_POOL.length;
    const agent = SONNET_POOL[idx];
    if (agent === skipAgent) continue;
    if (!isAgentBusy(agent)) {
      state.sonnetRoundRobinIndex = (idx + 1) % SONNET_POOL.length;
      writeState(state);
      return agent;
    }
  }
  return null;
}

/**
 * Find an available agent from the same model pool as the given agent.
 * Used when the primary assignedAgent is busy — pick a free pool peer.
 */
export function findPoolPeer(assignedAgent: string): string | null {
  if (SONNET_POOL.includes(assignedAgent)) {
    return pickSonnetAgent(assignedAgent); // any free Sonnet agent except the current one
  }
  return null; // single-agent models have no pool peers
}

/** Add a task ID to the Sonnet queue */
export function enqueueSonnetTask(taskId: string) {
  const state = readState();
  if (!state.queue.includes(taskId)) {
    state.queue.push(taskId);
    writeState(state);
  }
}

/** Dequeue and assign any queued tasks to newly-free Sonnet agents */
export function flushSonnetQueue(): Array<{ taskId: string; agentId: string }> {
  const state = readState();
  if (state.queue.length === 0) return [];

  const assigned: Array<{ taskId: string; agentId: string }> = [];
  const remaining: string[] = [];

  for (const taskId of state.queue) {
    const agent = pickSonnetAgent();
    if (agent) {
      assigned.push({ taskId, agentId: agent });
    } else {
      remaining.push(taskId); // still no free agent
    }
  }

  state.queue = remaining;
  writeState(state);
  return assigned;
}

/**
 * Resolve which agent to assign a new task to based on its model.
 * For Sonnet: round-robin. For others: use default agent.
 * Project-specific force routing always wins (e.g. ZoomPay → axeldev).
 * Returns { agentId, queued } — if queued=true the task needs to be enqueued.
 */
export function resolveAgent(model: string, title?: string): { agentId: string | null; queued: boolean } {
  // Project-force routing takes priority over everything
  if (title) {
    for (const rule of PROJECT_FORCE_ROUTING) {
      if (rule.pattern.test(title)) {
        return { agentId: rule.agent, queued: false };
      }
    }
  }
  if (model === "anthropic/claude-sonnet-4-6") {
    const agent = pickSonnetAgent();
    if (agent) return { agentId: agent, queued: false };
    return { agentId: null, queued: true };
  }
  const agentId = MODEL_DEFAULT_AGENT[model] ?? null;
  return { agentId, queued: false };
}

/** Get the Discord channel ID for a task, by agent or model fallback.
 *  Returns null if no clear routing exists — callers must skip sending rather than defaulting to #development.
 *  #development only receives notifications for tasks explicitly assigned to axeldev.
 */
export function getTaskChannel(assignedAgent?: string, assignedModel?: string): string | null {
  // Explicit agent assignment — use their channel directly
  if (assignedAgent && AGENT_CHANNEL_MAP[assignedAgent]) {
    return AGENT_CHANNEL_MAP[assignedAgent];
  }
  // Sonnet pool: pick a free agent (never falls back to #development)
  if (isSonnetModel(assignedModel)) {
    const free = pickSonnetAgent();
    if (free) return AGENT_CHANNEL_MAP[free] ?? null;
    return null; // all busy, skip notification
  }
  // Non-pool models: use model default agent
  if (assignedModel) {
    const fallbackAgent = MODEL_DEFAULT_AGENT[assignedModel];
    if (fallbackAgent) return AGENT_CHANNEL_MAP[fallbackAgent] ?? null;
  }
  // No clear routing — return null so caller skips the notification
  // #development must NEVER receive fallback notifications
  return null;
}

/**
 * Resolve the best available agent for routing a comment/notification.
 *
 * Rules:
 * 1. Task already has an assignedAgent → ALWAYS keep that same agent, no exceptions, no reassignment
 * 2. No assigned agent yet → pick one based on model
 */
export function resolveRoutingAgent(
  assignedAgent?: string,
  assignedModel?: string,
  taskStatus?: string,
): string | undefined {
  // Always stay with the assigned agent — one task, one agent, forever
  if (assignedAgent) return assignedAgent;

  // No agent yet — pick one based on model
  if (isSonnetModel(assignedModel)) {
    return pickSonnetAgent() ?? undefined;
  }
  return MODEL_DEFAULT_AGENT[assignedModel ?? ""] ?? undefined;
}
