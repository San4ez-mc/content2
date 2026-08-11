"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Persona {
  id: string; name: string; age: number | null; gender: string | null; type: string | null;
  pains: string | null; goals: string | null; tone: string | null; forbiddenWords: string | null;
  triggers: string | null; objections: string | null; language: string | null;
}

const FIELDS: { key: keyof Persona; label: string; area?: boolean; hint?: string }[] = [
  { key: "pains", label: "Болі", area: true, hint: "Що болить, чого боїться, що бісить" },
  { key: "goals", label: "Цілі / мрії", area: true },
  { key: "triggers", label: "Тригери купівлі", area: true, hint: "Що штовхає прийняти рішення" },
  { key: "objections", label: "Заперечення", area: true, hint: "Чому може НЕ купити" },
  { key: "tone", label: "Тон голосу", hint: "Як з нею говорити" },
  { key: "language", label: "Мова / лексика" },
  { key: "forbiddenWords", label: "Стоп-слова", hint: "Чого писати не можна" },
];

export function PersonasView({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Persona | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: personas = [], isLoading } = useQuery<Persona[]>({
    queryKey: ["personas", projectId],
    queryFn: () => fetch(`/api/personas?projectId=${projectId}`).then((r) => r.json()),
  });

  async function del(id: string, name: string) {
    if (!confirm(`Видалити персону «${name}»?`)) return;
    await fetch(`/api/personas/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["personas", projectId] });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-40px)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-canvas-subtle shrink-0">
        <div>
          <p className="text-sm font-semibold text-fg">Персони (ЦА)</p>
          <p className="text-xs text-fg-muted">Портрети аудиторії: болі, тригери, тон. Використовуються при генерації контенту.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary text-xs px-3 py-1">+ Персона</button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <p className="text-xs text-fg-subtle">Завантаження…</p>
        ) : personas.length === 0 ? (
          <p className="text-xs text-fg-subtle">Персон ще нема. Додай першу або заповни через онбординг.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl">
            {personas.map((p) => (
              <div key={p.id} className="border border-border rounded-xl bg-canvas-subtle p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-fg">{p.name}</h3>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(p)} className="text-fg-subtle hover:text-fg text-xs px-1">✏️</button>
                    <button onClick={() => del(p.id, p.name)} className="text-fg-subtle hover:text-danger text-xs px-1">🗑</button>
                  </div>
                </div>
                {p.tone && <p className="text-[11px] text-fg-muted mt-1">🗣 {p.tone}</p>}
                {p.pains && <p className="text-xs text-fg-muted mt-2 line-clamp-3">{p.pains}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <PersonaForm
          projectId={projectId}
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); qc.invalidateQueries({ queryKey: ["personas", projectId] }); }}
        />
      )}
    </div>
  );
}

function PersonaForm({ projectId, initial, onClose, onSaved }: {
  projectId: string; initial: Persona | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = { name: initial?.name || "" };
    for (const fld of FIELDS) f[fld.key] = (initial?.[fld.key] as string) || "";
    return f;
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, any> = { projectId, name: form.name };
      for (const fld of FIELDS) body[fld.key] = form[fld.key] || null;
      const url = initial ? `/api/personas/${initial.id}` : "/api/personas";
      await fetch(url, { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="bg-canvas-subtle border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold text-fg">{initial ? "Редагувати персону" : "Нова персона"}</h3>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg text-lg">×</button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Ім'я / назва *</label>
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Напр.: Власник малого бізнесу" autoFocus />
          </div>
          {FIELDS.map((fld) => (
            <div key={fld.key}>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">{fld.label}</label>
              {fld.area ? (
                <textarea className="input text-xs resize-none" rows={2} value={form[fld.key]} onChange={(e) => set(fld.key, e.target.value)} placeholder={fld.hint} />
              ) : (
                <input className="input text-xs" value={form[fld.key]} onChange={(e) => set(fld.key, e.target.value)} placeholder={fld.hint} />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 px-5 pb-5 shrink-0">
          <button onClick={onClose} className="btn-ghost flex-1 text-xs py-2">Скасувати</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 text-xs py-2">{saving ? "Збереження…" : (initial ? "Зберегти" : "Створити")}</button>
        </div>
      </div>
    </div>
  );
}
