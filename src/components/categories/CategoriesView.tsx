"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface SocialNetwork {
  id: string;
  name: string;
  platformKey: string;
  color: string | null;
}

interface Persona {
  id: string;
  name: string;
  type: string | null;
}

interface Category {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  clientType: string | null;
  socialNetworkId: string;
  socialNetwork: SocialNetwork;
}

interface Props {
  projectId: string;
  categories: Category[];
  networks: SocialNetwork[];
  personas: Persona[];
}

const CLIENT_TYPES = [
  { value: "TYPE_1", label: "TYPE 1 — Холодна аудиторія" },
  { value: "TYPE_2", label: "TYPE 2 — Тепла аудиторія" },
  { value: "TYPE_3", label: "TYPE 3 — Гаряча аудиторія" },
];

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#ec4899", "#64748b",
];

export function CategoriesView({ projectId, categories: initial, networks, personas }: Props) {
  const qc = useQueryClient();
  const [activeNetworkId, setActiveNetworkId] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"categories" | "personas">("categories");

  // Categories
  const { data: categories = initial } = useQuery<Category[]>({
    queryKey: ["categories", projectId],
    queryFn: () => fetch(`/api/categories?projectId=${projectId}`).then((r) => r.json()),
    initialData: initial,
    staleTime: 30_000,
  });

  // Personas
  const { data: personaList = personas } = useQuery<Persona[]>({
    queryKey: ["personas", projectId],
    queryFn: () => fetch(`/api/personas?projectId=${projectId}`).then((r) => r.json()),
    initialData: personas,
    staleTime: 30_000,
  });

  const filteredCategories = activeNetworkId === "all"
    ? categories
    : categories.filter((c) => c.socialNetworkId === activeNetworkId);

  const editCategory = categories.find((c) => c.id === editId);

  return (
    <div className="flex flex-col h-[calc(100vh-40px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-canvas-subtle shrink-0">
        {/* Tabs */}
        <div className="flex items-center gap-1">
          {(["categories", "personas"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors",
                activeTab === t
                  ? "bg-accent text-white"
                  : "text-fg-muted hover:text-fg hover:bg-border/30"
              )}
            >
              {t === "categories" ? "📁 Категорії" : "👤 Персонажі"}
            </button>
          ))}
        </div>

        {activeTab === "categories" && (
          <>
            <div className="w-px h-4 bg-border" />
            {/* Network filter */}
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setActiveNetworkId("all")}
                className={cn(
                  "px-2 py-1 rounded text-xs transition-colors",
                  activeNetworkId === "all"
                    ? "bg-border/60 text-fg font-medium"
                    : "text-fg-muted hover:bg-border/30"
                )}
              >
                Всі
              </button>
              {networks.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setActiveNetworkId(n.id)}
                  className={cn(
                    "px-2 py-1 rounded text-xs transition-colors",
                    activeNetworkId === n.id
                      ? "bg-border/60 text-fg font-medium"
                      : "text-fg-muted hover:bg-border/30"
                  )}
                  style={activeNetworkId === n.id ? { color: n.color || undefined } : undefined}
                >
                  {n.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="ml-auto">
          <button
            onClick={() => { setShowForm(true); setEditId(null); }}
            className="btn-primary text-xs px-3 py-1"
          >
            + {activeTab === "categories" ? "Категорія" : "Персонаж"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "categories" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredCategories.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                onEdit={() => { setEditId(cat.id); setShowForm(true); }}
                onDelete={async () => {
                  if (!confirm(`Видалити категорію "${cat.name}"?`)) return;
                  await fetch(`/api/categories/${cat.id}`, { method: "DELETE" });
                  qc.invalidateQueries({ queryKey: ["categories", projectId] });
                }}
              />
            ))}
            {filteredCategories.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">📁</div>
                <p className="text-sm text-fg-muted">Категорій немає</p>
                <p className="text-xs text-fg-subtle mt-1">Створіть першу категорію для організації контенту</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {personaList.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                onEdit={() => { setEditId(p.id); setShowForm(true); }}
                onDelete={async () => {
                  if (!confirm(`Видалити персонажа "${p.name}"?`)) return;
                  await fetch(`/api/personas/${p.id}`, { method: "DELETE" });
                  qc.invalidateQueries({ queryKey: ["personas", projectId] });
                }}
              />
            ))}
            {personaList.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">👤</div>
                <p className="text-sm text-fg-muted">Персонажів немає</p>
                <p className="text-xs text-fg-subtle mt-1">Персонажі — це аватари вашої аудиторії (TYPE 1/2/3)</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        activeTab === "categories" ? (
          <CategoryForm
            projectId={projectId}
            networks={networks}
            initial={editCategory}
            onClose={() => { setShowForm(false); setEditId(null); }}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["categories", projectId] });
              setShowForm(false);
              setEditId(null);
            }}
          />
        ) : (
          <PersonaForm
            projectId={projectId}
            initial={personaList.find((p) => p.id === editId) as any}
            onClose={() => { setShowForm(false); setEditId(null); }}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["personas", projectId] });
              setShowForm(false);
              setEditId(null);
            }}
          />
        )
      )}
    </div>
  );
}

function CategoryCard({ category, onEdit, onDelete }: { category: Category; onEdit: () => void; onDelete: () => void }) {
  const color = category.color || "#64748b";
  const clientTypeLabel = CLIENT_TYPES.find((t) => t.value === category.clientType)?.label?.split("—")[0]?.trim();

  return (
    <div
      className="bg-canvas-subtle border border-border rounded-xl p-4 hover:border-border/80 transition-colors group"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-semibold text-fg truncate">{category.name}</h3>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onEdit} className="text-xs text-fg-subtle hover:text-accent transition-colors p-1">✏️</button>
          <button onClick={onDelete} className="text-xs text-fg-subtle hover:text-danger transition-colors p-1">🗑</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
          style={{ backgroundColor: (category.socialNetwork.color || "#64748b") + "22", color: category.socialNetwork.color || "#64748b" }}
        >
          {category.socialNetwork.name}
        </span>
        {clientTypeLabel && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-border/50 text-fg-muted">{clientTypeLabel}</span>
        )}
      </div>

      {category.description && (
        <p className="text-xs text-fg-subtle mt-2 line-clamp-2">{category.description}</p>
      )}
    </div>
  );
}

function PersonaCard({ persona, onEdit, onDelete }: { persona: any; onEdit: () => void; onDelete: () => void }) {
  const typeColors: Record<string, string> = { TYPE_1: "#3b82f6", TYPE_2: "#10b981", TYPE_3: "#f59e0b" };
  const color = typeColors[persona.type] || "#64748b";

  return (
    <div
      className="bg-canvas-subtle border border-border rounded-xl p-4 hover:border-border/80 transition-colors group"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center text-sm shrink-0">
            {persona.gender === "female" ? "👩" : persona.gender === "male" ? "👨" : "👤"}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-fg truncate">{persona.name}</h3>
            {persona.age && <p className="text-xs text-fg-muted">{persona.age} р.</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onEdit} className="text-xs text-fg-subtle hover:text-accent transition-colors p-1">✏️</button>
          <button onClick={onDelete} className="text-xs text-fg-subtle hover:text-danger transition-colors p-1">🗑</button>
        </div>
      </div>

      {persona.type && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
          style={{ backgroundColor: color + "22", color }}
        >
          {persona.type}
        </span>
      )}

      {persona.pains && (
        <p className="text-xs text-fg-subtle mt-2 line-clamp-2">😟 {persona.pains}</p>
      )}
      {persona.tone && (
        <p className="text-xs text-fg-muted mt-1 line-clamp-1">🗣 {persona.tone}</p>
      )}
    </div>
  );
}

function CategoryForm({ projectId, networks, initial, onClose, onSaved }: {
  projectId: string;
  networks: SocialNetwork[];
  initial?: Category;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || COLORS[0]);
  const [networkId, setNetworkId] = useState(initial?.socialNetworkId || networks[0]?.id || "");
  const [clientType, setClientType] = useState(initial?.clientType || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (initial) {
        await fetch(`/api/categories/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, color, socialNetworkId: networkId, clientType, description }),
        });
      } else {
        await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, name, color, socialNetworkId: networkId, clientType, description }),
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="bg-canvas-subtle border border-border rounded-xl shadow-2xl w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-fg">{initial ? "Редагувати категорію" : "Нова категорія"}</h3>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg text-lg">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Назва *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Назва категорії..." autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Платформа</label>
              <select className="input" value={networkId} onChange={(e) => setNetworkId(e.target.value)}>
                {networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Тип аудиторії</label>
              <select className="input" value={clientType} onChange={(e) => setClientType(e.target.value)}>
                <option value="">Не вказано</option>
                {CLIENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.value}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Колір</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn("w-6 h-6 rounded-full transition-transform", color === c && "ring-2 ring-offset-2 ring-offset-canvas-subtle ring-white scale-110")}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent" title="Свій колір" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Опис</label>
            <textarea className="input resize-none min-h-16 text-xs" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Необов'язково..." />
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="btn-ghost flex-1 text-xs py-2">Скасувати</button>
          <button onClick={save} disabled={saving || !name.trim()} className="btn-primary flex-1 text-xs py-2">
            {saving ? "Збереження..." : "Зберегти"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonaForm({ projectId, initial, onClose, onSaved }: {
  projectId: string;
  initial?: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [age, setAge] = useState(initial?.age?.toString() || "");
  const [gender, setGender] = useState(initial?.gender || "");
  const [type, setType] = useState(initial?.type || "TYPE_1");
  const [pains, setPains] = useState(initial?.pains || "");
  const [goals, setGoals] = useState(initial?.goals || "");
  const [tone, setTone] = useState(initial?.tone || "");
  const [forbiddenWords, setForbiddenWords] = useState(initial?.forbiddenWords || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const data = { name, age: age ? parseInt(age) : null, gender, type, pains, goals, tone, forbiddenWords };
    try {
      if (initial) {
        await fetch(`/api/personas/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      } else {
        await fetch("/api/personas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, ...data }) });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="bg-canvas-subtle border border-border rounded-xl shadow-2xl w-full max-w-lg animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-fg">{initial ? "Редагувати персонажа" : "Новий персонаж"}</h3>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg text-lg">×</button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Ім'я *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Марія, 35+" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Вік</label>
              <input className="input" type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="35" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Стать</label>
              <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Не вказано</option>
                <option value="female">Жіноча</option>
                <option value="male">Чоловіча</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Тип</label>
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="TYPE_1">TYPE 1 — Холодна</option>
                <option value="TYPE_2">TYPE 2 — Тепла</option>
                <option value="TYPE_3">TYPE 3 — Гаряча</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">😟 Болі та страхи</label>
            <textarea className="input resize-none min-h-16 text-xs" value={pains} onChange={(e) => setPains(e.target.value)} placeholder="Що турбує цю людину, які її страхи..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">🎯 Бажання та цілі</label>
            <textarea className="input resize-none min-h-16 text-xs" value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="До чого прагне, що хоче отримати..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">🗣 Тон комунікації</label>
            <input className="input" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Дружній, експертний, емпатійний..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">🚫 Заборонені слова</label>
            <input className="input" value={forbiddenWords} onChange={(e) => setForbiddenWords(e.target.value)} placeholder="купити, дешево, акція (через кому)..." />
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5 border-t border-border pt-4">
          <button onClick={onClose} className="btn-ghost flex-1 text-xs py-2">Скасувати</button>
          <button onClick={save} disabled={saving || !name.trim()} className="btn-primary flex-1 text-xs py-2">
            {saving ? "Збереження..." : "Зберегти"}
          </button>
        </div>
      </div>
    </div>
  );
}
