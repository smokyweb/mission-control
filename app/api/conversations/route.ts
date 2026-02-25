import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

interface JournalEntry {
  type: string;
  id?: string;
  timestamp?: string;
  message?: {
    role: "user" | "assistant";
    content: Array<{ type: string; text?: string; name?: string }>;
    timestamp?: number;
  };
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export interface ConversationSession {
  sessionId: string;
  channel: string;
  startedAt: number;
  updatedAt: number;
  messageCount: number;
  messages: ConversationMessage[];
  isArchive: boolean;
}

function extractText(
  content: Array<{ type: string; text?: string; name?: string }>
): string {
  return content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => {
      let text = c.text || "";
      // Strip OpenClaw metadata blocks from user messages
      text = text.replace(/Conversation info \(untrusted metadata\):[\s\S]*?```\n\n/g, "").trim();
      return text;
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function detectChannel(messages: ConversationMessage[], rawMessages: JournalEntry[]): string {
  // Look for channel hints in raw user messages
  for (const entry of rawMessages) {
    if (entry.type === "message" && entry.message?.role === "user") {
      const content = entry.message.content;
      const rawText = content.find((c) => c.type === "text")?.text || "";
      if (rawText.includes('"channel": "discord"') || rawText.includes('"channel":"discord"')) {
        return "Discord";
      }
      if (rawText.includes('"channel": "webchat"') || rawText.includes('"channel":"webchat"')) {
        return "Webchat";
      }
      if (rawText.includes('"channel": "signal"') || rawText.includes('"channel":"signal"')) {
        return "Signal";
      }
      if (rawText.includes("sender_id")) {
        return "Discord";
      }
    }
  }
  return "Webchat";
}

function parseJSONL(filePath: string): ConversationSession | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    const entries: JournalEntry[] = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        // skip bad lines
      }
    }

    const sessionEntry = entries.find((e) => e.type === "session");
    const messageEntries = entries.filter((e) => e.type === "message");

    if (!sessionEntry) return null;

    const startedAt = sessionEntry.timestamp
      ? new Date(sessionEntry.timestamp).getTime()
      : Date.now();

    const messages: ConversationMessage[] = [];
    for (const entry of messageEntries) {
      if (!entry.message || !entry.id) continue;
      const { role, content, timestamp } = entry.message;
      if (!content || !Array.isArray(content)) continue;
      const text = extractText(content);
      if (!text) continue;
      messages.push({
        id: entry.id,
        role,
        text,
        timestamp: timestamp || startedAt,
      });
    }

    if (messages.length === 0) return null;

    const channel = detectChannel(messages, entries);
    const updatedAt = messages.at(-1)?.timestamp ?? startedAt;
    const filename = path.basename(filePath, ".jsonl");
    const isArchive = filename.startsWith("archive-");
    const sessionId = isArchive ? filename.replace("archive-", "") : filename;

    return {
      sessionId,
      channel,
      startedAt,
      updatedAt,
      messageCount: messages.length,
      messages,
      isArchive,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const sessionsDir = path.join(os.homedir(), ".openclaw", "agents", "main", "sessions");

  let files: string[] = [];
  try {
    files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return NextResponse.json({ sessions: [] });
  }

  const sessions: ConversationSession[] = [];
  for (const file of files) {
    const session = parseJSONL(path.join(sessionsDir, file));
    if (session) sessions.push(session);
  }

  // Sort: most recent first
  sessions.sort((a, b) => b.updatedAt - a.updatedAt);

  return NextResponse.json({ sessions });
}
