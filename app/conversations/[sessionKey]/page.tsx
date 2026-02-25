import { invokeTool } from "@/app/lib/openclaw";
import Link from "next/link";

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
}

interface HistoryResult {
  messages?: Message[];
}

async function loadHistory(sessionKey: string): Promise<Message[]> {
  try {
    const result = await invokeTool<HistoryResult | Message[]>(
      "sessions_history",
      { sessionKey, limit: 200 }
    );
    if (Array.isArray(result)) return result;
    return result?.messages ?? [];
  } catch {
    return [];
  }
}

function renderContent(content: string | MessagePart[]): {
  text: string;
  toolCalls: string[];
} {
  if (typeof content === "string") return { text: content, toolCalls: [] };
  const text = content
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n")
    .trim();
  const toolCalls = content
    .filter((p) => p.type === "toolCall")
    .map((p) => p.name ?? "unknown");
  return { text, toolCalls };
}

function formatTime(ts?: number): string {
  if (!ts) return "";
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const ROLE_STYLES = {
  user: "bg-green-900/20 border-green-800/30 ml-8",
  assistant: "bg-[#1A1A2E] border-[#2A2A3E] mr-8",
  system: "bg-yellow-900/10 border-yellow-800/20 mx-4 opacity-60",
};

const ROLE_LABELS = {
  user: { label: "Kevin", color: "text-green-400" },
  assistant: { label: "Axel ⚙️", color: "text-purple-400" },
  system: { label: "System", color: "text-yellow-500" },
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ sessionKey: string }>;
}) {
  const { sessionKey } = await params;
  const decoded = decodeURIComponent(sessionKey);
  const messages = await loadHistory(decoded);

  // Filter out empty messages
  const visible = messages.filter((m) => {
    const { text, toolCalls } = renderContent(m.content);
    return text || toolCalls.length > 0;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/conversations"
          className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
        >
          ← Conversations
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-lg font-bold text-white truncate">{decoded}</h1>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">💬</p>
          <p>No messages in this session</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((msg, i) => {
            const { text, toolCalls } = renderContent(msg.content);
            const style = ROLE_STYLES[msg.role] ?? ROLE_STYLES.system;
            const roleInfo = ROLE_LABELS[msg.role] ?? ROLE_LABELS.system;

            return (
              <div
                key={i}
                className={`border rounded-xl p-4 animate-in fade-in duration-200 ${style}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold ${roleInfo.color}`}>
                    {roleInfo.label}
                  </span>
                  {msg.createdAt && (
                    <span className="text-xs text-gray-600">
                      {formatTime(msg.createdAt)}
                    </span>
                  )}
                </div>

                {text && (
                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
                    {text}
                  </p>
                )}

                {toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {toolCalls.map((name, j) => (
                      <span
                        key={j}
                        className="text-xs bg-blue-900/40 text-blue-300 border border-blue-800/40 px-2 py-0.5 rounded-full font-mono"
                      >
                        🔧 {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
