import AgentBanner from "@/app/components/AgentBanner";
import OfficeClient from "./OfficeClient";

export default function OfficePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <AgentBanner />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Office</h1>
        <p className="text-gray-400 text-sm mt-1">
          Live view of all active sessions
        </p>
      </div>
      <OfficeClient />
    </div>
  );
}
