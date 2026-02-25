import SearchClient from "./SearchClient";

export default function SearchPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Global Search</h1>
        <p className="text-gray-400 text-sm mt-1">
          Search memories, files, conversations, and tasks
        </p>
      </div>
      <SearchClient />
    </div>
  );
}
