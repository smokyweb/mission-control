import AgentBanner from "@/app/components/AgentBanner";
import ContentClient from "./ContentClient";
import PageHeader from "@/app/components/PageHeader";

export default function ContentPage() {
  return (
    <div>
      <PageHeader title="Content Pipeline" subtitle="Track content from idea to publication" icon="🎬" />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <AgentBanner />
        <ContentClient />
      </div>
    </div>
  );
}
