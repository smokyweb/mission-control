"use client";

import { useCallback, useEffect, useState } from "react";

interface Session {
  key?: string;
  label?: string;
  kind?: string;
  model?: string;
  tokenCount?: number;
  totalTokens?: number;
  contextTokens?: number;
  updatedAt?: number;
}

function getAvatarColor(kind?: string): string {
  switch (kind) {
    case "subagent":
      return "bg-purple-600";
    case "cron":
      return "bg-green-600";
    case "chat":
      return "bg-blue-600";
    default:
      return "bg-gray-600";
  }
}

function getInitials(name: string): string {
  return name
    .split(/[\s:_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
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

function isRecentlyActive(ts?: number): boolean {
  if (!ts) return false;
  const ms = ts > 1e12 ? ts : ts * 1000;
  return Date.now() - ms < 2 * 60 * 1000;
}

export default function OfficeClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/openclaw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "sessions_list", args: { limit: 50 } }),
      });
      const data = await res.json();
      if (data.ok) {
        const result = data.result;
        const list = result?.sessions ?? (Array.isArray(result) ? result : []);
        setSessions(list);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const activeCount = sessions.filter((s) =>
    isRecentlyActive(s.updatedAt)
  ).length;

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-500 animate-pulse">
        Loading sessions…
      </div>
    );
  }

  if (error && sessions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-600">
        <p className="text-4xl mb-3">⚠️</p>
        <p>Failed to load sessions</p>
        <button
          onClick={fetchSessions}
          className="mt-3 px-4 py-2 text-sm bg-[#1A1A2E] border border-[#2A2A3E] rounded-lg text-gray-400 hover:text-white transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Active Count Badge */}
      <div className="flex items-center gap-3 mb-6">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1A1A2E] border border-[#2A2A3E] rounded-full text-sm">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 font-medium">{activeCount}</span>
          <span className="text-gray-500">active</span>
        </span>
        <span className="text-sm text-gray-600">
          {sessions.length} total sessions
        </span>
      </div>

      {/* Session Grid */}
      {sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">🏢</p>
          <p>No sessions found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session, i) => {
            const name = session.label ?? session.key ?? "Unknown";
            const active = isRecentlyActive(session.updatedAt);
            const total = session.totalTokens ?? session.tokenCount ?? 0;
            const context = session.contextTokens ?? 200000;
            const usagePct = context > 0 ? Math.min((total / context) * 100, 100) : 0;

            return (
              <div
                key={i}
                className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-4 hover:border-[#3A3A4E] transition-colors"
              >
                <div className="flex items-start gap-3 mb-3">
                  {/* Avatar */}
                  <div
                    className={`w-10 h-10 rounded-full ${getAvatarColor(
                      session.kind
                    )} flex items-center justify-center text-white text-sm font-bold shrink-0 relative`}
                  >
                    {getInitials(name)}
                    {active && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-[#1A1A2E] animate-pulse" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {session.model && (
                        <span className="text-xs bg-[#2A2A3E] text-gray-400 px-1.5 py-0.5 rounded font-mono">
                          {session.model.split("/").pop()}
                        </span>
                      )}
                      {session.kind && (
                        <span className="text-xs text-gray-600">
                          {session.kind}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Token Usage Bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Tokens</span>
                    <span suppressHydrationWarning>
                      {total.toLocaleString()}
                      {context > 0 ? ` / ${context.toLocaleString()}` : ""}
                    </span>
                  </div>
                  <div className="w-full bg-[#0A0A0F] rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        usagePct > 80
                          ? "bg-red-500"
                          : usagePct > 50
                          ? "bg-yellow-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${usagePct}%` }}
                    />
                  </div>
                </div>

                {/* Last Active */}
                <p className="text-xs text-gray-600">
                  {formatLastActive(session.updatedAt)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
