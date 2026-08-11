"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn, STATUS_META } from "@/lib/utils";
import { PostConstructor } from "./PostConstructor";

// #244 Теми (наміри) контенту — Ф3.6
const INTENT_LABELS: Record<string, string> = {
  educate: "Навчання",
  sell: "Продаж",
  trust: "Довіра",
  storytelling: "Історія",
  entertainment: "Розвага",
};

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
  formatKey?: string | null;
  topic?: string | null;
  intent?: string | null;
  structureId?: string | null;
  evidenceType?: string | null;
  hookA?: string | null;
  hookB?: string | null;
  hookSelected?: string | null;
  cta?: string | null;
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
  const [postDate, setPostDate] = useState(group.postDate.slice(0, 10));
  const [audience, setAudience] = useState(group.audience || "");
  const [scheduleTime, setScheduleTime] = useState(group.scheduleTime || "");
  const [personaId, setPersonaId] = useState(group.personaId || "");
  const [formatKey, setFormatKey] = useState(group.formatKey || "");
  const [topic, setTopic] = useState(group.topic || "");
  const [storageUrl, setStorageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [charCounts, setCharCounts] = useState<Record<number, number>>({});
  const [comment, setComment] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenMsg, setRegenMsg] = useState("");

  const pid = projectId || "";

  const { data: formats = [] } = useQuery<any[]>({
    queryKey: ["formats", group.socialNetwork.id],
    queryFn: () => fetch(`/api/formats?networkId=${group.socialNetwork.id}`).then((r) => r.json()),
    enabled: activeTab === "settings",
    staleTime: 60_000,
  });

  const { data: personas = [] } = useQuery<any[]>({
    queryKey: ["personas", pid],
    queryFn: () => fetch(`/api/personas?projectId=${pid}`).then((r) => r.json()),
    enabled: !!pid && activeTab === "settings",
    staleTime: 60_000,
  });

  const activeItem = items[activeItemIdx];

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
          postDate: postDate || undefined,
          audience: audience || null,
          scheduleTime: scheduleTime || null,
          personaId: personaId || null,
          formatKey: formatKey || null,
          topic: topic || null,
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

  async function regenerateWithComment() {
    if (regenerating) return;
    setRegenerating(true);
    setRegenMsg("");
    try {
      // Get or create chat session
      let sessionKey: string | null = null;
      try {
        const sr = await fetch("/api/chat/session", { method: "POST" });
        const sd = await sr.json();
        sessionKey = sd.sessionKey || sd.key || null;
      } catch {}

      const postContent = items.map((it, i) =>
        items.length > 1 ? `[${i + 1}] ${it.content || ""}` : it.content || ""
      ).join("\n\n");

      // Структуровані параметри поста (з поточного стану редактора) — щоб генератор
      // тримав усе незмінним і змінив ЛИШЕ те, що ти правиш (напр. тему).
      const personaName = personas.find((p: any) => p.id === personaId)?.name || "";
      const atomsLines = [
        formatKey ? `Формат: ${formatKey}` : "",
        group.structureId ? `Структура: ${group.structureId}` : "",
        personaName ? `Персона: ${personaName}` : "",
        topic ? `Тема: ${topic}` : "",
        group.intent ? `Намір: ${group.intent}` : "",
      ].filter(Boolean);

      const text = [
        `Перегенеруй пост #${group.number ?? group.id.slice(0, 6)} (${group.socialNetwork.name}, ${postDate}):`,
        "",
        "--- Поточний текст ---",
        postContent,
        "--- Кінець тексту ---",
        "",
        atomsLines.length ? "ТРИМАЙ ці параметри незмінними (зміни лише те, що в правках нижче):" : "",
        ...atomsLines.map((l) => "- " + l),
        "",
        comment.trim() ? `Правки від автора:\n${comment.trim()}` : "Перегенеруй з урахуванням кращих практик для цієї мережі.",
      ].filter((l) => l !== "").join("\n");

      if (sessionKey) {
        await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey, text }),
        });
        setRegenMsg("✅ Запит надіслано в чат-менеджер. Відповідь з'явиться в чаті.");
      } else {
        setRegenMsg("⚠️ Не вдалося підключитися до чат-менеджера. Спробуйте відкрити чат вручну.");
      }
      setComment("");
    } catch (e) {
      setRegenMsg("❌ Помилка надсилання запиту.");
    } finally {
      setRegenerating(false);
    }
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
              {/* Editable date */}
              <input
                type="date"
                value={postDate}
                onChange={(e) => setPostDate(e.target.value)}
                className="text-xs text-fg-muted bg-transparent border-b border-dashed border-border hover:border-accent focus:border-accent focus:outline-none cursor-pointer"
                title="Натисніть щоб змінити дату"
              />
              {/* #244 Тема (намір) створення */}
              {group.intent && INTENT_LABELS[group.intent] && (
                <>
                  <span className="text-xs text-fg-subtle">·</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-canvas-subtle text-fg-muted border border-border"
                    title="Тема (намір) контенту при створенні"
                  >
                    🎯 {INTENT_LABELS[group.intent]}
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
              {/* Character count bar */}
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

              {/* CTA toggle */}
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

              {group.type === "thread_chain" && activeItemIdx === items.length - 1 && (
                <div className="text-xs text-fg-subtle bg-accent/5 border border-accent/20 rounded-xl p-3">
                  💡 Останній пост у Threads — ідеальне місце для посилання на бота або CTA
                </div>
              )}

              {/* ── Regenerate section ── */}
              <div className="border border-border/60 rounded-xl p-3 space-y-2 bg-canvas-subtle">
                <label className="block text-xs font-medium text-fg-muted">
                  💬 Коментар для перегенерації
                </label>
                <textarea
                  className="input min-h-16 resize-none text-xs"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Що змінити? Напр: «Зроби більш емоційно», «Скорот до 200 символів», «Додай заклик до дії»..."
                />
                <button
                  onClick={regenerateWithComment}
                  disabled={regenerating}
                  className="btn-primary text-xs px-4 py-2 w-full justify-center"
                >
                  {regenerating ? "⏳ Надсилається..." : "🔄 Перегенерувати пост"}
                </button>
                {regenMsg && (
                  <p className="text-[11px] text-fg-muted">{regenMsg}</p>
                )}
              </div>
            </div>
          )}

          {activeTab === "media" && (
            <div className="space-y-4">
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

              <div className="pt-1 border-t border-border/40">
                <label className="block text-xs font-medium text-fg-muted mb-1.5">📁 Або зі сховища (готовий файл)</label>
                <div className="flex gap-2">
                  <input
                    className="input text-xs flex-1"
                    value={storageUrl}
                    onChange={(e) => setStorageUrl(e.target.value)}
                    placeholder="https://… посилання на файл зі Сховища"
                  />
                  <button
                    onClick={() => { if (storageUrl.trim()) { updateItem(activeItemIdx, { imagePath: storageUrl.trim(), generationStatus: "done" }); setStorageUrl(""); } }}
                    className="btn-ghost text-xs px-3 shrink-0"
                  >
                    Використати
                  </button>
                </div>
                <p className="text-[11px] text-fg-subtle mt-1">Скинь файл на сторінці «Сховище» → встав сюди посилання (джерело = сховище). Порожньо → воронка згенерує сама (авто).</p>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-4">
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

              {formats.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1.5">🧩 Формат</label>
                  <select className="input" value={formatKey} onChange={(e) => setFormatKey(e.target.value)}>
                    <option value="">Не вказано</option>
                    {formats.map((f: any) => (
                      <option key={f.id} value={f.key}>{f.name} ({f.aspect || "—"})</option>
                    ))}
                  </select>
                  {formatKey && formats.find((f: any) => f.key === formatKey)?.mediaTypes?.length > 0 && (
                    <p className="text-[11px] text-fg-subtle mt-1">Медіа: {(formats.find((f: any) => f.key === formatKey)?.mediaTypes || []).join(", ")}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">💡 Тема</label>
                <textarea
                  className="input text-xs resize-none"
                  rows={2}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Про що пост. Зміни тему і натисни «Перегенерувати» — решта (формат, структура, персона) лишиться."
                />
                <p className="text-[11px] text-fg-subtle mt-1">Змінюй тему тут → перегенерація тримає інші параметри незмінними.</p>
              </div>

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

              {personas.length === 0 && (
                <div className="text-xs text-fg-muted text-center py-4 bg-border/10 rounded-xl border border-dashed border-border">
                  Персон ще немає.{" "}
                  <a href="/personas" className="text-accent hover:underline">Створіть їх →</a>
                </div>
              )}

              {/* #248 Конструктор поста + бали ефективності елементів */}
              {pid && (
                <PostConstructor
                  postId={group.id}
                  projectId={pid}
                  group={{
                    intent: group.intent, structureId: group.structureId, evidenceType: group.evidenceType,
                    hookA: group.hookA, hookB: group.hookB, hookSelected: group.hookSelected, cta: group.cta,
                  }}
                  onSaved={onUpdate}
                />
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
