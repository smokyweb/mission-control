import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const AGENTS_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw', 'agents');

// Full roster of all defined channel agents
const AGENT_ROSTER = [
  { id: 'axeldev',        name: 'AxelDev',        emoji: '💻',  channel: '#development',     model: 'claude-sonnet-4-6' },
  { id: 'axelsonnet2',    name: 'AxelSonnet2',    emoji: '🔵',  channel: '#sonnet2',         model: 'claude-sonnet-4-6' },
  { id: 'axelsonnet3',    name: 'AxelSonnet3',    emoji: '🔵',  channel: '#sonnet3',         model: 'claude-sonnet-4-6' },
  { id: 'axelsonnet4',    name: 'AxelSonnet4',    emoji: '🔵',  channel: '#sonnet4',         model: 'claude-sonnet-4-6' },
  { id: 'axelsonnet5',    name: 'AxelSonnet5',    emoji: '🔵',  channel: '#sonnet5',         model: 'claude-sonnet-4-6' },
  { id: 'axelsonnet6',    name: 'AxelSonnet6',    emoji: '🔵',  channel: '#sonnet6',         model: 'claude-sonnet-4-6' },
  { id: 'axelopus',       name: 'AxelOpus',       emoji: '🧠',  channel: '#axelopus',        model: 'claude-opus-4-6'   },
  { id: 'axelgeneral',    name: 'AxelGeneral',    emoji: '⭐',  channel: '#general',         model: 'gpt-5.4'           },
  { id: 'axelgpt54',      name: 'AxelGPT54',      emoji: '⚡',  channel: '#axelgpt54',       model: 'gpt-5.4'           },
  { id: 'axelchatpro',    name: 'AxelChatPro',    emoji: '🔥',  channel: '#chatpro',         model: 'gpt-5.4-pro'       },
  { id: 'axelchat4o',     name: 'AxelChat4o',     emoji: '🤖',  channel: '#testing',         model: 'gpt-4o'            },
  { id: 'axeltesting',    name: 'AxelTesting',    emoji: '🧪',  channel: '#testing',         model: 'gpt-4o'            },
  { id: 'axelinbox',      name: 'AxelInbox',      emoji: '📬',  channel: '#inbox',           model: 'deepseek-chat'     },
  { id: 'axelmarketing',  name: 'AxelMarketing',  emoji: '📢',  channel: '#marketing',       model: 'gemini-2.5-flash'  },
  { id: 'axelmonitoring', name: 'AxelMonitoring', emoji: '📊',  channel: '#monitoring',      model: 'gemini-2.5-flash'  },
  { id: 'axelbriefing',   name: 'AxelBriefing',   emoji: '📋',  channel: '#briefing',        model: 'gemini-2.5-flash'  },
  { id: 'axeloranges',    name: 'AxelOranges',    emoji: '🍊',  channel: '#orangestoapples', model: 'claude-sonnet-4-6' },
];

const KNOWN_AGENT_IDS = new Set(AGENT_ROSTER.map((a) => a.id));

// Read an agent's sessions.json from disk
function readAgentSessions(agentId: string): Record<string, { updatedAt?: number; [k: string]: unknown }> {
  try {
    const file = path.join(AGENTS_DIR, agentId, 'sessions', 'sessions.json');
    const raw = fs.readFileSync(file, 'utf8');
    const bom = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
    return JSON.parse(bom);
  } catch {
    return {};
  }
}

// Read main agent's sessions for spawned sub-agents
function readMainSessions(): Record<string, { updatedAt?: number; label?: string; model?: string; [k: string]: unknown }> {
  try {
    const file = path.join(AGENTS_DIR, 'main', 'sessions', 'sessions.json');
    const raw = fs.readFileSync(file, 'utf8');
    const bom = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
    return JSON.parse(bom);
  } catch {
    return {};
  }
}

function toMs(ts?: number): number {
  if (!ts) return 0;
  return ts > 1e12 ? ts : ts * 1000;
}

function formatKey(key: string): string {
  // agent:axeloranges:discord:channel:... → axeloranges
  const m = key.match(/^agent:([^:]+):/);
  return m ? m[1] : key;
}

export async function GET() {
  const now = Date.now();
  const ACTIVE_WINDOW = 10 * 60 * 1000;   // 5 min = "active"
  const RECENT_WINDOW = 30 * 60 * 1000;  // 30 min = show in sub-agents

  // ── Channel agent roster + live overlay ──────────────────────────────────
  const agents = AGENT_ROSTER.map((agent) => {
    const sessions = readAgentSessions(agent.id);
    // Find the most-recently-updated session
    let latestMs = 0;
    let latestKey = '';
    for (const [key, sess] of Object.entries(sessions)) {
      const ms = toMs(sess.updatedAt);
      if (ms > latestMs) { latestMs = ms; latestKey = key; }
    }
    const active = latestMs > 0 && now - latestMs < ACTIVE_WINDOW;
    return {
      id: agent.id,
      name: agent.name,
      emoji: agent.emoji,
      channel: agent.channel,
      model: agent.model,
      active,
      lastMessage: null as string | null,
      sessionKey: latestKey || null,
      updatedAt: latestMs || null,
    };
  });

  // Active first, then alphabetical
  agents.sort((a, b) => {
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    return a.name.localeCompare(b.name);
  });

  // ── Spawned sub-agents from main session ──────────────────────────────────
  const mainSessions = readMainSessions();
  const subagents: Array<{
    key: string; label: string; model: string | null;
    active: boolean; lastMessage: string | null; updatedAt: number | null;
  }> = [];

  for (const [key, sess] of Object.entries(mainSessions)) {
    // Skip main session itself and channel agent sessions
    if (key.startsWith('agent:main:main') || key === 'main') continue;
    const agentId = formatKey(key);
    if (KNOWN_AGENT_IDS.has(agentId)) continue; // channel agents shown above

    const ms = toMs(sess.updatedAt);
    if (ms === 0 || now - ms > RECENT_WINDOW) continue;

    const active = now - ms < ACTIVE_WINDOW;
    subagents.push({
      key,
      label: (sess.label as string | undefined) ?? agentId ?? key,
      model: (sess.model as string | undefined) ?? null,
      active,
      lastMessage: null,
      updatedAt: ms,
    });
  }

  subagents.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  return NextResponse.json({ agents, subagents });
}
