"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Topic {
  id: string;
  rubric: string;
  title: string;
  notes: string | null;
  platforms: string[];
  status: string;
  timesUsed: number;
  isActive: boolean;
}

interface Props {
  projectId: string;
}

const RUBRICS = [
  { key: "galuzi", label: "🏗 Автоматизація по галузях" },
  { key: "benefits", label: "📈 Користь автоматизації" },
  { key: "problems", label: "🧩 Проблеми в командах" },
  { key: "nuances", label: "⚙️ Нюанси автоматизації" },
  { key: "cases", label: "📁 Кейси з практики" },
  { key: "theoretical", label: "🤔 Теоретичні ситуації" },
  { key: "heroes", label: "🦸 Цікаві герої" },
  { key: "tools", label: "🛠 Інструменти та новини" },
  { key: "personal", label: "🏍 Особисте / філософія" },
];

const STATUSES = [
  { key: "idea", label: "Ідея", cls: "bg-border/50 text-fg-subtle" },
  { key: "planned", label: "У плані", cls: "bg-accent/15 text-accent" },
  { key: "used", label: "Використано", cls: "bg-green-500/15 text-green-600" },
];

const PLATFORM_OPTIONS = [
  { key: "instagram_posts", label: "IG" },
  { key: "instagram_stories", label: "Stories" },
  { key: "threads", label: "Threads" },
  { key: "telegram", label: "Telegram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "tiktok", label: "TikTok" },
];

const empty = { rubric: "galuzi", title: "", notes: "", platforms: [] as string[], status: "idea" };

export function TopicsView({ projectId }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Topic | null>(null);
  const [form, setForm] = useState<typeof empty | null>(null);

  const { data: topics = [], isLoading } = useQuery<Topic[]>({
    queryKey: ["topics", projectId],
    queryFn: () => fetch(`/api/topics?projectId=${projectId}`).then((r) => r.json()),
    staleTime: 15_000,
  });

  function refresh() { qc.invalidateQueries({ queryKey: ["topics", projectId] }); }

  async function save() {
    if (!form || !form.title.trim()) return;
    if (editing) {
      await fetch(`/api/topics/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      await fetch(`/api/topics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, ...form }) });
    }
    setForm(null); setEditing(null); refresh();
  }

  async function patch(t: Topic, data: Partial<Topic>) {
    await fetch(`/api/topics/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Видалити тему?")) return;
    await fetch(`/api/topics/${id}`, { method: "DELETE" });
    refresh();
  }

  const counts = { total: topics.length, used: topics.filter((t) => t.status === "used").length, idea: topics.filter((t) => t.status === "idea").length };

  return (
    <div className="flex flex-col h-[calc(100vh-40px)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-canvas-subtle shrink-0">
        <div>
          <p className="text-sm font-semibold text-fg">Банк тем</p>
          <p className="text-xs text-fg-muted">Теми для генерації постів · {counts.total} всього · {counts.idea} ідей · {counts.used} використано</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ ...empty }); }} className="btn-primary text-xs px-3 py-1">+ Нова тема</button>
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-4xl">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
        ) : topics.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-3">💡</div>
            <p className="text-sm font-medium text-fg-muted">Банк тем порожній</p>
            <p className="text-xs text-fg-subtle mt-1 max-w-xs">Додавайте теми по рубриках — бот генеруватиме пости саме з вашого банку і не повторюватиметься</p>
            <button onClick={() => { setEditing(null); setForm({ ...empty }); }} className="btn-primary text-xs px-4 py-2 mt-4">+ Додати першу тему</button>
          </div>
        ) : (
          <div className="space-y-5">
            {RUBRICS.map((r) => {
              const list = topics.filter((t) => t.rubric === r.key);
              if (list.length === 0) return null;
              return (
                <div key={r.key}>
                  <p className="text-xs font-semibold text-fg-muted mb-2">{r.label} <span className="text-fg-subtle">({list.length})</span></p>
                  <div className="space-y-1.5">
                    {list.map((t) => {
                      const st = STATUSES.find((s) => s.key === t.status) || STATUSES[0];
                      return (
                        <div key={t.id} className={cn("border rounded-lg px-3 py-2 flex items-start justify-between gap-3", t.isActive ? "border-border bg-canvas-subtle" : "border-border/40 opacity-50")}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-fg">{t.title}</p>
                            {t.notes && <p className="text-xs text-fg-subtle mt-0.5">{t.notes}</p>}
                            <div className="flex gap-1 mt-1 flex-wrap items-center">
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded", st.cls)}>{st.label}</span>
                              {t.timesUsed > 0 && <span className="text-[10px] text-fg-subtle">×{t.timesUsed}</span>}
                              {(t.platforms as string[]).map((p) => (
                                <span key={p} className="text-[10px] px-1.5 py-0.5 bg-border/50 text-fg-subtle rounded">{PLATFORM_OPTIONS.find((o) => o.key === p)?.label || p}</span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <select value={t.status} onChange={(e) => patch(t, { status: e.target.value })} className="text-[10px] bg-transparent border border-border rounded px-1 py-0.5 text-fg-muted">
                              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                            <button onClick={() => { setEditing(t); setForm({ rubric: t.rubric, title: t.title, notes: t.notes || "", platforms: t.platforms as string[], status: t.status }); }} className="text-xs text-fg-muted hover:text-fg px-1">✏️</button>
                            <button onClick={() => remove(t.id)} className="text-xs text-fg-muted hover:text-red-500 px-1">🗑</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setForm(null)}>
          <div className="bg-canvas border border-border rounded-xl p-4 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-fg">{editing ? "Редагувати тему" : "Нова тема"}</p>
            <div>
              <label className="text-xs text-fg-muted">Рубрика</label>
              <select value={form.rubric} onChange={(e) => setForm({ ...form, rubric: e.target.value })} className="w-full mt-1 bg-canvas-subtle border border-border rounded px-2 py-1.5 text-sm text-fg">
                {RUBRICS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-fg-muted">Тема</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="напр. Що автоматизувати в стоматології" className="w-full mt-1 bg-canvas-subtle border border-border rounded px-2 py-1.5 text-sm text-fg" autoFocus />
            </div>
            <div>
              <label className="text-xs text-fg-muted">Нотатки (опційно)</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full mt-1 bg-canvas-subtle border border-border rounded px-2 py-1.5 text-sm text-fg" />
            </div>
            <div>
              <label className="text-xs text-fg-muted">Мережі (опційно)</label>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {PLATFORM_OPTIONS.map((p) => {
                  const on = form.platforms.includes(p.key);
                  return (
                    <button key={p.key} onClick={() => setForm({ ...form, platforms: on ? form.platforms.filter((x) => x !== p.key) : [...form.platforms, p.key] })}
                      className={cn("text-[11px] px-2 py-0.5 rounded border", on ? "bg-accent/15 text-accent border-accent/40" : "border-border text-fg-subtle")}>{p.label}</button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setForm(null)} className="text-xs px-3 py-1 text-fg-muted">Скасувати</button>
              <button onClick={save} className="btn-primary text-xs px-3 py-1">{editing ? "Зберегти" : "Додати"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
