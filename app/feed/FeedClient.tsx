"use client";

import { useCallback, useEffect, useState } from "react";

interface MessagePart {
  type: "text" | "toolCall" | "toolResult";
  text?: string;
  name?: string;
  arguments?: unknown;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string | MessagePart[];
  createdAt?: number;
  sessionKey?: string;
  sessionLabel?: string;
}

type FilterType = "all" | "tools" | "assistant" | "user";

function getDotColor(msg: Message): string {
  if (msg.role === "user") return "bg-green-400";
  if (msg.role === "system") return "bg-yellow-400";
  // Check if assistant message has tool calls
  if (msg.role === "assistant") {
    const parts = Array.isArray(msg.content) ? msg.content : [];
    if (parts.some((p) => p.type === "toolCall")) return "bg-blue-400";
    return "bg-purple-400";
  }
  return "bg-gray-400";
}

function getFilterType(msg: Message): FilterType {
  if (msg.role === "user") return "user";
  if (msg.role === "assistant") {
    const parts = Array.isArray(msg.content) ? msg.content : [];
    if (parts.some((p) => p.type === "toolCall")) return "tools";
    return "assistant";
  }
  return "all";
}

function renderContent(content: string | MessagePart[]): string {
  if (typeof content === "string") return content;
  return content
    .map((part) => {
      if (part.type === "text") return part.text ?? "";
      if (part.type === "toolCall")
        return `[Tool: ${part.name ?? "unknown"}]`;
      return "";
    })
    .join(" ")
    .trim();
}

function formatTime(ts?: number): string {
  if (!ts) return "";
  // Guard: if ts looks like seconds (< 1e12), don't convert
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms).toLocaleTimeString();
}

export default function FeedClient({
  initialMessages,
}: {
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [filter, setFilter] = useState<FilterType>("all");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/openclaw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "sessions_list", args: { limit: 20 } }),
      });
      const { result: sessions } = await res.json();
      if (!Array.isArray(sessions)) return;

      const all: Message[] = [];
      await Promise.allSettled(
        sessions.slice(0, 10).map(async (session: { sessionKey: string; label?: string }) => {
          const r = await fetch("/api/openclaw", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tool: "sessions_history",
              args: { sessionKey: session.sessionKey, limit: 50 },
            }),
          });
          const data = await r.json();
          const history = data.result;
          const msgs = history?.messages ?? (Array.isArray(history) ? history : []);
          for (const msg of msgs) {
            all.push({
              ...msg,
              sessionKey: session.sessionKey,
              sessionLabel: session.label ?? session.sessionKey,
            });
          }
        })
      );

      all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setMessages(all.slice(0, 200));
      setLastRefresh(new Date());
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const filtered = messages.filter((msg) => {
    if (filter === "all") return true;
    return getFilterType(msg) === filter;
  });

  const filters: { key: FilterType; label: string; color: string }[] = [
    { key: "all", label: "All", color: "bg-gray-700 text-gray-200" },
    { key: "tools", label: "Tools", color: "bg-blue-900/50 text-blue-300" },
    { key: "assistant", label: "Assistant", color: "bg-purple-900/50 text-purple-300" },
    { key: "user", label: "User", color: "bg-green-900/50 text-green-300" },
  ];

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {filters.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === key
                ? color + " ring-2 ring-white/20"
                : "bg-[#1A1A2E] text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={refresh}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          suppressHydrationWarning
        >
          Refreshed {lastRefresh.toLocaleTimeString()}
        </button>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">📭</p>
          <p>No messages found</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((msg, i) => {
            const text = renderContent(msg.content);
            if (!text) return null;
            return (
              <div
                key={i}
                className="flex gap-3 items-start py-2 px-3 rounded-lg hover:bg-[#1A1A2E] transition-colors group animate-in fade-in duration-200"
              >
                {/* Dot */}
                <div className="flex flex-col items-center pt-1.5">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${getDotColor(msg)}`}
                  />
                  {i < filtered.length - 1 && (
                    <div className="w-px flex-1 bg-[#2A2A3E] mt-1 min-h-[8px]" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-gray-300 capitalize">
                      {msg.role}
                    </span>
                    {msg.sessionLabel && (
                      <span className="text-xs text-gray-600 truncate max-w-[200px]">
                        {msg.sessionLabel}
                      </span>
                    )}
                    <span className="text-xs text-gray-700 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 line-clamp-3 break-words">
                    {text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
