"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface ContentType {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  tone: string | null;
  structure: string | null;
  platforms: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

interface Props {
  projectId: string;
}

const PLATFORM_OPTIONS = [
  { key: "instagram_posts", label: "Instagram Posts" },
  { key: "instagram_stories", label: "Instagram Stories" },
  { key: "instagram_reels", label: "Reels" },
  { key: "threads", label: "Threads" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "tiktok", label: "TikTok" },
];

const TONE_OPTIONS = [
  { value: "", label: "Не вказано" },
  { value: "formal", label: "Офіційний" },
  { value: "casual", label: "Розмовний" },
  { value: "friendly", label: "Дружній" },
  { value: "expert", label: "Експертний" },
  { value: "emotional", label: "Емоційний" },
  { value: "inspirational", label: "Надихаючий" },
];

export function ContentTypesView({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ContentType | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: types = [], isLoading } = useQuery<ContentType[]>({
    queryKey: ["contentTypes", projectId],
    queryFn: () => fetch(`/api/content-types?projectId=${projectId}`).then((r) => r.json()),
    staleTime: 30_000,
  });

  async function toggleActive(type: ContentType) {
    await fetch(`/api/content-types/${type.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !type.isActive }),
    });
    queryClient.invalidateQueries({ queryKey: ["contentTypes", projectId] });
  }

  async function deleteType(id: string) {
    if (!confirm("Видалити тип контенту?")) return;
    await fetch(`/api/content-types/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["contentTypes", projectId] });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-40px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-canvas-subtle shrink-0">
        <div>
          <p className="text-sm font-semibold text-fg">Типи контенту</p>
          <p className="text-xs text-fg-muted">Шаблони з AI-промптами для генерації постів</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary text-xs px-3 py-1">
          + Новий тип
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 max-w-4xl">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
          </div>
        ) : types.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-3">📝</div>
            <p className="text-sm font-medium text-fg-muted">Немає типів контенту</p>
            <p className="text-xs text-fg-subtle mt-1 max-w-xs">Створіть шаблони для AI-генерації — задайте тон, структуру та промпт для кожного типу посту</p>
            <button onClick={() => setCreating(true)} className="btn-primary text-xs px-4 py-2 mt-4">
              + Створити перший тип
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {types.map((type) => (
              <div
                key={type.id}
                className={cn("border rounded-xl p-4 transition-colors", type.isActive
                  ? "border-border bg-canvas-subtle"
                  : "border-border/40 bg-canvas-subtle/50 opacity-60")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-fg">{type.name}</h3>
                      {type.tone && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-accent/15 text-accent rounded">
                          {TONE_OPTIONS.find((t) => t.value === type.tone)?.label || type.tone}
                        </span>
                      )}
                      {!type.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-border text-fg-subtle rounded">вимкнено</span>
                      )}
                    </div>
                    {type.description && (
                      <p className="text-xs text-fg-muted mt-0.5">{type.description}</p>
                    )}
                    {(type.platforms as string[]).length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {(type.platforms as string[]).map((p) => (
                          <span key={p} className="text-[10px] px-1.5 py-0.5 bg-border/50 text-fg-subtle rounded">
                            {PLATFORM_OPTIONS.find((o) => o.key === p)?.label || p}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 p-2 bg-canvas rounded-lg border border-border/50">
                      <p className="text-[10px] text-fg-subtle uppercase tracking-wide mb-1">Промпт</p>
                      <p className="text-xs text-fg line-clamp-2">{type.prompt}</p>
                    </div>
                    {type.structure && (
                      <div className="mt-2 p-2 bg-canvas rounded-lg border border-border/50">
                        <p className="text-[10px] text-fg-subtle uppercase tracking-wide mb-1">Структура</p>
                        <p className="text-xs text-fg line-clamp-2">{type.structure}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive(type)}
                      className={cn("text-xs px-2 py-1 rounded transition-colors",
                        type.isActive ? "text-success hover:bg-success/10" : "text-fg-muted hover:bg-border/30")}
                      title={type.isActive ? "Вимкнути" : "Увімкнути"}
                    >
                      {type.isActive ? "✓" : "○"}
                    </button>
                    <button
                      onClick={() => setEditing(type)}
                      className="btn-ghost text-xs px-2 py-1"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteType(type.id)}
                      className="text-xs px-2 py-1 text-danger hover:bg-danger/10 rounded transition-colors"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <ContentTypeModal
          projectId={projectId}
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["contentTypes", projectId] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ContentTypeModal({ projectId, initial, onClose, onSaved }: {
  projectId: string;
  initial: ContentType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [prompt, setPrompt] = useState(initial?.prompt || "");
  const [tone, setTone] = useState(initial?.tone || "");
  const [structure, setStructure] = useState(initial?.structure || "");
  const [platforms, setPlatforms] = useState<string[]>((initial?.platforms as string[]) || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function togglePlatform(key: string) {
    setPlatforms((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  }

  async function save() {
    if (!name.trim() || !prompt.trim()) { setError("Назва та промпт обов'язкові"); return; }
    setSaving(true);
    setError("");
    try {
      const body = { projectId, name, description: description || null, prompt, tone: tone || null, structure: structure || null, platforms };
      const url = initial ? `/api/content-types/${initial.id}` : "/api/content-types";
      const method = initial ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Помилка"); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="bg-canvas-subtle border border-border rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold text-fg">{initial ? "Редагувати тип" : "Новий тип контенту"}</h3>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg text-lg">×</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg p-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Назва *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Наприклад: Освітній пост" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Тон</label>
              <select className="input" value={tone} onChange={(e) => setTone(e.target.value)}>
                {TONE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Опис</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Короткий опис типу..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">AI Промпт *</label>
            <textarea
              className="input resize-none"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Системний промпт для AI — опишіть стиль, завдання та формат посту..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Структура посту</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={structure}
              onChange={(e) => setStructure(e.target.value)}
              placeholder="Наприклад: 1. Хук (1-2 речення)\n2. Основна частина\n3. CTA"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Платформи</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_OPTIONS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => togglePlatform(p.key)}
                  className={cn("text-xs px-2.5 py-0.5 rounded-full border transition-colors",
                    platforms.includes(p.key)
                      ? "bg-accent text-white border-accent"
                      : "text-fg-muted border-border hover:border-accent/50")}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5 shrink-0">
          <button onClick={onClose} className="btn-ghost flex-1 text-xs py-2">Скасувати</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 text-xs py-2">
            {saving ? "Збереження..." : (initial ? "Зберегти" : "Створити")}
          </button>
        </div>
      </div>
    </div>
  );
}
