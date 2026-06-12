"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn, STATUS_META } from "@/lib/utils";

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
  number?: number;
  postDate: string;
  type: string;
  status: string;
  audience: string | null;
  scheduleTime: string | null;
  categoryId: string | null;
  personaId: string | null;
  socialNetwork: { id: string; name: string; platformKey: string; color?: string | null };
  category?: { id: string; name: string; color: string | null } | null;
  persona?: { id: string; name: string } | null;
  items: PostItem[];
}

interface Props {
  group: PostGroup;
  projectId?: string;
  onClose: () => void;
  onUpdate: () => void;
}

const GENERATORS = [
  { value: "ai_flux", label: "⚡ FLUX Schnell" },
  { value: "ai_flux_pro", label: "🚀 FLUX Pro 2K" },
  { value: "ai_ideogram", label: "🎨 Ideogram V3" },
  { value: "ai_recraft", label: "✏️ Recraft V4" },
  { value: "stories_photo", label: "📱 Stories Generator" },
  { value: "template", label: "🖼 Image Template" },
];

const AUDIENCE_OPTIONS = [
  { value: "cold", label: "❄️ Холодна" },
  { value: "warm1", label: "🌡 Тепла 1" },
  { value: "warm2", label: "🌡 Тепла 2" },
  { value: "hot1", label: "🔥 Гаряча 1" },
  { value: "hot2", label: "🔥 Гаряча 2" },
];

export function PostModal({ group, projectId, onClose, onUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<"content" | "media" | "settings">("content");
  const [activeItemIdx, setActiveItemIdx] = useState(0);
  const [items, setItems] = useState<PostItem[]>(group.items);
  const [status, setStatus] = useState(group.status);
  const [audience, setAudience] = useState(group.audience || "");
  const [scheduleTime, setScheduleTime] = useState(group.scheduleTime || "");
  const [categoryId, setCategoryId] = useState(group.categoryId || "");
  const [personaId, setPersonaId] = useState(group.personaId || "");
  const [saving, setSaving] = useState(false);
  const [charCounts, setCharCounts] = useState<Record<number, number>>({});

  const pid = projectId || "";

  // Load categories and personas for settings tab
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["categories", pid],
    queryFn: () => fetch(`/api/categories?projectId=${pid}`).then((r) => r.json()),
    enabled: !!pid && activeTab === "settings",
    staleTime: 60_000,
  });

  const { data: personas = [] } = useQuery<any[]>({
    queryKey: ["personas", pid],
    queryFn: () => fetch(`/api/personas?projectId=${pid}`).then((r) => r.json()),
    enabled: !!pid && activeTab === "settings",
    staleTime: 60_000,
  });

  const activeItem = items[activeItemIdx];

  // Update char count on content change
  useEffect(() => {
    setCharCounts((prev) => ({
      ...prev,
      [activeItemIdx]: activeItem?.content?.length || 0,
    }));
  }, [activeItem?.content, activeItemIdx]);

  function updateItem(idx: number, patch: Partial<PostItem>) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/posts/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          audience: audience || null,
          scheduleTime: scheduleTime || null,
          categoryId: categoryId || null,
          personaId: personaId || null,
          items,
        }),
      });
      onUpdate();
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup() {
    if (!confirm("Видалити цей пост? Цю дію не можна скасувати.")) return;
    await fetch(`/api/posts/${group.id}`, { method: "DELETE" });
    onUpdate();
  }

  async function triggerGeneration(itemId: string, imageType: string, prompt: string) {
    // Save first
    await fetch(`/api/posts/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    await fetch(`/api/posts/${group.id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, imageType, prompt }),
    });
    updateItem(activeItemIdx, { generationStatus: "generating" });
  }

  async function addItem() {
    const r = await fetch(`/api/posts/${group.id}/items`, { method: "POST" });
    const newItem = await r.json();
    setItems((prev) => [...prev, newItem]);
    setActiveItemIdx(items.length);
  }

  async function removeItem(itemId: string) {
    if (items.length <= 1) return;
    if (!confirm("Видалити цей слайд/пост?")) return;
    await fetch(`/api/posts/${group.id}/items?itemId=${itemId}`, { method: "DELETE" });
    const newItems = items.filter((i) => i.id !== itemId);
    setItems(newItems);
    setActiveItemIdx(Math.max(0, activeItemIdx - 1));
  }

  const typeLabel =
    group.type === "carousel" ? "🎠 Carousel"
    : group.type === "thread_chain" ? "🧵 Thread chain"
    : group.type === "stories" ? "📱 Stories"
    : "📝 Single";

  const platformColor = group.socialNetwork.color || "#3b82f6";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
          <div
            className="w-1 h-8 rounded-full shrink-0"
            style={{ backgroundColor: platformColor }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {group.number != null && (
                <span className="text-xs font-mono text-fg-subtle">#{group.number}</span>
              )}
              <span className="text-xs font-semibold text-fg">{typeLabel}</span>
              <span className="text-xs text-fg-subtle">·</span>
              <span className="text-xs text-fg-muted" style={{ color: platformColor }}>
                {group.socialNetwork.name}
              </span>
              <span className="text-xs text-fg-subtle">·</span>
              <span className="text-xs text-fg-muted">
                {new Date(group.postDate).toLocaleDateString("uk-UA", { day: "2-digit", month: "long", year: "numeric" })}
              </span>
              {group.category && (
                <>
                  <span className="text-xs text-fg-subtle">·</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{
                      backgroundColor: (group.category.color || "#64748b") + "22",
                      color: group.category.color || "#64748b"
                    }}
                  >
                    {group.category.name}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Status selector */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-xs bg-canvas border border-border rounded px-2 py-1 text-fg"
          >
            {Object.entries(STATUS_META).map(([val, meta]) => (
              <option key={val} value={val}>{(meta as any).label}</option>
            ))}
          </select>

          <button onClick={onClose} className="text-fg-subtle hover:text-fg transition-colors text-xl leading-none">×</button>
        </div>

        {/* Item tabs (multi-item posts) */}
        {(items.length > 1 || group.type !== "single") && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-canvas shrink-0 overflow-x-auto">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-center shrink-0">
                <button
                  onClick={() => setActiveItemIdx(idx)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                    activeItemIdx === idx
                      ? "bg-accent text-white"
                      : "text-fg-muted hover:text-fg hover:bg-border/40"
                  )}
                >
                  <span>{idx + 1}</span>
                  {item.isCta && <span className="text-[9px] opacity-80 bg-white/20 px-1 rounded">CTA</span>}
                  {item.generationStatus === "generating" && <span className="animate-pulse text-[10px]">⏳</span>}
                  {item.generationStatus === "done" && item.imagePath && <span className="text-[10px]">🖼</span>}
                  {item.generationStatus === "failed" && <span className="text-[10px]">❌</span>}
                </button>
                {items.length > 1 && activeItemIdx === idx && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-fg-subtle hover:text-danger ml-0.5 text-xs transition-colors"
                    title="Видалити слайд"
                  >×</button>
                )}
              </div>
            ))}
            <button
              onClick={addItem}
              className="px-2 py-1 rounded-lg text-xs text-fg-subtle hover:text-accent hover:bg-border/30 transition-colors shrink-0 ml-1"
            >
              + Додати
            </button>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-0 px-5 border-b border-border shrink-0 bg-canvas">
          {(["content", "media", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-accent text-accent"
                  : "border-transparent text-fg-muted hover:text-fg"
              )}
            >
              {tab === "content" ? "✏️ Контент" : tab === "media" ? "🖼 Медіа" : "⚙️ Налаштування"}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {activeTab === "content" && (
            <div className="space-y-4">
              {/* Character count bar for platform limits */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-fg-muted">
                    {group.type === "thread_chain"
                      ? `Пост ${activeItemIdx + 1} з ${items.length}`
                      : group.type === "carousel"
                      ? `Слайд ${activeItemIdx + 1}`
                      : "Текст поста"}
                    {activeItem?.isCta && (
                      <span className="ml-2 text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded-md">CTA</span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px]",
                      (charCounts[activeItemIdx] || 0) > 500 ? "text-warn" : "text-fg-subtle"
                    )}>
                      {charCounts[activeItemIdx] || 0} символів
                    </span>
                  </div>
                </div>
                <textarea
                  className="input min-h-36 resize-none font-mono text-xs leading-relaxed"
                  value={activeItem?.content || ""}
                  onChange={(e) => {
                    updateItem(activeItemIdx, { content: e.target.value });
                    setCharCounts((prev) => ({ ...prev, [activeItemIdx]: e.target.value.length }));
                  }}
                  placeholder={
                    group.type === "thread_chain"
                      ? `Пост ${activeItemIdx + 1}${activeItemIdx === items.length - 1 ? " (фінальний — додайте посилання/CTA)..." : "..."}`
                      : "Текст поста..."
                  }
                />
              </div>

              {/* Carousel slide fields */}
              {group.type === "carousel" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1.5">Заголовок слайду</label>
                    <input
                      className="input"
                      value={activeItem?.slideTitle || ""}
                      onChange={(e) => updateItem(activeItemIdx, { slideTitle: e.target.value })}
                      placeholder="Заголовок..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1.5">Підзаголовок</label>
                    <input
                      className="input"
                      value={activeItem?.slideSubtitle || ""}
                      onChange={(e) => updateItem(activeItemIdx, { slideSubtitle: e.target.value })}
                      placeholder="Підзаголовок..."
                    />
                  </div>
                </div>
              )}

              {/* CTA toggle — for multi-item posts */}
              {items.length > 1 && (
                <label className="flex items-center gap-2 cursor-pointer select-none p-3 bg-border/20 rounded-xl border border-border/40">
                  <input
                    type="checkbox"
                    checked={activeItem?.isCta || false}
                    onChange={(e) => {
                      setItems((prev) =>
                        prev.map((item, i) => ({
                          ...item,
                          isCta: i === activeItemIdx ? e.target.checked : false,
                        }))
                      );
                    }}
                    className="w-4 h-4 accent-blue-500"
                  />
                  <div>
                    <span className="text-xs font-medium text-fg">CTA пост</span>
                    <p className="text-[10px] text-fg-muted">Цей пост містить посилання або кнопку дії. Завжди має бути останнім у ланцюжку.</p>
                  </div>
                </label>
              )}

              {/* Quick tip for threads */}
              {group.type === "thread_chain" && activeItemIdx === items.length - 1 && (
                <div className="text-xs text-fg-subtle bg-accent/5 border border-accent/20 rounded-xl p-3">
                  💡 Останній пост у Threads — ідеальне місце для посилання на бота або CTA
                </div>
              )}
            </div>
          )}

          {activeTab === "media" && (
            <div className="space-y-4">
              {/* Image preview */}
              {activeItem?.imagePath ? (
                <div className="relative group/img">
                  <img
                    src={activeItem.imagePath}
                    alt="Post image"
                    className="w-full max-h-72 object-contain rounded-xl border border-border"
                  />
                  <button
                    onClick={() => updateItem(activeItemIdx, { imagePath: null })}
                    className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity btn-danger text-xs px-2 py-1"
                  >
                    ✕ Видалити
                  </button>
                  <div className="absolute bottom-2 left-2 bg-canvas/80 backdrop-blur-sm rounded-lg px-2 py-1">
                    <p className="text-[10px] text-fg-muted">
                      {activeItem.imageType && `Генератор: ${activeItem.imageType}`}
                    </p>
                  </div>
                </div>
              ) : activeItem?.generationStatus === "generating" ? (
                <div className="h-48 skeleton rounded-xl flex flex-col items-center justify-center gap-2">
                  <p className="text-sm animate-pulse">⏳</p>
                  <p className="text-xs text-fg-muted animate-pulse">Генерується зображення...</p>
                </div>
              ) : activeItem?.generationStatus === "failed" ? (
                <div className="h-24 bg-danger/10 border border-danger/20 rounded-xl flex flex-col items-center justify-center gap-1">
                  <p className="text-sm">❌</p>
                  <p className="text-xs text-danger">{activeItem.generationError || "Помилка генерації"}</p>
                </div>
              ) : (
                <div className="h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-fg-subtle">
                  <p className="text-2xl">🖼</p>
                  <p className="text-xs">Зображення відсутнє</p>
                </div>
              )}

              {/* Generator */}
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Генератор</label>
                <div className="grid grid-cols-2 gap-2">
                  {GENERATORS.map((g) => (
                    <button
                      key={g.value}
                      onClick={() => updateItem(activeItemIdx, { imageType: g.value })}
                      className={cn(
                        "px-3 py-2 rounded-lg border text-xs font-medium transition-colors text-left",
                        activeItem?.imageType === g.value
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-fg-muted hover:border-border/60 hover:bg-border/20"
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">
                  Промпт для зображення
                </label>
                <textarea
                  className="input min-h-24 resize-none text-xs leading-relaxed"
                  value={activeItem?.imagePrompt || ""}
                  onChange={(e) => updateItem(activeItemIdx, { imagePrompt: e.target.value })}
                  placeholder="Детально опишіть зображення: стиль, кольори, композицію, настрій..."
                />
                <p className="text-[10px] text-fg-subtle mt-1">
                  💡 Чим детальніший промпт — тим кращий результат
                </p>
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
                disabled={!activeItem?.imageType || !activeItem?.imagePrompt || activeItem?.generationStatus === "generating"}
                className="btn-primary w-full justify-center py-2.5"
              >
                {activeItem?.generationStatus === "generating"
                  ? "⏳ Генерується — зачекайте..."
                  : "⚡ Згенерувати зображення"}
              </button>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-4">
              {/* Audience */}
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">🎯 Аудиторія</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setAudience("")}
                    className={cn("px-3 py-1.5 rounded-lg border text-xs transition-colors",
                      !audience ? "border-accent bg-accent/10 text-accent" : "border-border text-fg-muted hover:bg-border/20"
                    )}
                  >
                    Не вказано
                  </button>
                  {AUDIENCE_OPTIONS.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => setAudience(a.value)}
                      className={cn("px-3 py-1.5 rounded-lg border text-xs transition-colors",
                        audience === a.value ? "border-accent bg-accent/10 text-accent" : "border-border text-fg-muted hover:bg-border/20"
                      )}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule time */}
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">⏰ Час відправки</label>
                <input
                  type="time"
                  className="input w-40"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
                <p className="text-[10px] text-fg-subtle mt-1">
                  Якщо порожньо — відправляється за розкладом проекту
                </p>
              </div>

              {/* Category */}
              {categories.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1.5">📁 Категорія</label>
                  <select
                    className="input"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">Без категорії</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Persona */}
              {personas.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1.5">👤 Персонаж (аудиторія)</label>
                  <select
                    className="input"
                    value={personaId}
                    onChange={(e) => setPersonaId(e.target.value)}
                  >
                    <option value="">Не прив'язано</option>
                    {personas.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.type ? `(${p.type})` : ""}
                      </option>
                    ))}
                  </select>
                  {personaId && personas.find((p: any) => p.id === personaId)?.tone && (
                    <p className="text-[10px] text-fg-subtle mt-1">
                      🗣 Тон: {personas.find((p: any) => p.id === personaId)?.tone}
                    </p>
                  )}
                </div>
              )}

              {(categories.length === 0 && personas.length === 0) && (
                <div className="text-xs text-fg-muted text-center py-4 bg-border/10 rounded-xl border border-dashed border-border">
                  Категорій та персонажів ще немає.{" "}
                  <a href="/categories" className="text-accent hover:underline">Створіть їх →</a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
          <button onClick={deleteGroup} className="btn-danger text-xs px-3 py-1.5">
            🗑 Видалити
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost text-xs px-3 py-1.5">Скасувати</button>
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary text-xs px-4 py-1.5"
            >
              {saving ? "Збереження..." : "💾 Зберегти"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
