import AgentBanner from "@/app/components/AgentBanner";
import { invokeTool } from "@/app/lib/openclaw";
import TeamClient from "./TeamClient";
import PageHeader from "@/app/components/PageHeader";

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
    <div>
      <PageHeader title="Team" subtitle="Axel's team structure and sub-agents" icon="👥" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <AgentBanner />
        <TeamClient initialSubAgents={subAgents} />
      </div>
    </div>
  );
}
