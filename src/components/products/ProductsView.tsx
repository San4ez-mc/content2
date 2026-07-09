"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LeadMagnet {
  id: string;
  name: string;
  description: string | null;
  funnelSlug: string | null;
  botUsername: string | null;
  baseStartParam: string | null;
  isActive: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  audience: string | null;
  isActive: boolean;
  sortOrder: number;
  leadMagnets: LeadMagnet[];
}

interface Props {
  projectId: string;
}

export function ProductsView({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products", projectId],
    queryFn: () => fetch(`/api/products?projectId=${projectId}`).then((r) => r.json()),
    staleTime: 30_000,
  });

  async function toggleActive(p: Product) {
    await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    queryClient.invalidateQueries({ queryKey: ["products", projectId] });
  }

  async function deleteProduct(id: string) {
    if (!confirm("Видалити продукт? Разом з ним видаляться і його лід-магніти.")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["products", projectId] });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-40px)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-canvas-subtle shrink-0">
        <div>
          <p className="text-sm font-semibold text-fg">Продукти</p>
          <p className="text-xs text-fg-muted">Що ми продаємо — контент-план орієнтується на ці продукти</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary text-xs px-3 py-1">
          + Новий продукт
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-4xl">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 skeleton rounded-xl" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-3">🛒</div>
            <p className="text-sm font-medium text-fg-muted">Немає продуктів</p>
            <p className="text-xs text-fg-subtle mt-1 max-w-xs">Додайте продукти, які продаєте — контент-бот писатиме пости так, щоб вести до їх продажу</p>
            <button onClick={() => setCreating(true)} className="btn-primary text-xs px-4 py-2 mt-4">
              + Створити перший продукт
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <div
                key={p.id}
                className={cn("border rounded-xl p-4 transition-colors", p.isActive
                  ? "border-border bg-canvas-subtle"
                  : "border-border/40 bg-canvas-subtle/50 opacity-60")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-fg">{p.name}</h3>
                      {p.price && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-success/15 text-success rounded">{p.price}</span>
                      )}
                      {!p.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-border text-fg-subtle rounded">вимкнено</span>
                      )}
                    </div>
                    {p.description && <p className="text-xs text-fg-muted mt-0.5">{p.description}</p>}
                    {p.audience && (
                      <p className="text-[11px] text-fg-subtle mt-1"><span className="uppercase tracking-wide">ЦА:</span> {p.audience}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-fg-subtle">
                        Лід-магнітів: <b className="text-fg-muted">{p.leadMagnets.length}</b>
                      </span>
                      {p.leadMagnets.slice(0, 4).map((m) => (
                        <span key={m.id} className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded">{m.name}</span>
                      ))}
                      <Link href="/lead-magnets" className="text-[11px] text-accent hover:underline">керувати →</Link>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive(p)}
                      className={cn("text-xs px-2 py-1 rounded transition-colors",
                        p.isActive ? "text-success hover:bg-success/10" : "text-fg-muted hover:bg-border/30")}
                      title={p.isActive ? "Вимкнути" : "Увімкнути"}
                    >
                      {p.isActive ? "✓" : "○"}
                    </button>
                    <button onClick={() => setEditing(p)} className="btn-ghost text-xs px-2 py-1">✏️</button>
                    <button
                      onClick={() => deleteProduct(p.id)}
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
        <ProductModal
          projectId={projectId}
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["products", projectId] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ProductModal({ projectId, initial, onClose, onSaved }: {
  projectId: string;
  initial: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [price, setPrice] = useState(initial?.price || "");
  const [audience, setAudience] = useState(initial?.audience || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) { setError("Назва обов'язкова"); return; }
    setSaving(true);
    setError("");
    try {
      const body = { projectId, name, description: description || null, price: price || null, audience: audience || null };
      const url = initial ? `/api/products/${initial.id}` : "/api/products";
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
          <h3 className="text-sm font-semibold text-fg">{initial ? "Редагувати продукт" : "Новий продукт"}</h3>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg text-lg">×</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg p-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Назва *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Наприклад: Розбір бізнес-процесу" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Ціна</label>
              <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="2500 грн / від $500 / за запитом" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Опис / ключова цінність</label>
            <textarea className="input resize-none" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Що це, яку проблему вирішує, чому варто купити..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Цільова аудиторія</label>
            <textarea className="input resize-none" rows={2} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Для кого цей продукт..." />
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
