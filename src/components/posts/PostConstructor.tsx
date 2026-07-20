"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { INTENTS, STRUCTURES, HOOK_TYPES, EVIDENCE_TYPES, type Option } from "@/lib/postConstructor";

type Atoms = {
  intent?: string | null;
  structureId?: string | null;
  evidenceType?: string | null;
  hookType?: string | null;
  hookA?: string | null;
  hookB?: string | null;
  hookSelected?: string | null;
  cta?: string | null;
};

type Scores = { minSample: number; elements: Record<string, Record<string, { score: number; n: number; enough: boolean }>> };

// #248 Конструктор поста: збери пост з елементів; біля кожного — бал ефективності.
export function PostConstructor({ postId, projectId, group, onSaved }: {
  postId: string; projectId: string; group: Atoms; onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<Atoms>({
    intent: group.intent || "",
    structureId: group.structureId || "",
    evidenceType: group.evidenceType || "",
    hookType: group.hookType || "",
    hookA: group.hookA || "",
    hookB: group.hookB || "",
    hookSelected: group.hookSelected || "",
    cta: group.cta || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: scores } = useQuery<Scores>({
    queryKey: ["patterns", projectId],
    queryFn: () => fetch(`/api/patterns?projectId=${projectId}`).then((r) => r.json()),
  });

  const set = (k: keyof Atoms, v: string) => { setF((p) => ({ ...p, [k]: v })); setSaved(false); };

  // бал для значення елемента (element = ключ у scores.elements)
  const badge = (element: string, value: string) => {
    const rec = scores?.elements?.[element]?.[value];
    if (!rec || rec.n === 0) return null;
    return rec.enough
      ? <span className="text-[10px] text-success ml-1" title={`середній бал, n=${rec.n}`}>★{rec.score}</span>
      : <span className="text-[10px] text-fg-subtle ml-1" title="мало даних">·{rec.n}</span>;
  };

  const OptRow = ({ label, element, value, options, onPick }: {
    label: string; element: string | null; value: string; options: Option[]; onPick: (id: string) => void;
  }) => (
    <div>
      <div className="text-[11px] font-medium text-fg-muted mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onPick(active ? "" : o.id)}
              title={o.hint}
              className={`text-[11px] px-2 py-1 rounded border transition-colors ${active
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-canvas-subtle text-fg-muted hover:border-accent/50"}`}
            >
              {o.label}{element ? badge(element, o.id) : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: f.intent || null,
          structureId: f.structureId || null,
          evidenceType: f.evidenceType || null,
          hookA: f.hookA || null,
          hookB: f.hookB || null,
          hookSelected: f.hookSelected || null,
          cta: f.cta || null,
        }),
      });
      if (res.ok) { setSaved(true); qc.invalidateQueries({ queryKey: ["posts"] }); onSaved?.(); }
    } finally { setSaving(false); }
  };

  const inp = "w-full text-xs bg-canvas border border-border rounded px-2 py-1.5 text-fg";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-canvas-subtle/40 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-fg">🧩 Конструктор</div>
        <div className="text-[10px] text-fg-subtle">★ = бал ефективності (з результатів постів)</div>
      </div>

      <OptRow label="Тема (намір)" element="intent" value={f.intent || ""} options={INTENTS} onPick={(v) => set("intent", v)} />
      <OptRow label="Структура тексту" element="structureId" value={f.structureId || ""} options={STRUCTURES} onPick={(v) => set("structureId", v)} />
      <OptRow label="Тип доказу" element="evidenceType" value={f.evidenceType || ""} options={EVIDENCE_TYPES} onPick={(v) => set("evidenceType", v)} />

      {/* Хук: тип (підказка) + A/B варіанти + обраний */}
      <div>
        <div className="text-[11px] font-medium text-fg-muted mb-1">Хук</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {HOOK_TYPES.map((o) => (
            <button key={o.id} type="button" onClick={() => set("hookType", f.hookType === o.id ? "" : o.id)} title={o.hint}
              className={`text-[11px] px-2 py-1 rounded border transition-colors ${f.hookType === o.id
                ? "border-accent bg-accent/15 text-accent" : "border-border bg-canvas-subtle text-fg-muted hover:border-accent/50"}`}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <input type="radio" name="hookSel" checked={f.hookSelected === "A"} onChange={() => set("hookSelected", "A")} />
              <span className="text-[10px] text-fg-muted">Варіант A</span>
            </div>
            <textarea className={inp} rows={2} value={f.hookA || ""} onChange={(e) => set("hookA", e.target.value)} placeholder="Хук A…" />
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <input type="radio" name="hookSel" checked={f.hookSelected === "B"} onChange={() => set("hookSelected", "B")} />
              <span className="text-[10px] text-fg-muted">Варіант B</span>
            </div>
            <textarea className={inp} rows={2} value={f.hookB || ""} onChange={(e) => set("hookB", e.target.value)} placeholder="Хук B (для A/B)…" />
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-medium text-fg-muted mb-1">CTA (заклик до дії)</div>
        <textarea className={inp} rows={2} value={f.cta || ""} onChange={(e) => set("cta", e.target.value)} placeholder="Напр. «Напиши “ХОЧУ” в коментарі»…" />
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={save} disabled={saving}
          className="btn-primary text-xs px-3 py-1.5">{saving ? "Зберігаю…" : saved ? "Збережено ✅" : "Зберегти конструктор"}</button>
      </div>
    </div>
  );
}
