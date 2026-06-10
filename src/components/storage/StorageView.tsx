"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface MediaItem {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  folder: string | null;
  tags: string[] | null;
  aiGenerated: boolean;
  createdAt: string;
}

interface Props {
  projectId: string;
}

export function StorageView({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [showFolderInput, setShowFolderInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryKey = ["media", projectId, activeFolder];

  const { data, isLoading } = useQuery<{ items: MediaItem[]; folders: string[] }>({
    queryKey,
    queryFn: () => {
      const url = new URL("/api/media", window.location.origin);
      url.searchParams.set("projectId", projectId);
      if (activeFolder) url.searchParams.set("folder", activeFolder);
      return fetch(url.toString()).then((r) => r.json());
    },
    staleTime: 10_000,
  });

  const items = data?.items || [];
  const folders = data?.folders || [];

  async function upload(files: FileList) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId);
        if (activeFolder) formData.append("folder", activeFolder);
        await fetch("/api/media", { method: "POST", body: formData });
      }
      queryClient.invalidateQueries({ queryKey });
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
  }

  async function deleteItem(id: string) {
    await fetch(`/api/media/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey });
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    if (preview?.id === id) setPreview(null);
  }

  async function deleteSelected() {
    await Promise.all(Array.from(selected).map((id) => fetch(`/api/media/${id}`, { method: "DELETE" })));
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey });
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function isImage(mime: string) { return mime.startsWith("image/"); }

  const folderList = Array.from(new Set([...folders.filter(Boolean)])) as string[];

  return (
    <div className="flex h-[calc(100vh-40px)]">
      {/* Sidebar */}
      <div className="w-44 shrink-0 border-r border-border bg-canvas-subtle flex flex-col p-2 gap-1">
        <p className="text-[10px] font-semibold text-fg-subtle px-2 py-1 uppercase tracking-wide">Папки</p>
        <button
          onClick={() => setActiveFolder(null)}
          className={cn("text-left text-xs px-2 py-1.5 rounded-lg transition-colors",
            activeFolder === null ? "bg-accent text-white" : "text-fg-muted hover:bg-border/40")}
        >
          📁 Всі файли
        </button>
        {folderList.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFolder(f)}
            className={cn("text-left text-xs px-2 py-1.5 rounded-lg transition-colors truncate",
              activeFolder === f ? "bg-accent text-white" : "text-fg-muted hover:bg-border/40")}
          >
            📂 {f}
          </button>
        ))}
        {showFolderInput ? (
          <div className="flex gap-1 mt-1">
            <input
              autoFocus
              className="input text-xs py-1 flex-1"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="Назва..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolder.trim()) {
                  setActiveFolder(newFolder.trim());
                  setShowFolderInput(false);
                  setNewFolder("");
                }
                if (e.key === "Escape") { setShowFolderInput(false); setNewFolder(""); }
              }}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowFolderInput(true)}
            className="text-left text-xs px-2 py-1 text-fg-subtle hover:text-accent transition-colors"
          >
            + Нова папка
          </button>
        )}
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-canvas-subtle shrink-0 flex-wrap">
          <span className="text-xs text-fg-muted">{items.length} файлів</span>

          {selected.size > 0 && (
            <button onClick={deleteSelected} className="btn-danger text-xs px-3 py-1">
              🗑 Видалити ({selected.size})
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* View toggle */}
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setView("grid")}
                className={cn("px-2 py-1 text-xs transition-colors", view === "grid" ? "bg-accent text-white" : "text-fg-muted hover:bg-border/30")}
              >⊞</button>
              <button
                onClick={() => setView("list")}
                className={cn("px-2 py-1 text-xs transition-colors", view === "list" ? "bg-accent text-white" : "text-fg-muted hover:bg-border/30")}
              >☰</button>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-primary text-xs px-3 py-1"
            >
              {uploading ? "Завантаження..." : "↑ Завантажити"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => e.target.files && upload(e.target.files)}
            />
          </div>
        </div>

        {/* Drop zone + content */}
        <div
          className={cn("flex-1 overflow-auto p-4 relative", dragOver && "bg-accent/5")}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {dragOver && (
            <div className="absolute inset-4 border-2 border-dashed border-accent rounded-2xl flex items-center justify-center z-10 bg-accent/5 pointer-events-none">
              <p className="text-sm text-accent font-medium">Відпустіть для завантаження</p>
            </div>
          )}

          {isLoading ? (
            <div className={cn("gap-3", view === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" : "flex flex-col")}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={cn("skeleton rounded-xl", view === "grid" ? "aspect-square" : "h-12")} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-5xl mb-3">🗄️</div>
              <p className="text-sm font-medium text-fg-muted">Немає файлів</p>
              <p className="text-xs text-fg-subtle mt-1">Перетягніть файли сюди або натисніть «Завантажити»</p>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {items.map((item) => (
                <GridItem
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  onSelect={() => toggleSelect(item.id)}
                  onClick={() => setPreview(item)}
                  isImage={isImage(item.mimeType)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <ListItem
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  onSelect={() => toggleSelect(item.id)}
                  onClick={() => setPreview(item)}
                  onDelete={() => deleteItem(item.id)}
                  isImage={isImage(item.mimeType)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview panel */}
      {preview && (
        <div className="w-64 shrink-0 border-l border-border bg-canvas-subtle flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-fg truncate">{preview.fileName}</span>
            <button onClick={() => setPreview(null)} className="text-fg-subtle hover:text-fg ml-2">×</button>
          </div>
          <div className="p-3 flex-1 overflow-auto">
            {isImage(preview.mimeType) ? (
              <img src={preview.filePath} alt={preview.fileName} className="w-full rounded-lg object-contain max-h-48" />
            ) : (
              <div className="w-full aspect-square bg-border/30 rounded-lg flex items-center justify-center text-3xl">
                {preview.mimeType.startsWith("video/") ? "🎬" : "📄"}
              </div>
            )}
            <div className="mt-3 space-y-2">
              <div>
                <p className="text-[10px] text-fg-subtle uppercase tracking-wide">Тип</p>
                <p className="text-xs text-fg">{preview.mimeType}</p>
              </div>
              {preview.folder && (
                <div>
                  <p className="text-[10px] text-fg-subtle uppercase tracking-wide">Папка</p>
                  <p className="text-xs text-fg">{preview.folder}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-fg-subtle uppercase tracking-wide">Дата</p>
                <p className="text-xs text-fg">{new Date(preview.createdAt).toLocaleDateString("uk-UA")}</p>
              </div>
              {preview.aiGenerated && (
                <span className="text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded">AI-згенеровано</span>
              )}
            </div>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.origin + preview.filePath); }}
                className="btn-ghost w-full text-xs py-1.5"
              >
                📋 Копіювати URL
              </button>
              <a href={preview.filePath} download={preview.fileName} className="btn-ghost w-full text-xs py-1.5 block text-center">
                ↓ Завантажити
              </a>
              <button
                onClick={() => deleteItem(preview.id)}
                className="w-full text-xs py-1.5 text-danger hover:bg-danger/10 rounded-lg transition-colors"
              >
                🗑 Видалити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GridItem({ item, selected, onSelect, onClick, isImage }: {
  item: MediaItem; selected: boolean; onSelect: () => void; onClick: () => void; isImage: boolean;
}) {
  return (
    <div
      className={cn("relative rounded-xl overflow-hidden border-2 cursor-pointer group transition-all",
        selected ? "border-accent" : "border-transparent hover:border-border")}
      onClick={onClick}
    >
      {isImage ? (
        <img src={item.filePath} alt={item.fileName} className="w-full aspect-square object-cover" loading="lazy" />
      ) : (
        <div className="w-full aspect-square bg-border/30 flex items-center justify-center text-3xl">
          {item.mimeType.startsWith("video/") ? "🎬" : "📄"}
        </div>
      )}
      {/* Checkbox overlay */}
      <div
        className={cn("absolute top-1.5 left-1.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-opacity bg-white",
          selected ? "opacity-100 border-accent" : "opacity-0 group-hover:opacity-100 border-border")}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        {selected && <span className="text-accent text-xs">✓</span>}
      </div>
      {/* Filename */}
      <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[10px] text-white truncate">{item.fileName}</p>
      </div>
    </div>
  );
}

function ListItem({ item, selected, onSelect, onClick, onDelete, isImage }: {
  item: MediaItem; selected: boolean; onSelect: () => void; onClick: () => void; onDelete: () => void; isImage: boolean;
}) {
  return (
    <div
      className={cn("flex items-center gap-3 p-2 rounded-lg border cursor-pointer group transition-colors",
        selected ? "border-accent bg-accent/5" : "border-transparent hover:bg-border/20")}
      onClick={onClick}
    >
      <div
        className={cn("w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-opacity",
          selected ? "border-accent" : "border-border opacity-0 group-hover:opacity-100")}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        {selected && <span className="text-accent text-xs">✓</span>}
      </div>
      {isImage ? (
        <img src={item.filePath} alt="" className="w-8 h-8 rounded object-cover shrink-0" loading="lazy" />
      ) : (
        <div className="w-8 h-8 bg-border/30 rounded flex items-center justify-center shrink-0 text-base">
          {item.mimeType.startsWith("video/") ? "🎬" : "📄"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-fg truncate">{item.fileName}</p>
        <p className="text-[10px] text-fg-subtle">{item.folder || "—"} · {item.mimeType.split("/")[1]}</p>
      </div>
      <span className="text-[10px] text-fg-subtle shrink-0">{new Date(item.createdAt).toLocaleDateString("uk-UA")}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 text-danger hover:bg-danger/10 rounded p-1 transition-all"
      >
        🗑
      </button>
    </div>
  );
}
