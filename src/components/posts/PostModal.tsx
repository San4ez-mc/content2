"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn, PLATFORM_META, STATUS_META } from "@/lib/utils";

interface PostItem {
  id: string;
  orderIndex: number;
  content: string | null;
  imagePath: string | null;
  imagePrompt: string | null;
  imageType: string | null;
  generationStatus: string;
  generationError: string | null;
  isCta: boolean;
  slideTitle: string | null;
  slideSubtitle: string | null;
}

interface PostGroup {
  id: string;
  postDate: string;
  type: string;
  status: string;
  audience: string | null;
  socialNetwork: { id: string; name: string; platformKey: string };
  items: PostItem[];
}

interface Props {
  group: PostGroup;
  onClose: () => void;
  onUpdate: () => void;
}

const GENERATORS = [
  { value: "ai_flux", label: "FLUX Schnell" },
  { value: "ai_flux_pro", label: "FLUX Pro 2K" },
  { value: "ai_ideogram", label: "Ideogram V3" },
  { value: "ai_recraft", label: "Recraft V4" },
  { value: "stories_photo", label: "Stories Generator" },
  { value: "template", label: "Image Template" },
];

export function PostModal({ group, onClose, onUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<"content" | "media">("content");
  const [activeItemIdx, setActiveItemIdx] = useState(0);
  const [items, setItems] = useState<PostItem[]>(group.items);
  const [status, setStatus] = useState(group.status);
  const [saving, setSaving] = useState(false);

  const activeItem = items[activeItemIdx];

  function updateItem(idx: number, patch: Partial<PostItem>) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/posts/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, items }),
      });
      onUpdate();
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup() {
    if (!confirm("Видалити цей пост?")) return;
    await fetch(`/api/posts/${group.id}`, { method: "DELETE" });
    onUpdate();
  }

  async function triggerGeneration(itemId: string, imageType: string, prompt: string) {
    await fetch(`/api/posts/${group.id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, imageType, prompt }),
    });
    // SSE will update status in real-time
  }

  const typeLabel =
    group.type === "carousel" ? "🎠 Carousel"
    : group.type === "thread_chain" ? "🧵 Thread chain"
    : group.type === "stories" ? "📱 Stories"
    : "📝 Single";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-fg">{typeLabel}</span>
              <span className="text-xs text-fg-subtle">·</span>
              <span className="text-xs text-fg-muted">{group.socialNetwork.name}</span>
              <span className="text-xs text-fg-subtle">·</span>
              <span className="text-xs text-fg-muted">
                {new Date(group.postDate).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </span>
            </div>
          </div>

          {/* Status */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-xs bg-canvas border border-border rounded px-2 py-1 text-fg"
          >
            {Object.entries(STATUS_META).map(([val, meta]) => (
              <option key={val} value={val}>{meta.label}</option>
            ))}
          </select>

          <button onClick={onClose} className="text-fg-subtle hover:text-fg transition-colors text-lg leading-none">×</button>
        </div>

        {/* Item tabs (for multi-item posts) */}
        {items.length > 1 && (
          <div className="flex items-center gap-1 px-5 py-2 border-b border-border bg-canvas shrink-0 overflow-x-auto">
            {items.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => setActiveItemIdx(idx)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors shrink-0",
                  activeItemIdx === idx
                    ? "bg-accent text-white"
                    : "text-fg-muted hover:text-fg hover:bg-border/40"
                )}
              >
                {idx + 1}
                {item.isCta && <span className="text-[10px] opacity-70">CTA</span>}
                {item.generationStatus === "generating" && (
                  <span className="animate-pulse">⏳</span>
                )}
                {item.generationStatus === "failed" && <span>❌</span>}
              </button>
            ))}
            <button
              onClick={async () => {
                const r = await fetch(`/api/posts/${group.id}/items`, { method: "POST" });
                const newItem = await r.json();
                setItems((prev) => [...prev, newItem]);
                setActiveItemIdx(items.length);
              }}
              className="px-2 py-1 rounded text-xs text-fg-subtle hover:text-accent hover:bg-border/30 transition-colors shrink-0"
            >
              + Додати
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 px-5 border-b border-border shrink-0">
          {(["content", "media"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-xs font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-accent text-accent"
                  : "border-transparent text-fg-muted hover:text-fg"
              )}
            >
              {tab === "content" ? "Контент" : "Медіа"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "content" ? (
            <div className="space-y-4">
              {/* Text editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-fg-muted">
                    {group.type === "thread_chain"
                      ? `Пост ${activeItemIdx + 1} з ${items.length}`
                      : group.type === "carousel"
                      ? `Слайд ${activeItemIdx + 1}`
                      : "Текст поста"}
                    {activeItem?.isCta && (
                      <span className="ml-2 text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">CTA</span>
                    )}
                  </label>
                  <span className="text-[10px] text-fg-subtle">
                    {activeItem?.content?.length || 0} символів
                  </span>
                </div>
                <textarea
                  className="input min-h-32 resize-none font-mono text-xs leading-relaxed"
                  value={activeItem?.content || ""}
                  onChange={(e) => updateItem(activeItemIdx, { content: e.target.value })}
                  placeholder="Текст поста..."
                />
              </div>

              {/* Carousel slide fields */}
              {group.type === "carousel" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1">Заголовок слайду</label>
                    <input
                      className="input"
                      value={activeItem?.slideTitle || ""}
                      onChange={(e) => updateItem(activeItemIdx, { slideTitle: e.target.value })}
                      placeholder="Заголовок..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1">Підзаголовок</label>
                    <input
                      className="input"
                      value={activeItem?.slideSubtitle || ""}
                      onChange={(e) => updateItem(activeItemIdx, { slideSubtitle: e.target.value })}
                      placeholder="Підзаголовок..."
                    />
                  </div>
                </div>
              )}

              {/* CTA toggle */}
              {items.length > 1 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeItem?.isCta || false}
                    onChange={(e) => {
                      // Unset CTA on all, then set on this
                      setItems((prev) =>
                        prev.map((item, i) => ({
                          ...item,
                          isCta: i === activeItemIdx ? e.target.checked : false,
                        }))
                      );
                    }}
                    className="w-3.5 h-3.5 accent-blue-500"
                  />
                  <span className="text-xs text-fg-muted">
                    CTA пост (містить посилання/кнопку — завжди останній)
                  </span>
                </label>
              )}
            </div>
          ) : (
            /* Media tab */
            <div className="space-y-4">
              {/* Image preview */}
              {activeItem?.imagePath ? (
                <div className="relative">
                  <img
                    src={activeItem.imagePath}
                    alt="Post image"
                    className="w-full max-h-64 object-contain rounded-lg border border-border"
                  />
                  <button
                    onClick={() => updateItem(activeItemIdx, { imagePath: null })}
                    className="absolute top-2 right-2 btn-danger text-xs px-2 py-1"
                  >
                    ✕ Видалити
                  </button>
                </div>
              ) : activeItem?.generationStatus === "generating" ? (
                <div className="h-32 skeleton rounded-lg flex items-center justify-center">
                  <p className="text-xs text-fg-muted animate-pulse">⏳ Генерується...</p>
                </div>
              ) : activeItem?.generationStatus === "failed" ? (
                <div className="h-20 bg-danger/10 border border-danger/20 rounded-lg flex items-center justify-center">
                  <p className="text-xs text-danger">❌ {activeItem.generationError || "Помилка генерації"}</p>
                </div>
              ) : (
                <div className="h-20 border border-dashed border-border rounded-lg flex items-center justify-center">
                  <p className="text-xs text-fg-subtle">Зображення відсутнє</p>
                </div>
              )}

              {/* Generator selector */}
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Генератор</label>
                <select
                  className="input"
                  value={activeItem?.imageType || ""}
                  onChange={(e) => updateItem(activeItemIdx, { imageType: e.target.value })}
                >
                  <option value="">Вибрати генератор</option>
                  {GENERATORS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>

              {/* Image prompt */}
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Промпт для зображення</label>
                <textarea
                  className="input min-h-20 resize-none text-xs"
                  value={activeItem?.imagePrompt || ""}
                  onChange={(e) => updateItem(activeItemIdx, { imagePrompt: e.target.value })}
                  placeholder="Опишіть зображення..."
                />
              </div>

              {/* Generate button */}
              <button
                onClick={() =>
                  triggerGeneration(
                    activeItem!.id,
                    activeItem?.imageType || "ai_flux",
                    activeItem?.imagePrompt || ""
                  )
                }
                disabled={!activeItem?.imageType || activeItem?.generationStatus === "generating"}
                className="btn-primary w-full justify-center py-2"
              >
                {activeItem?.generationStatus === "generating"
                  ? "⏳ Генерується..."
                  : "⚡ Згенерувати зображення"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
          <button onClick={deleteGroup} className="btn-danger text-xs">
            🗑 Видалити
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost text-xs">Скасувати</button>
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary text-xs"
            >
              {saving ? "Збереження..." : "Зберегти"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
