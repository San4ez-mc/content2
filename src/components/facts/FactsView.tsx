"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Fact {
  id: string;
  topic: string | null;
  title: string;
  content: string;
  status: "active" | "scheduled" | "outdated";
  validFrom: string | null;
  validUntil: string | null;
  supersededAt: string | null;
  addedBy: string;
  createdAt: string;
  staleMarkers: string[];
}

interface FactsResponse {
  today: string;
  facts: Fact[];
  stalePosts: { number: number; date: string; markers: string[] }[];
}

const fmt = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(2, 4)}` : "");
const fmtTs = (iso: string) => fmt(iso.slice(0, 10));

const SECTIONS: { key: Fact["status"]; title: string; hint: string; cls: string }[] = [
  { key: "active", title: "✅ Актуально зараз", hint: "Це бот використовує в постах і відповідях", cls: "border-green-500/40 bg-green-500/5" },
  { key: "scheduled", title: "⏳ Заплановано", hint: "Ще не діє: стане актуальним з вказаної дати", cls: "border-accent/40 bg-accent/5" },
  { key: "outdated", title: "🗄 Застаріло", hint: "У постах не використовується; зберігається для історії", cls: "border-border/40 opacity-70" },
];

const empty = { topic: "", title: "", content: "", valid_from: "", valid_until: "", stale_markers: "" };

export function FactsView({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof empty | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery<FactsResponse>({
    queryKey: ["facts", projectId],
    queryFn: () => fetch(`/api/facts?projectId=${projectId}`).then((r) => r.json()),
    staleTime: 10_000,
  });

  function refresh() { qc.invalidateQueries({ queryKey: ["facts", projectId] }); }

  async function save() {
    if (!form) return;
    setError("");
    const res = await fetch("/api/facts", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...(editId ? { id: editId } : {}), ...form }),
    });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "Не вдалося зберегти"); return; }
    setForm(null); setEditId(null); refresh();
  }

  function startEdit(f: Fact) {
    setError(""); setEditId(f.id);
    setForm({ topic: f.topic || "", title: f.title, content: f.content, valid_from: f.validFrom || "", valid_until: f.validUntil || "", stale_markers: f.staleMarkers.join("\n") });
  }

  async function expire(f: Fact) {
    if (!confirm(`Позначити застарілим: «${f.title}»?`)) return;
    await fetch("/api/facts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, id: f.id, expire: true }) });
    refresh();
  }

  const facts = data?.facts ?? [];
  const stale = data?.stalePosts ?? [];
  const input = "w-full mt-1 bg-canvas-subtle border border-border rounded px-2 py-1.5 text-sm text-fg";

  return (
    <div className="flex flex-col h-[calc(100vh-40px)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-canvas-subtle shrink-0">
        <div>
          <p className="text-sm font-semibold text-fg">Актуальна інформація</p>
          <p className="text-xs text-fg-muted">
            Що зараз правда про продукт, а що вже ні{data ? ` · станом на ${fmt(data.today)}` : ""}. Нова інформація тієї ж теми автоматично замінює стару.
          </p>
        </div>
        <button onClick={() => { setError(""); setEditId(null); setForm({ ...empty }); }} className="btn-primary text-xs px-3 py-1">+ Новий факт</button>
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-4xl space-y-6">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
        ) : facts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-3">🗓</div>
            <p className="text-sm font-medium text-fg-muted">Поки немає жодного факту</p>
            <p className="text-xs text-fg-subtle mt-1 max-w-sm">Напишіть новину контент-менеджеру в боті (напр. «у нас уже 10 тестувальників») — вона зʼявиться тут, а стара автоматично стане застарілою.</p>
          </div>
        ) : (
          <>
            {stale.length > 0 && (
              <div className="border border-amber-500/50 bg-amber-500/10 rounded-lg px-3 py-2">
                <p className="text-sm font-medium text-fg">⚠️ {stale.length} запланованих постів ще містять застаріле формулювання</p>
                <p className="text-xs text-fg-muted mt-1">Попросіть контент-менеджера виправити їх. Пости: {stale.map((p) => `#${p.number} (${p.date}: «${p.markers.join("», «")}»)`).join("; ")}</p>
              </div>
            )}
            {SECTIONS.map((sec) => {
              const list = facts.filter((f) => f.status === sec.key);
              if (list.length === 0 && sec.key !== "active") return null;
              return (
                <div key={sec.key}>
                  <p className="text-xs font-semibold text-fg-muted">{sec.title} <span className="text-fg-subtle">({list.length})</span></p>
                  <p className="text-[11px] text-fg-subtle mb-2">{sec.hint}</p>
                  {list.length === 0 && <p className="text-xs text-fg-subtle">Порожньо</p>}
                  <div className="space-y-1.5">
                    {list.map((f) => (
                      <div key={f.id} className={cn("border rounded-lg px-3 py-2 flex items-start justify-between gap-3", sec.cls)}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-fg">{f.title}</p>
                          <p className="text-sm text-fg-muted mt-0.5 whitespace-pre-wrap">{f.content}</p>
                          <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                            {f.topic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-border/50 text-fg-subtle">тема: {f.topic}</span>}
                            {f.validFrom && <span className="text-[10px] px-1.5 py-0.5 rounded bg-border/50 text-fg-subtle">з {fmt(f.validFrom)}</span>}
                            {f.validUntil && <span className="text-[10px] px-1.5 py-0.5 rounded bg-border/50 text-fg-subtle">до {fmt(f.validUntil)}</span>}
                            {f.status === "outdated" && f.supersededAt && <span className="text-[10px] text-fg-subtle">замінено {fmtTs(f.supersededAt)}</span>}
                            <span className="text-[10px] text-fg-subtle">додано {fmtTs(f.createdAt)} · {f.addedBy === "bot" ? "ботом" : "вручну"}</span>
                          </div>
                          {f.staleMarkers.length > 0 && f.status !== "outdated" && (
                            <p className="text-[10px] text-fg-subtle mt-1">Не повинно звучати в постах: {f.staleMarkers.map((m) => `«${m}»`).join(", ")}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <button onClick={() => startEdit(f)} className="text-[11px] text-fg-muted hover:text-fg px-1" title="Редагувати">✏️ Правити</button>
                          {f.status !== "outdated" && (
                            <button onClick={() => expire(f)} className="text-[11px] text-fg-muted hover:text-red-500 px-1" title="Позначити застарілим">Застаріло</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setForm(null)}>
          <div className="bg-canvas border border-border rounded-xl p-4 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-fg">{editId ? "Редагувати факт" : "Новий факт"}</p>
            <div>
              <label className="text-xs text-fg-muted">Тема (за нею новий факт замінює старий)</label>
              <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="напр. тестування застосунку" className={input} autoFocus />
            </div>
            <div>
              <label className="text-xs text-fg-muted">Короткий заголовок</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={input} />
            </div>
            <div>
              <label className="text-xs text-fg-muted">Що саме правда</label>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3} className={input} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-fg-muted">Діє з (необовʼязково)</label>
                <input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} className={input} />
              </div>
              <div>
                <label className="text-xs text-fg-muted">Діє до (необовʼязково)</label>
                <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className={input} />
              </div>
            </div>
            <div>
              <label className="text-xs text-fg-muted">Старі формулювання, яких не має бути в постах (по одному в рядок)</label>
              <textarea value={form.stale_markers} onChange={(e) => setForm({ ...form, stale_markers: e.target.value })} rows={2} className={input} />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setForm(null); setEditId(null); }} className="text-xs px-3 py-1 text-fg-muted">Скасувати</button>
              <button onClick={save} className="btn-primary text-xs px-3 py-1">Зберегти</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
