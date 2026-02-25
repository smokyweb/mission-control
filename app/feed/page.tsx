import { invokeTool } from "@/app/lib/openclaw";
import AgentBanner from "@/app/components/AgentBanner";
import FeedClient from "./FeedClient";

interface Session {
  key: string;
  label?: string;
  kind?: string;
  updatedAt?: number;
}

interface SessionsListResponse {
  count: number;
  sessions: Session[];
}

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

async function loadFeed(): Promise<Message[]> {
  let sessions: Session[] = [];
  try {
    const response = await invokeTool<SessionsListResponse>("sessions_list", { limit: 20 });
    sessions = response.sessions ?? [];
  } catch {
    return [];
  }

  const allMessages: Message[] = [];

  await Promise.allSettled(
    sessions.slice(0, 10).map(async (session) => {
      try {
        const history = await invokeTool<{ messages?: Message[] }>(
          "sessions_history",
          { sessionKey: session.key, limit: 50 }
        );
        const msgs = history?.messages ?? (Array.isArray(history) ? history : []);
        for (const msg of msgs) {
          allMessages.push({
            ...msg,
            sessionKey: session.key,
            sessionLabel: session.label ?? session.key,
          });
        }
      } catch {
        // Skip failed sessions
      }
    })
  );

  // Sort by creation time descending
  allMessages.sort((a, b) => {
    const ta = a.createdAt ?? 0;
    const tb = b.createdAt ?? 0;
    return tb - ta;
  });

  return allMessages.slice(0, 200);
}

export default async function FeedPage() {
  const messages = await loadFeed();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <AgentBanner />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Activity Feed</h1>
        <p className="text-gray-400 text-sm mt-1">
          Real-time session messages across all agents
        </p>
      </div>
      <FeedClient initialMessages={messages} />
    </div>
  );
}
