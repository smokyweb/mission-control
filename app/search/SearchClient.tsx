"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  role: string;
  text: string;
  timestamp: number;
}

interface Session {
  sessionId: string;
  channel: string;
  startedAt: number;
  updatedAt: number;
  messageCount: number;
  messages: Message[];
}

interface SearchResult {
  type: "memory" | "file" | "conversation" | "task";
  title: string;
  snippet: string;
  meta?: string;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function sectionIcon(type: SearchResult["type"]): string {
  switch (type) {
    case "memory": return "🧠";
    case "file": return "📁";
    case "conversation": return "💬";
    case "task": return "⏰";
  }
}

function sectionLabel(type: SearchResult["type"]): string {
  switch (type) {
    case "memory": return "Memories";
    case "file": return "Files";
    case "conversation": return "Conversations";
    case "task": return "Tasks";
  }
}

function sessionTitle(s: Session): string {
  // Use the first real user message as the title
  const firstUser = s.messages.find((m) => m.role === "user" && m.text.length > 5);
  const preview = firstUser
    ? firstUser.text.replace(/^\[.*?\]\s*/, "").slice(0, 60).trim()
    : s.sessionId.slice(0, 8);
  const date = new Date(s.updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${preview}${preview.length >= 60 ? "..." : ""} (${date})`;
}

function findBestSnippet(messages: Message[], q: string): string | null {
  const ql = q.toLowerCase();

  // Priority: user or assistant messages first, then toolResult
  const priority = ["user", "assistant", "toolResult"];
  for (const role of priority) {
    for (const msg of messages) {
      if (msg.role !== role) continue;
      if (!msg.text?.toLowerCase().includes(ql)) continue;
      const idx = msg.text.toLowerCase().indexOf(ql);
      const start = Math.max(0, idx - 50);
      const end = Math.min(msg.text.length, idx + q.length + 100);
      return (
        (start > 0 ? "..." : "") +
        msg.text.slice(start, end) +
        (end < msg.text.length ? "..." : "")
      );
    }
  }
  return null;
}

export default function SearchClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const all: SearchResult[] = [];

    await Promise.allSettled([
      // Memory search
      fetch("/api/openclaw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "memory_search",
          args: { query: q, maxResults: 5 },
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          const items = data.result?.results ?? (Array.isArray(data.result) ? data.result : []);
          for (const item of items) {
            all.push({
              type: "memory",
              title: item.path ?? "Memory",
              snippet: item.text ?? item.snippet ?? JSON.stringify(item),
              meta: item.score ? `Score: ${item.score.toFixed(2)}` : undefined,
            });
          }
        })
        .catch(() => {}),

      // Conversations full-text search
      fetch("/api/conversations")
        .then((r) => r.json())
        .then((data) => {
          const sessions: Session[] = data.sessions ?? [];
          for (const s of sessions) {
            const snippet = findBestSnippet(s.messages ?? [], q);
            if (snippet) {
              all.push({
                type: "conversation",
                title: sessionTitle(s),
                snippet,
                meta: s.channel,
              });
            }
          }
        })
        .catch(() => {}),

      // Cron search
      fetch("/api/openclaw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "cron", args: { action: "list" } }),
      })
        .then((r) => r.json())
        .then((data) => {
          const jobs = Array.isArray(data.result) ? data.result : (data.result?.jobs ?? []);
          for (const job of jobs) {
            const label = job.label ?? job.id ?? "";
            if (label.toLowerCase().includes(q.toLowerCase())) {
              all.push({
                type: "task",
                title: label,
                snippet: typeof job.schedule === "string" ? job.schedule : job.schedule?.expr ?? "",
                meta: job.enabled !== false ? "enabled" : "disabled",
              });
            }
          }
        })
        .catch(() => {}),

      // File/workspace grep
      fetch("/api/openclaw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "exec",
          args: {
            command: `Select-String -Path "$env:USERPROFILE\\.openclaw\\workspace\\*" -Pattern "${q.replace(/"/g, "")}" -SimpleMatch 2>$null | Select-Object -First 10 Filename, Line`,
          },
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          const text = typeof data.result === "string" ? data.result : JSON.stringify(data.result ?? "");
          if (text && text.trim()) {
            const lines = text.trim().split("\n").slice(0, 5);
            for (const line of lines) {
              if (line.trim()) {
                all.push({
                  type: "file",
                  title: "Workspace match",
                  snippet: line.trim(),
                });
              }
            }
          }
        })
        .catch(() => {}),
    ]);

    setResults(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const grouped: Record<SearchResult["type"], SearchResult[]> = {
    memory: [],
    file: [],
    conversation: [],
    task: [],
  };
  for (const r of results) {
    grouped[r.type].push(r);
  }

  const sections = (["memory", "file", "conversation", "task"] as const).filter(
    (t) => grouped[t].length > 0
  );

  return (
    <div>
      <div className="relative mb-6">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search everything..."
          className="w-full bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl px-4 py-3 pl-11 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
          autoFocus
        />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm animate-pulse">
            Searching...
          </span>
        )}
      </div>

      {query && !loading && results.length === 0 && (
        <div className="text-center py-12 text-gray-600">
          <p className="text-3xl mb-2">🔎</p>
          <p>No results for "{query}"</p>
        </div>
      )}

      {sections.map((type) => (
        <div key={type} className="mb-6">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            {sectionIcon(type)} {sectionLabel(type)}
          </h2>
          <div className="space-y-2">
            {grouped[type].map((result, i) => (
              <div
                key={i}
                className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-4 hover:border-[#3A3A4E] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {highlight(result.title, query)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {highlight(result.snippet, query)}
                    </p>
                  </div>
                  {result.meta && (
                    <span className="text-xs text-gray-600 shrink-0">
                      {result.meta}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
