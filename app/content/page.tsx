import AgentBanner from "@/app/components/AgentBanner";
import ContentClient from "./ContentClient";

export default function ContentPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <AgentBanner />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Content Pipeline</h1>
        <p className="text-gray-400 text-sm mt-1">
          Track content from idea to publication
        </p>
      </div>
      <ContentClient />
    </div>
  );
}
