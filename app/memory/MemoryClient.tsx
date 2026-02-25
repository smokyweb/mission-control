"use client";

import { useCallback, useEffect, useState } from "react";

interface MemoryFile {
  filename: string;
  content: string;
  lastModified: string;
}

type SortMode = "recent" | "alpha";

export default function MemoryClient() {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/memory");
      const data = await res.json();
      if (data.ok) setFiles(data.files);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const filtered = files.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      f.filename.toLowerCase().includes(q) ||
      f.content.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "recent") {
      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
    }
    return a.filename.localeCompare(b.filename);
  });

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-500 animate-pulse">
        Loading memories…
      </div>
    );
  }

  return (
    <div>
      {/* Search and Sort */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memories…"
            className="w-full bg-[#1A1A2E] border border-[#2A2A3E] rounded-lg px-3 py-2 pl-9 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
        >
          <option value="recent">Most Recent</option>
          <option value="alpha">Alphabetical</option>
        </select>
      </div>

      {/* Files */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">🧠</p>
          <p>
            {search ? "No memories match your search" : "No memory files found"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((file) => {
            const isExpanded = expanded === file.filename;
            return (
              <div
                key={file.filename}
                className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl overflow-hidden hover:border-[#3A3A4E] transition-colors"
              >
                <button
                  onClick={() =>
                    setExpanded(isExpanded ? null : file.filename)
                  }
                  className="w-full text-left px-5 py-4 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📝</span>
                      <span className="text-sm font-medium text-white truncate">
                        {file.filename}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1" suppressHydrationWarning>
                      Last modified:{" "}
                      {new Date(file.lastModified).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs text-gray-600 shrink-0">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </button>
                <div
                  className={`border-t border-[#2A2A3E] px-5 py-4 ${
                    isExpanded ? "block" : "hidden"
                  }`}
                >
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words font-sans max-h-[500px] overflow-y-auto">
                    {file.content}
                  </pre>
                </div>
                {!isExpanded && (
                  <div className="px-5 pb-4">
                    <p className="text-xs text-gray-400 line-clamp-3 whitespace-pre-wrap">
                      {file.content.slice(0, 300)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
