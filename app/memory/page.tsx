import AgentBanner from "@/app/components/AgentBanner";
import MemoryClient from "./MemoryClient";

export default function MemoryPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <AgentBanner />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Memory</h1>
        <p className="text-gray-400 text-sm mt-1">
          Axel&apos;s memory files and knowledge base
        </p>
      </div>
      <MemoryClient />
    </div>
  );
}
