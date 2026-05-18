"use client";

import { useState, useEffect, useCallback } from 'react';

interface Session {
  key?: string;
  label?: string;
  model?: string;
  tokenCount?: number;
  updatedAt?: number;
}

interface AgentStatus {
  id: string;
  name: string;
  emoji: string;
  channel: string;
  model: string;
  active: boolean;
  lastMessage: string | null;
  sessionKey: string | null;
  updatedAt: number | null;
}

interface SpawnedAgent {
  key: string;
  label: string;
  model: string | null;
  active: boolean;
  lastMessage: string | null;
  updatedAt: number | null;
}

const ROLES = [
  { name: "Developer",  icon: "💻", color: "bg-blue-900/30 text-blue-300 border-blue-800/50",   description: "Writes and maintains code, builds features, fixes bugs, and manages deployments." },
  { name: "Researcher", icon: "🔬", color: "bg-green-900/30 text-green-300 border-green-800/50", description: "Investigates topics, gathers information, analyzes data, and produces reports." },
  { name: "Writer",     icon: "✍️", color: "bg-purple-900/30 text-purple-300 border-purple-800/50", description: "Creates content, drafts scripts, writes documentation, and edits copy." },
  { name: "Designer",   icon: "🎨", color: "bg-orange-900/30 text-orange-300 border-orange-800/50", description: "Designs UI/UX, creates visuals, thumbnails, and brand assets." },
];

function formatLastActive(ts: number | null): string {
  if (!ts) return "";
  const ms = ts > 1e12 ? ts : ts * 1000;
  const diff = Date.now() - ms;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function TeamClient({ initialSubAgents }: { initialSubAgents: Session[] }) {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [subagents, setSubagents] = useState<SpawnedAgent[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/subagents', { cache: 'no-store' });
      const data = await res.json();
      if (data.agents) setAgents(data.agents);
      if (data.subagents !== undefined) setSubagents(data.subagents);
    } catch { /* keep stale */ }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const handleCancel = async (sessionKey: string) => {
    setCancellingId(sessionKey);
    try {
      await fetch(`/api/subagents/${encodeURIComponent(sessionKey)}`, { method: 'DELETE' });
      await fetchAgents();
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div>
      {/* Lead Agent */}
      <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl shrink-0">
            ⚙️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Axel</h2>
              <span className="text-xs bg-blue-900/50 text-blue-300 border border-blue-800/50 px-2 py-0.5 rounded-full">Lead Agent</span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Primary AI agent orchestrating all sub-agents, managing memory, scheduling tasks, and executing workflows.
            </p>
          </div>
        </div>
      </div>

      {/* Live Agent Roster */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
            Channel Agents
          </h2>
          <span className="text-xs text-gray-600">Live · refreshes every 5s</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {agents.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-4 h-[72px] animate-pulse" />
              ))
            : agents.map((agent) => {
                const isCancelling = cancellingId !== null && cancellingId === agent.sessionKey;
                return (
                  <div
                    key={agent.id}
                    className={`border rounded-xl p-4 flex items-center gap-3 transition-all ${
                      agent.active
                        ? "bg-green-950/20 border-green-800/50"
                        : "bg-[#1A1A2E] border-[#2A2A3E] hover:border-[#3A3A4E]"
                    }`}
                  >
                    {/* Emoji avatar */}
                    <div className="w-10 h-10 rounded-full bg-[#252535] flex items-center justify-center text-lg shrink-0">
                      {agent.emoji}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="text-sm font-semibold text-white">{agent.name}</span>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${agent.active ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
                        <span className="text-xs text-[#f5c200] font-mono bg-[rgba(245,194,0,0.08)] border border-[rgba(245,194,0,0.2)] px-1.5 py-0.5 rounded">
                          {agent.channel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="font-mono">{agent.model}</span>
                        {agent.updatedAt && (
                          <span className="text-gray-600">· {formatLastActive(agent.updatedAt)}</span>
                        )}
                      </div>
                      {agent.active && agent.lastMessage && (
                        <p className="text-xs text-green-400/60 mt-0.5 truncate">
                          ↳ {agent.lastMessage.slice(0, 80)}
                        </p>
                      )}
                    </div>
                    {/* Cancel — only clickable when active */}
                    <button
                      onClick={() => agent.sessionKey && handleCancel(agent.sessionKey)}
                      disabled={!agent.active || !agent.sessionKey || isCancelling}
                      className="ml-1 shrink-0 px-2 py-1 text-xs rounded border transition-colors
                        bg-red-900/30 border-red-900/40 text-red-400
                        hover:bg-red-800/50 hover:border-red-700/50
                        disabled:opacity-25 disabled:cursor-not-allowed"
                      title={agent.active ? "Stop this agent" : "Agent is idle"}
                    >
                      {isCancelling ? "Stopping…" : "Cancel"}
                    </button>
                  </div>
                );
              })}
        </div>
      </div>

      {/* Spawned Sub-agents */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
            Active Sub-agents
            {subagents.length > 0 && (
              <span className="ml-2 text-xs bg-green-900/40 text-green-400 border border-green-800/40 px-1.5 py-0.5 rounded-full">
                {subagents.filter(s => s.active).length} running
              </span>
            )}
          </h2>
          <span className="text-xs text-gray-600">Live · refreshes every 5s</span>
        </div>
        {subagents.length === 0 ? (
          <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-6 text-center">
            <p className="text-2xl mb-2">🤖</p>
            <p className="text-gray-600 text-sm">No sub-agents running</p>
            <p className="text-gray-700 text-xs mt-1">Sub-agents appear here when an agent spawns a worker to complete a task</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {subagents.map((sa) => {
              const isCancelling = cancellingId !== null && cancellingId === sa.key;
              return (
                <div
                  key={sa.key}
                  className={`border rounded-xl p-4 flex items-center gap-3 transition-all ${
                    sa.active
                      ? "bg-green-950/20 border-green-800/50"
                      : "bg-[#1A1A2E] border-[#2A2A3E]"
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-[#252535] flex items-center justify-center text-base shrink-0">
                    🤖
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-white truncate">{sa.label}</span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${sa.active ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
                      {sa.active && <span className="text-xs text-green-500">working</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {sa.model && <span className="font-mono">{sa.model.split('/').pop()}</span>}
                      {sa.updatedAt && <span className="text-gray-600">· {formatLastActive(sa.updatedAt)}</span>}
                    </div>
                    {sa.lastMessage && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">↳ {sa.lastMessage}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleCancel(sa.key)}
                    disabled={!sa.active || isCancelling}
                    className="ml-1 shrink-0 px-2 py-1 text-xs rounded border transition-colors
                      bg-red-900/30 border-red-900/40 text-red-400
                      hover:bg-red-800/50 hover:border-red-700/50
                      disabled:opacity-25 disabled:cursor-not-allowed"
                    title={sa.active ? "Stop this sub-agent" : "Sub-agent is idle"}
                  >
                    {isCancelling ? "Stopping…" : "Cancel"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task Difficulty → Model Routing */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
          Task Difficulty Routing
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { level: "Easy",      command: "/easy",      model: "gemini-2.0-flash-lite", provider: "Google",    icon: "🟢", color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)"  },
            { level: "Medium",    command: "/medium",    model: "deepseek-chat",          provider: "DeepSeek",  icon: "🟡", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)"  },
            { level: "Difficult", command: "/difficult", model: "claude-sonnet-4-6",      provider: "Anthropic", icon: "🔴", color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
          ].map(({ level, command, model, provider, icon, color, bg, border }) => (
            <div key={level} style={{ background: bg, border: `1px solid ${border}`, borderRadius: "12px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px" }}>{icon}</span>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>{level}</span>
                <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: "11px", color: "rgba(255,255,255,0.35)", background: "rgba(0,0,0,0.3)", padding: "2px 7px", borderRadius: "4px" }}>{command}</span>
              </div>
              <div style={{ color, fontFamily: "monospace", fontSize: "13px", fontWeight: 600, marginBottom: "2px" }}>{model}</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px" }}>{provider}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Roles */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">Roles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ROLES.map((role) => (
            <div key={role.name} className={`border rounded-xl p-4 ${role.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{role.icon}</span>
                <h3 className="text-sm font-semibold">{role.name}</h3>
              </div>
              <p className="text-xs opacity-80">{role.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
