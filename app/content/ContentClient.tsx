"use client";

import { useCallback, useEffect, useState, useRef } from "react";

interface ContentThumbnail {
  filename: string;
  originalName: string;
}

interface ContentItem {
  id: string;
  title: string;
  type: "Video" | "Blog" | "Post";
  description: string;
  script: string;
  stage: "idea" | "scripting" | "thumbnail" | "filming" | "published";
  createdAt: string;
  updatedAt: string;
  thumbnail: ContentThumbnail | null;
}

type StageKey = ContentItem["stage"];

const STAGES: { key: StageKey; label: string; color: string }[] = [
  { key: "idea", label: "Idea", color: "bg-yellow-500" },
  { key: "scripting", label: "Scripting", color: "bg-blue-500" },
  { key: "thumbnail", label: "Thumbnail", color: "bg-purple-500" },
  { key: "filming", label: "Filming", color: "bg-orange-500" },
  { key: "published", label: "Published", color: "bg-green-500" },
];

const TYPE_COLORS: Record<string, string> = {
  Video: "bg-red-900/50 text-red-300",
  Blog: "bg-blue-900/50 text-blue-300",
  Post: "bg-green-900/50 text-green-300",
};

export default function ContentClient() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/content");
      const data = await res.json();
      if (data.ok) setItems(data.items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDrop = async (stage: StageKey) => {
    if (!dragId) return;
    const item = items.find((c) => c.id === dragId);
    if (!item || item.stage === stage) {
      setDragId(null);
      return;
    }
    setItems((prev) =>
      prev.map((c) => (c.id === dragId ? { ...c, stage } : c))
    );
    setDragId(null);

    const form = new FormData();
    form.append("id", dragId);
    form.append("stage", stage);
    await fetch("/api/content", { method: "PUT", body: form });
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((c) => c.id !== id));
    await fetch("/api/content", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-500 animate-pulse">
        Loading content…
      </div>
    );
  }

  return (
    <>
      {/* Add Content Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            setEditItem(null);
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Add Content
        </button>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {STAGES.map((stage) => {
          const stageItems = items.filter((c) => c.stage === stage.key);
          return (
            <div
              key={stage.key}
              className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-3 min-h-[300px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage.key)}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                <h2 className="text-xs font-semibold text-white uppercase tracking-wide">
                  {stage.label}
                </h2>
                <span className="text-xs text-gray-500 ml-auto">
                  {stageItems.length}
                </span>
              </div>
              <div className="space-y-2">
                {stageItems.length === 0 && (
                  <p className="text-xs text-gray-600 text-center py-6">
                    Empty
                  </p>
                )}
                {stageItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragId(item.id)}
                    onClick={() => {
                      setEditItem(item);
                      setShowModal(true);
                    }}
                    className="bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg p-3 cursor-pointer hover:border-[#3A3A4E] transition-colors"
                  >
                    {item.thumbnail && (
                      <img
                        src={`/api/uploads/${item.thumbnail.filename}`}
                        alt={item.title}
                        className="w-full h-24 object-cover rounded mb-2"
                      />
                    )}
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <h3 className="text-xs font-medium text-white line-clamp-2">
                        {item.title}
                      </h3>
                    </div>
                    <span
                      className={`inline-block text-xs px-1.5 py-0.5 rounded ${
                        TYPE_COLORS[item.type] || "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {item.type}
                    </span>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <ContentModal
          item={editItem}
          onClose={() => {
            setShowModal(false);
            setEditItem(null);
          }}
          onSaved={() => {
            setShowModal(false);
            setEditItem(null);
            fetchItems();
          }}
          onDelete={(id) => {
            setShowModal(false);
            setEditItem(null);
            handleDelete(id);
          }}
        />
      )}
    </>
  );
}

function ContentModal({
  item,
  onClose,
  onSaved,
  onDelete,
}: {
  item: ContentItem | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(item?.title || "");
  const [type, setType] = useState<ContentItem["type"]>(item?.type || "Video");
  const [description, setDescription] = useState(item?.description || "");
  const [script, setScript] = useState(item?.script || "");
  const [stage, setStage] = useState<ContentItem["stage"]>(item?.stage || "idea");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleThumbnail = (file: File) => {
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const form = new FormData();
    if (item) form.append("id", item.id);
    form.append("title", title);
    form.append("type", type);
    form.append("description", description);
    form.append("script", script);
    form.append("stage", stage);
    if (thumbnailFile) form.append("thumbnail", thumbnailFile);
    await fetch("/api/content", {
      method: item ? "PUT" : "POST",
      body: form,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-4">
          {item ? "Edit Content" : "Add Content"}
        </h2>

        {/* Title */}
        <label className="block text-xs text-gray-400 mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-blue-500/50"
          placeholder="Content title"
        />

        {/* Type */}
        <label className="block text-xs text-gray-400 mb-1">Type</label>
        <div className="flex gap-2 mb-3">
          {(["Video", "Blog", "Post"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                type === t
                  ? TYPE_COLORS[t] + " ring-1 ring-white/20"
                  : "bg-[#0A0A0F] text-gray-400 border border-[#2A2A3E] hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Stage */}
        <label className="block text-xs text-gray-400 mb-1">Stage</label>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as ContentItem["stage"])}
          className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-blue-500/50"
        >
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Description */}
        <label className="block text-xs text-gray-400 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-blue-500/50 resize-none"
          placeholder="Description or notes"
        />

        {/* Script */}
        <label className="block text-xs text-gray-400 mb-1">Script</label>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={5}
          className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-blue-500/50 resize-none font-mono"
          placeholder="Write your script here…"
        />

        {/* Thumbnail */}
        <label className="block text-xs text-gray-400 mb-1">Thumbnail</label>
        {(item?.thumbnail || thumbnailPreview) && (
          <img
            src={
              thumbnailPreview ||
              `/api/uploads/${item?.thumbnail?.filename}`
            }
            alt="Thumbnail"
            className="w-full h-32 object-cover rounded-lg mb-2 border border-[#2A2A3E]"
          />
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-[#2A2A3E] rounded-lg p-3 text-center cursor-pointer hover:border-[#3A3A4E] transition-colors mb-4 text-sm text-gray-500"
        >
          {thumbnailFile ? thumbnailFile.name : "Click to upload thumbnail image"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleThumbnail(e.target.files[0]);
          }}
        />

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          {item && (
            <button
              onClick={() => onDelete(item.id)}
              className="px-4 py-2 text-sm text-red-400 hover:text-red-300 transition-colors mr-auto"
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
