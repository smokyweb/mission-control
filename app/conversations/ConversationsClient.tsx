"use client";

import { useState, useEffect, useRef } from "react";
import type { ConversationSession } from "@/app/api/conversations/route";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function channelIcon(channel: string): string {
  if (channel === "Discord") return "🎮";
  if (channel === "Signal") return "🔒";
  return "🌐";
}

function conversationSummary(session: ConversationSession): string {
  // Find the first real user message, strip the [Tue 2026-03-03 09:00 EST] timestamp prefix
  const firstUser = session.messages.find(
    (m) => m.role === "user" && m.text.trim().length > 5
  );
  if (!firstUser) return "Empty conversation";
  const text = firstUser.text
    .replace(/^\[.*?\]\s*/, "") // strip timestamp prefix
    .replace(/^Read HEARTBEAT\.md.*$/im, "Heartbeat check") // heartbeat label
    .trim();
  return text.slice(0, 72) + (text.length > 72 ? "…" : "");
}

function findMatchSnippet(session: ConversationSession, q: string): string | null {
  const ql = q.toLowerCase();
  for (const msg of session.messages) {
    if (!msg.text?.toLowerCase().includes(ql)) continue;
    const idx = msg.text.toLowerCase().indexOf(ql);
    const start = Math.max(0, idx - 30);
    const end = Math.min(msg.text.length, idx + q.length + 70);
    return (start > 0 ? "…" : "") + msg.text.slice(start, end) + (end < msg.text.length ? "…" : "");
  }
  return null;
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export default function ConversationsClient({
  initialSessions,
}: {
  initialSessions: ConversationSession[];
}) {
  const [sessions] = useState(initialSessions);
  const [selected, setSelected] = useState<ConversationSession | null>(
    initialSessions[0] ?? null
  );
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected]);

  const q = search.toLowerCase().trim();
  const filtered = sessions.filter((s) => {
    if (!q) return true;
    return (
      s.channel.toLowerCase().includes(q) ||
      s.sessionId.includes(q) ||
      conversationSummary(s).toLowerCase().includes(q) ||
      s.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 shrink-0 border-r border-[#2A2A3E] bg-[#0A0A0F] flex flex-col">
        <div className="p-4 border-b border-[#2A2A3E]">
          <h1 className="text-lg font-bold text-white mb-3">Conversations</h1>
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1A1A2E] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          {q && (
            <p className="text-xs text-gray-600 mt-1">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-600 text-sm">
              No conversations found
            </div>
          )}
          {filtered.map((session) => {
            const isSelected =
              selected?.sessionId === session.sessionId &&
              selected?.isArchive === session.isArchive;
            const summary = conversationSummary(session);
            const matchSnippet = q ? findMatchSnippet(session, search) : null;

            return (
              <button
                key={session.sessionId + (session.isArchive ? "-arch" : "")}
                onClick={() => setSelected(session)}
                className={`w-full text-left px-4 py-3 border-b border-[#1A1A2E] transition-colors ${
                  isSelected
                    ? "bg-blue-900/30 border-l-2 border-l-blue-500"
                    : "hover:bg-[#1A1A2E]"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg mt-0.5">{channelIcon(session.channel)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500 shrink-0">
                        {session.channel}
                        {session.isArchive && (
                          <span className="ml-1 text-yellow-600">[archived]</span>
                        )}
                      </span>
                      <span className="text-xs text-gray-600 shrink-0" suppressHydrationWarning>
                        {formatRelative(session.updatedAt)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white truncate mt-0.5">
                      <Highlight text={summary} query={search} />
                    </p>
                    {matchSnippet && matchSnippet !== summary ? (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        <Highlight text={matchSnippet} query={search} />
                      </p>
                    ) : (
                      <p className="text-xs text-gray-700 mt-0.5">
                        {session.messageCount} messages
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Message View */}
      {selected ? (
        <div className="flex-1 flex flex-col bg-[#0D0D1A] min-w-0">
          <div className="px-6 py-4 border-b border-[#2A2A3E] bg-[#0A0A0F] flex items-center gap-3">
            <span className="text-2xl">{channelIcon(selected.channel)}</span>
            <div>
              <h2 className="font-semibold text-white">
                {conversationSummary(selected)}
                {selected.isArchive && (
                  <span className="ml-2 text-xs text-yellow-600 font-normal">[archived]</span>
                )}
              </h2>
              <p className="text-xs text-gray-500" suppressHydrationWarning>
                {selected.channel} · Started {formatTime(selected.startedAt)} · {selected.messageCount} messages
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {selected.messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? "" : "flex-row-reverse"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-bold ${
                      isUser ? "bg-blue-800 text-blue-200" : "bg-purple-800 text-purple-200"
                    }`}
                  >
                    {isUser ? "K" : "⚙️"}
                  </div>
                  <div className={`max-w-[75%] ${isUser ? "" : "items-end flex flex-col"}`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        isUser
                          ? "bg-[#1A1A2E] text-gray-200 rounded-tl-sm"
                          : "bg-purple-900/40 text-purple-100 rounded-tr-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <p className="text-xs text-gray-700 mt-1 px-1" suppressHydrationWarning>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-600">
          <div className="text-center">
            <p className="text-4xl mb-3">💬</p>
            <p>Select a conversation</p>
          </div>
        </div>
      )}
    </div>
  );
}
