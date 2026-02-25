import { invokeTool } from "@/app/lib/openclaw";

interface SessionStatus {
  model?: string;
  version?: string;
  sessions?: number;
  mode?: string;
  tools?: string[];
  [key: string]: unknown;
}

interface Session {
  key?: string;
  label?: string;
  model?: string;
  tokenCount?: number;
  updatedAt?: number;
}

interface SessionsListResponse {
  count: number;
  sessions: Session[];
}

async function getAgentStatus(): Promise<SessionStatus> {
  try {
    return await invokeTool<SessionStatus>("session_status", {});
  } catch {
    return {};
  }
}

async function getSessions(): Promise<Session[]> {
  try {
    const response = await invokeTool<SessionsListResponse>("sessions_list", { limit: 20 });
    return response.sessions ?? [];
  } catch {
    return [];
  }
}

async function getLatestNpmVersion(): Promise<string | null> {
  try {
    const res = await fetch(
      "https://registry.npmjs.org/openclaw/latest",
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    return data.version ?? null;
  } catch {
    return null;
  }
}

function extractVersion(status: SessionStatus): string {
  if (status.version) return status.version;
  // Try parsing from model string or other fields
  return "unknown";
}

export default async function AgentBanner() {
  const [status, sessions, latestVersion] = await Promise.all([
    getAgentStatus(),
    getSessions(),
    getLatestNpmVersion(),
  ]);

  const currentVersion = extractVersion(status);
  const isUpToDate =
    latestVersion && currentVersion !== "unknown"
      ? currentVersion === latestVersion
      : null;

  const subAgents = sessions.filter(
    (s) =>
      s.key?.includes(":subagent:") ||
      s.key?.includes(":cron:")
  );

  const now = Date.now();

  const toolCategories = [
    { label: "Web Browse", icon: "🌐" },
    { label: "Shell Exec", icon: "💻" },
    { label: "File System", icon: "📁" },
    { label: "Memory", icon: "🧠" },
    { label: "Messaging", icon: "💬" },
  ];

  return (
    <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-5 mb-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <h2 className="text-lg font-bold text-white">Axel</h2>
            {currentVersion !== "unknown" && (
              <span className="text-xs bg-[#2A2A3E] text-gray-400 px-2 py-0.5 rounded-full font-mono">
                v{currentVersion}
              </span>
            )}
            {isUpToDate !== null && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  isUpToDate
                    ? "bg-green-900/50 text-green-400"
                    : "bg-yellow-900/50 text-yellow-400"
                }`}
              >
                {isUpToDate ? "✓ Up to date" : `Update: v${latestVersion}`}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-0.5">OpenClaw AI Agent</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Model", value: status.model ?? "—" },
          { label: "Sessions", value: String(sessions.length) },
          { label: "Sub-agents", value: String(subAgents.length) },
          { label: "Mode", value: status.mode ?? "local" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-[#0A0A0F] rounded-lg p-3 border border-[#2A2A3E]"
          >
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="text-sm font-mono text-white truncate">{value}</div>
          </div>
        ))}
      </div>

      {/* Tool Capabilities */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
          Capabilities
        </div>
        <div className="flex flex-wrap gap-2">
          {toolCategories.map(({ label, icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 text-xs bg-blue-900/30 text-blue-300 border border-blue-800/50 px-2 py-1 rounded-full"
            >
              {icon} {label}
            </span>
          ))}
        </div>
      </div>

      {/* Sub-agents */}
      {subAgents.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Sub-agents
          </div>
          <div className="space-y-2">
            {subAgents.slice(0, 5).map((agent, i) => {
              const updatedAt = agent.updatedAt ?? 0;
              const isRecent = now - updatedAt < 5 * 60 * 1000;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-[#0A0A0F] rounded-lg px-3 py-2 border border-[#2A2A3E]"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isRecent ? "bg-green-400 animate-pulse" : "bg-gray-600"
                    }`}
                  />
                  <span className="text-sm text-white truncate flex-1">
                    {agent.label ?? agent.key ?? "Unknown"}
                  </span>
                  <span className="text-xs text-gray-500 font-mono shrink-0">
                    {agent.model?.split("/").pop() ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
