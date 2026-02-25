"use client";

interface Session {
  key?: string;
  label?: string;
  model?: string;
  tokenCount?: number;
  updatedAt?: number;
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

      {/* Sub-agents */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
          Sub-agents ({initialSubAgents.length})
        </h2>
        {initialSubAgents.length === 0 ? (
          <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-8 text-center">
            <p className="text-3xl mb-2">🤖</p>
            <p className="text-gray-500">No active sub-agents right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {initialSubAgents.map((agent, i) => {
              const name = agent.label ?? agent.key ?? "Unknown";
              const active = isActive(agent.updatedAt);
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
                          active
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
                  </div>
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
