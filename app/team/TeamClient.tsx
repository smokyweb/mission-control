"use client";

import { useState, useEffect, useCallback } from 'react';

interface Session {
  key?: string;
  label?: string;
  model?: string;
  tokenCount?: number;
  updatedAt?: number;
}

interface SubAgent {
  key?: string;
  label?: string;
  model?: string;
  updatedAt?: number;
  active?: boolean;
  lastMessage?: string | null;
}

const ROLES = [
  {
    name: "Developer",
    icon: "💻",
    color: "bg-blue-900/30 text-blue-300 border-blue-800/50",
    description: "Writes and maintains code, builds features, fixes bugs, and manages deployments.",
  },
  {
    name: "Researcher",
    icon: "🔬",
    color: "bg-green-900/30 text-green-300 border-green-800/50",
    description: "Investigates topics, gathers information, analyzes data, and produces reports.",
  },
  {
    name: "Writer",
    icon: "✍️",
    color: "bg-purple-900/30 text-purple-300 border-purple-800/50",
    description: "Creates content, drafts scripts, writes documentation, and edits copy.",
  },
  {
    name: "Designer",
    icon: "🎨",
    color: "bg-orange-900/30 text-orange-300 border-orange-800/50",
    description: "Designs UI/UX, creates visuals, thumbnails, and brand assets.",
  },
];

function getInitials(name: string): string {
  return name
    .split(/[\s:_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-600",
    "bg-purple-600",
    "bg-green-600",
    "bg-orange-600",
    "bg-pink-600",
    "bg-cyan-600",
    "bg-yellow-600",
    "bg-red-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatLastActive(ts?: number): string {
  if (!ts) return "Unknown";
  const ms = ts > 1e12 ? ts : ts * 1000;
  const diff = Date.now() - ms;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function isActive(ts?: number): boolean {
  if (!ts) return false;
  const ms = ts > 1e12 ? ts : ts * 1000;
  return Date.now() - ms < 5 * 60 * 1000;
}

export default function TeamClient({
  initialSubAgents,
}: {
  initialSubAgents: Session[];
}) {
  const [subAgents, setSubAgents] = useState<SubAgent[]>(initialSubAgents);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchSubAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/subagents', { cache: 'no-store' });
      const data = await res.json();
      setSubAgents(data.subagents ?? []);
    } catch {
      // keep stale data on error
    }
  }, []);

  useEffect(() => {
    fetchSubAgents();
    const interval = setInterval(fetchSubAgents, 5000);
    return () => clearInterval(interval);
  }, [fetchSubAgents]);

  const handleCancel = async (key: string) => {
    setCancellingId(key);
    try {
      await fetch(`/api/subagents/${encodeURIComponent(key)}`, { method: 'DELETE' });
      await fetchSubAgents();
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
              <span className="text-xs bg-blue-900/50 text-blue-300 border border-blue-800/50 px-2 py-0.5 rounded-full">
                Lead Agent
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Primary AI agent orchestrating all sub-agents, managing memory,
              scheduling tasks, and executing workflows.
            </p>
          </div>
        </div>
      </div>

      {/* Channel Agents */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
          Channel Agents
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { agent: "axeldev",       emoji: "🛠️", channel: "#development", model: "claude-sonnet-4-6", provider: "Anthropic", color: "#a78bfa", border: "rgba(139,92,246,0.3)", bg: "rgba(139,92,246,0.08)" },
            { agent: "axelgeneral",   emoji: "💬", channel: "#general",     model: "gpt-5.4",          provider: "OpenAI",    color: "#34d399", border: "rgba(52,211,153,0.3)",  bg: "rgba(52,211,153,0.08)" },
            { agent: "axelbriefing",  emoji: "📋", channel: "#briefing",    model: "gemini-2.5-flash", provider: "Google",    color: "#60a5fa", border: "rgba(96,165,250,0.3)",  bg: "rgba(96,165,250,0.08)" },
            { agent: "axelinbox",     emoji: "📥", channel: "#inbox",       model: "deepseek-chat",    provider: "DeepSeek",  color: "#a78bfa", border: "rgba(139,92,246,0.3)",  bg: "rgba(139,92,246,0.08)" },
            { agent: "axelmarketing", emoji: "📣", channel: "#marketing",   model: "gemini-2.5-flash", provider: "Google",    color: "#60a5fa", border: "rgba(96,165,250,0.3)",  bg: "rgba(96,165,250,0.08)" },
            { agent: "axelmonitoring",emoji: "🔍", channel: "#monitoring",  model: "gemini-2.5-flash", provider: "Google",    color: "#60a5fa", border: "rgba(96,165,250,0.3)",  bg: "rgba(96,165,250,0.08)" },
          ].map(({ agent, emoji, channel, model, provider, color, border, bg }) => (
            <div key={agent} style={{ background: bg, border: `1px solid ${border}`, borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: `${color}22`, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
                {emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>{agent}</span>
                  <span style={{ color: "#f5c200", fontFamily: "monospace", fontSize: "11px", background: "rgba(245, 194, 0,0.1)", border: "1px solid rgba(245, 194, 0,0.2)", borderRadius: "4px", padding: "1px 6px" }}>{channel}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{provider}</span>
                  <span style={{ color, fontFamily: "monospace", fontSize: "11px", fontWeight: 600 }}>{model}</span>
                </div>
              </div>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", flexShrink: 0, boxShadow: "0 0 6px #4ade80" }} />
            </div>
          ))}
        </div>
      </div>

      {/* Task Difficulty → Model Routing */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
          Task Difficulty Routing
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { level: "Easy", command: "/easy", model: "gemini-2.0-flash-lite", provider: "Google", icon: "🟢", color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" },
            { level: "Medium", command: "/medium", model: "deepseek-chat", provider: "DeepSeek", icon: "🟡", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)" },
            { level: "Difficult", command: "/difficult", model: "claude-sonnet-4-6", provider: "Anthropic", icon: "🔴", color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
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

      {/* Sub-agents */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
          Sub-agents ({subAgents.length})
        </h2>
        {subAgents.length === 0 ? (
          <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-8 text-center">
            <p className="text-3xl mb-2">🤖</p>
            <p className="text-gray-500">No active sub-agents right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subAgents.map((agent, i) => {
              const name = agent.label ?? agent.key ?? "Unknown";
              const isActive = agent.active === true;
              const isCancelling = cancellingId === agent.key;
              return (
                <div
                  key={i}
                  className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-4 flex items-center gap-3 hover:border-[#3A3A4E] transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-full ${getAvatarColor(
                      name
                    )} flex items-center justify-center text-white text-sm font-bold shrink-0`}
                  >
                    {getInitials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {name}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isActive
                            ? "bg-green-400 animate-pulse"
                            : "bg-gray-600"
                        }`}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {agent.model && (
                        <span className="text-xs text-gray-500 font-mono">
                          {agent.model.split("/").pop()}
                        </span>
                      )}
                      <span className="text-xs text-gray-600">
                        {formatLastActive(agent.updatedAt)}
                      </span>
                    </div>
                    {agent.lastMessage && (
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        <span className="text-gray-600">Working on: </span>
                        {agent.lastMessage.slice(0, 80)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => agent.key && handleCancel(agent.key)}
                    disabled={isCancelling || !agent.key}
                    className="ml-2 bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-800/50 rounded px-2 py-1 text-xs disabled:opacity-50 shrink-0"
                  >
                    {isCancelling ? "Stopping..." : "Cancel"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Roles */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
          Roles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ROLES.map((role) => (
            <div
              key={role.name}
              className={`border rounded-xl p-4 ${role.color}`}
            >
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
