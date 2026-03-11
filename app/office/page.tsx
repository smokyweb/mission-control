import AgentBanner from "@/app/components/AgentBanner";
import OfficeClient from "./OfficeClient";
import PageHeader from "@/app/components/PageHeader";

export default function OfficePage() {
  return (
    <div>
      <PageHeader title="Office" subtitle="Live view of all active sessions" icon="🏢" />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <AgentBanner />
        <OfficeClient />
      </div>
    </div>
  );
}
