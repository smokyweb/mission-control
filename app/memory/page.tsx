import AgentBanner from "@/app/components/AgentBanner";
import MemoryClient from "./MemoryClient";
import PageHeader from "@/app/components/PageHeader";

export default function MemoryPage() {
  return (
    <div>
      <PageHeader title="Memory" subtitle="Axel's memory files and knowledge base" icon="🧠" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <AgentBanner />
        <MemoryClient />
      </div>
    </div>
  );
}
