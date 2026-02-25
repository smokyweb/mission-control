import AgentBanner from "@/app/components/AgentBanner";
import { invokeTool } from "@/app/lib/openclaw";
import TeamClient from "./TeamClient";

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

async function getSubAgents(): Promise<Session[]> {
  try {
    const response = await invokeTool<SessionsListResponse>("sessions_list", { limit: 50 });
    const sessions = response.sessions ?? [];
    return sessions.filter(
      (s) => s.key?.includes(":subagent:") || s.key?.includes(":cron:")
    );
  } catch {
    return [];
  }
}

export default async function TeamPage() {
  const subAgents = await getSubAgents();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <AgentBanner />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Team</h1>
        <p className="text-gray-400 text-sm mt-1">
          Axel&apos;s team structure and sub-agents
        </p>
      </div>
      <TeamClient initialSubAgents={subAgents} />
    </div>
  );
}
