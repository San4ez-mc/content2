"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface LeadMagnet {
  id: string;
  productId: string;
  name: string;
  description: string | null;
  funnelSlug: string | null;
  botUsername: string | null;
  baseStartParam: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface Product {
  id: string;
  name: string;
  isActive: boolean;
}

interface Props {
  projectId: string;
}

export function buildLink(m: Pick<LeadMagnet, "botUsername" | "baseStartParam" | "funnelSlug">): string | null {
  if (!m.botUsername) return null;
  const bot = m.botUsername.replace(/^@/, "");
  const param = m.baseStartParam || m.funnelSlug || "";
  return `https://t.me/${bot}${param ? `?start=${param}` : ""}`;
}

export function LeadMagnetsView({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<LeadMagnet | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: magnets = [], isLoading } = useQuery<LeadMagnet[]>({
    queryKey: ["leadMagnets", projectId],
    queryFn: () => fetch(`/api/lead-magnets?projectId=${projectId}`).then((r) => r.json()),
    staleTime: 30_000,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products-lite", projectId],
    queryFn: () => fetch(`/api/products?projectId=${projectId}`).then((r) => r.json()),
    staleTime: 30_000,
  });

  const { data: stats } = useQuery<{ byMagnet?: { lead_magnet_id: string; links: number; clicks: number }[] }>({
    queryKey: ["linkStats", projectId],
    queryFn: () => fetch(`/api/link-stats?projectId=${projectId}`).then((r) => r.json()),
    staleTime: 30_000,
  });

  const clicksByMagnet = new Map((stats?.byMagnet || []).map((s) => [s.lead_magnet_id, s]));
  const productName = (id: string) => products.find((p) => p.id === id)?.name || "—";

  async function toggleActive(m: LeadMagnet) {
    await fetch(`/api/lead-magnets/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !m.isActive }),
    });
    queryClient.invalidateQueries({ queryKey: ["leadMagnets", projectId] });
  }

  async function deleteMagnet(id: string) {
    if (!confirm("Видалити лід-магніт?")) return;
    await fetch(`/api/lead-magnets/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["leadMagnets", projectId] });
  }

  const noProducts = products.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-40px)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-canvas-subtle shrink-0">
        <div>
          <p className="text-sm font-semibold text-fg">Лід-магніти</p>
          <p className="text-xs text-fg-muted">Прив'язані до продуктів. Кожен веде на воронку у flows — звідси бот бере посилання для постів</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          disabled={noProducts}
          title={noProducts ? "Спершу додайте хоча б один продукт" : ""}
          className="btn-primary text-xs px-3 py-1 disabled:opacity-50"
        >
          + Новий лід-магніт
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {noProducts ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-3">🧲</div>
            <p className="text-sm font-medium text-fg-muted">Немає продуктів</p>
            <p className="text-xs text-fg-subtle mt-1 max-w-xs">Лід-магніт прив'язується до продукту. Спершу створіть продукт на вкладці «Продукти».</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
          </div>
        ) : magnets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-3">🧲</div>
            <p className="text-sm font-medium text-fg-muted">Немає лід-магнітів</p>
            <button onClick={() => setCreating(true)} className="btn-primary text-xs px-4 py-2 mt-4">+ Створити перший</button>
          </div>
        ) : (
          <div className="space-y-3">
            {magnets.map((m) => {
              const link = buildLink(m);
              return (
                <div
                  key={m.id}
                  className={cn("border rounded-xl p-4 transition-colors", m.isActive
                    ? "border-border bg-canvas-subtle"
                    : "border-border/40 bg-canvas-subtle/50 opacity-60")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-fg">{m.name}</h3>
                        <span className="text-[10px] px-1.5 py-0.5 bg-accent/15 text-accent rounded">{productName(m.productId)}</span>
                        {(() => {
                          const s = clicksByMagnet.get(m.id);
                          return s && s.clicks > 0 ? (
                            <span className="text-[10px] px-1.5 py-0.5 bg-success/15 text-success rounded" title={`${s.links} посилань`}>
                              👆 {s.clicks} переходів
                            </span>
                          ) : null;
                        })()}
                        {!m.isActive && <span className="text-[10px] px-1.5 py-0.5 bg-border text-fg-subtle rounded">вимкнено</span>}
                      </div>
                      {m.description && <p className="text-xs text-fg-muted mt-0.5">{m.description}</p>}
                      <div className="mt-2 flex flex-col gap-1">
                        {m.funnelSlug && (
                          <span className="text-[11px] text-fg-subtle">Воронка: <code className="text-fg-muted">{m.funnelSlug}</code></span>
                        )}
                        {link ? (
                          <a href={link} target="_blank" rel="noreferrer" className="text-[11px] text-accent hover:underline break-all">{link}</a>
                        ) : (
                          <span className="text-[11px] text-warn">⚠ Немає посилання — вкажи бота (напр. den_fineko_bot)</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleActive(m)}
                        className={cn("text-xs px-2 py-1 rounded transition-colors",
                          m.isActive ? "text-success hover:bg-success/10" : "text-fg-muted hover:bg-border/30")}
                        title={m.isActive ? "Вимкнути" : "Увімкнути"}
                      >
                        {m.isActive ? "✓" : "○"}
                      </button>
                      <button onClick={() => setEditing(m)} className="btn-ghost text-xs px-2 py-1">✏️</button>
                      <button
                        onClick={() => deleteMagnet(m.id)}
                        className="text-xs px-2 py-1 text-danger hover:bg-danger/10 rounded transition-colors"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <LeadMagnetModal
          projectId={projectId}
          products={products.filter((p) => p.isActive || editing?.productId === p.id)}
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["leadMagnets", projectId] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function LeadMagnetModal({ projectId, products, initial, onClose, onSaved }: {
  projectId: string;
  products: Product[];
  initial: LeadMagnet | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [productId, setProductId] = useState(initial?.productId || products[0]?.id || "");
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [funnelSlug, setFunnelSlug] = useState(initial?.funnelSlug || "");
  const [botUsername, setBotUsername] = useState(initial?.botUsername || "");
  const [baseStartParam, setBaseStartParam] = useState(initial?.baseStartParam || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const preview = buildLink({ botUsername, baseStartParam, funnelSlug });

  async function save() {
    if (!name.trim()) { setError("Назва обов'язкова"); return; }
    if (!productId) { setError("Оберіть продукт"); return; }
    setSaving(true);
    setError("");
    try {
      const body = {
        projectId, productId, name,
        description: description || null,
        funnelSlug: funnelSlug || null,
        botUsername: botUsername ? botUsername.replace(/^@/, "") : null,
        baseStartParam: baseStartParam || null,
      };
      const url = initial ? `/api/lead-magnets/${initial.id}` : "/api/lead-magnets";
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
          <h3 className="text-sm font-semibold text-fg">{initial ? "Редагувати лід-магніт" : "Новий лід-магніт"}</h3>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg text-lg">×</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg p-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Продукт *</label>
              <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Назва *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Карта автоматизації (PDF)" autoFocus />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Про що писати (суть / кут)</label>
            <textarea className="input resize-none" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Яку обіцянку дає магніт, який біль закриває — щоб бот писав пости під нього..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Slug воронки (flows)</label>
              <input className="input" value={funnelSlug} onChange={(e) => setFunnelSlug(e.target.value)} placeholder="bot-karta-sales" />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Бот (username)</label>
              <input className="input" value={botUsername} onChange={(e) => setBotUsername(e.target.value)} placeholder="den_fineko_bot" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Базовий start-параметр (опційно)</label>
            <input className="input" value={baseStartParam} onChange={(e) => setBaseStartParam(e.target.value)} placeholder="за замовчуванням = slug воронки" />
            <p className="text-[11px] text-fg-subtle mt-1">Deep-link для маршрутизації + трекінгу. Порожньо → підставиться slug воронки.</p>
          </div>

          <div className="p-2 bg-canvas rounded-lg border border-border/50">
            <p className="text-[10px] text-fg-subtle uppercase tracking-wide mb-1">Базове посилання</p>
            {preview ? (
              <a href={preview} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline break-all">{preview}</a>
            ) : (
              <p className="text-xs text-fg-subtle">Вкажи username бота, щоб згенерувати посилання</p>
            )}
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
