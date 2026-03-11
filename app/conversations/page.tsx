import fs from "fs";
import path from "path";
import os from "os";
import ConversationsClient from "./ConversationsClient";
import PageHeader from "@/app/components/PageHeader";
import type { ConversationSession } from "@/app/api/conversations/route";

interface JournalEntry {
  type: string;
  id?: string;
  timestamp?: string;
  message?: {
    role: "user" | "assistant";
    content: Array<{ type: string; text?: string }>;
    timestamp?: number;
  };
}

function extractText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => {
      let text = c.text || "";
      text = text.replace(/Conversation info \(untrusted metadata\):[\s\S]*?```\n\n/g, "").trim();
      return text;
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function detectChannel(entries: JournalEntry[]): string {
  for (const entry of entries) {
    if (entry.type === "message" && entry.message?.role === "user") {
      const raw = entry.message.content.find((c) => c.type === "text")?.text || "";
      if (raw.includes('"channel": "discord"') || raw.includes('"channel":"discord"') || raw.includes("sender_id")) return "Discord";
      if (raw.includes('"channel": "signal"') || raw.includes('"channel":"signal"')) return "Signal";
    }
  }
  return "Webchat";
}

function parseSession(filePath: string): ConversationSession | null {
  try {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
    const entries: JournalEntry[] = [];
    for (const line of lines) {
      try { entries.push(JSON.parse(line)); } catch { /* skip */ }
    }

    const sessionEntry = entries.find((e) => e.type === "session");
    if (!sessionEntry) return null;

    const startedAt = sessionEntry.timestamp ? new Date(sessionEntry.timestamp).getTime() : Date.now();
    const messages = entries
      .filter((e) => e.type === "message" && e.message)
      .map((e) => {
        const { role, content, timestamp } = e.message!;
        const text = extractText(content || []);
        return text ? { id: e.id!, role, text, timestamp: timestamp || startedAt } : null;
      })
      .filter(Boolean) as ConversationSession["messages"];

    if (!messages.length) return null;

    const filename = path.basename(filePath, ".jsonl");
    const isArchive = filename.startsWith("archive-");
    return {
      sessionId: isArchive ? filename.replace("archive-", "") : filename,
      channel: detectChannel(entries),
      startedAt,
      updatedAt: messages.at(-1)?.timestamp ?? startedAt,
      messageCount: messages.length,
      messages,
      isArchive,
    };
  } catch { return null; }
}

function loadSessions(): ConversationSession[] {
  const dir = path.join(os.homedir(), ".openclaw", "agents", "main", "sessions");
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => parseSession(path.join(dir, f)))
      .filter(Boolean)
      .sort((a, b) => b!.updatedAt - a!.updatedAt) as ConversationSession[];
  } catch { return []; }
}

export default async function ConversationsPage() {
  const sessions = loadSessions();
  return (
    <div>
      <PageHeader title="Conversations" subtitle="All sessions and message history" icon="💬" />
      <ConversationsClient initialSessions={sessions} />
    </div>
  );
}
