import SearchClient from "./SearchClient";
import PageHeader from "@/app/components/PageHeader";

export default function SearchPage() {
  return (
    <div>
      <PageHeader title="Search" subtitle="Search memories, files, conversations, and tasks" icon="🔍" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <SearchClient />
      </div>
    </div>
  );
}
