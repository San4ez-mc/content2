"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn, formatDate } from "@/lib/utils";

interface SocialNetwork {
  id: string;
  name: string;
  platformKey: string;
  color?: string | null;
}

interface Props {
  date: string;
  projectId: string;
  socialNetworks: SocialNetwork[];
  onClose: () => void;
  onCreated: () => void;
}

const POST_TYPES = [
  { value: "single", label: "📝", title: "Single", desc: "Один пост" },
  { value: "carousel", label: "🎠", title: "Carousel", desc: "Кілька слайдів" },
  { value: "thread_chain", label: "🧵", title: "Thread", desc: "Ланцюжок" },
  { value: "stories", label: "📱", title: "Stories", desc: "Серія stories" },
];

export function QuickCreateModal({ date, projectId, socialNetworks, onClose, onCreated }: Props) {
  const [networkId, setNetworkId] = useState(socialNetworks[0]?.id || "");
  const [type, setType] = useState("single");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("draft");
  const [scheduleTime, setScheduleTime] = useState("");
  const [loading, setLoading] = useState(false);

  // Load categories for selected network
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["categories", projectId],
    queryFn: () => fetch(`/api/categories?projectId=${projectId}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const networkCategories = categories.filter(
    (c: any) => c.socialNetworkId === networkId
  );

  const [categoryId, setCategoryId] = useState("");

  const selectedNetwork = socialNetworks.find((n) => n.id === networkId);

  const displayDate = formatDate(new Date(date + "T12:00:00"));

  async function create() {
    setLoading(true);
    try {
      await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          socialNetworkId: networkId,
          postDate: date,
          type,
          status,
          content,
          categoryId: categoryId || undefined,
          scheduleTime: scheduleTime || undefined,
        }),
      });
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  async function createWithAI() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/posts/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          socialNetworkId: networkId,
          postDate: date,
          type,
          prompt: content,
          categoryId: categoryId || undefined,
        }),
      });
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-canvas-subtle border border-border rounded-xl shadow-2xl w-full max-w-md animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-fg">Новий пост</h3>
            <p className="text-xs text-fg-muted mt-0.5">{displayDate}</p>
          </div>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Platform selector */}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-2">Платформа</label>
            <div className="flex flex-wrap gap-2">
              {socialNetworks.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setNetworkId(n.id); setCategoryId(""); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                    networkId === n.id
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-fg-muted hover:bg-border/20"
                  )}
                  style={networkId === n.id ? { borderColor: n.color || undefined, color: n.color || undefined, backgroundColor: (n.color || "#3b82f6") + "15" } : undefined}
                >
                  {n.name}
                </button>
              ))}
            </div>
          </div>

          {/* Post type */}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-2">Тип</label>
            <div className="grid grid-cols-4 gap-1.5">
              {POST_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-2 rounded-xl border text-xs transition-colors",
                    type === t.value
                      ? "border-accent bg-accent/10"
                      : "border-border text-fg-muted hover:bg-border/20"
                  )}
                >
                  <span className="text-lg">{t.label}</span>
                  <span className={cn("font-medium text-[10px]", type === t.value ? "text-accent" : "text-fg-muted")}>
                    {t.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">
              Текст або запит до AI
            </label>
            <textarea
              className="input min-h-20 resize-none text-xs leading-relaxed"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={content === "" ? "Введіть текст поста або опишіть AI що генерувати..." : undefined}
              autoFocus
            />
          </div>

          {/* Category + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Категорія</label>
              <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Без категорії</option>
                {networkCategories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                {networkCategories.length === 0 && categories.length > 0 && (
                  <optgroup label="Інші">
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Статус</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="draft">Чернетка</option>
                <option value="scheduled">Заплановано</option>
              </select>
            </div>
          </div>

          {/* Schedule time (shown when scheduled) */}
          {status === "scheduled" && (
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">⏰ Час відправки</label>
              <input
                type="time"
                className="input w-32"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={create}
            disabled={loading}
            className="btn-ghost flex-1 justify-center text-xs py-2"
          >
            💾 Зберегти
          </button>
          <button
            onClick={createWithAI}
            disabled={loading || !content.trim()}
            className="btn-primary flex-1 justify-center text-xs py-2"
          >
            ⚡ Генерувати з AI
          </button>
        </div>
      </div>
    </div>
  );
}
