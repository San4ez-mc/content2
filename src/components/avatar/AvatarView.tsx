"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Photo { id: string; fileName: string; url: string; path: string; folder: string | null; tags: string[]; aiGenerated: boolean }
interface Avatar {
  id: string; name: string; tagline: string | null; bio: string | null; look: string | null; basePrompt: string | null;
  photoRules: string | null; videoRules: string | null; voiceRules: string | null; disclosure: string | null;
  refPhotoIds: string[]; isActive: boolean;
}

// Поля правил: один блок = одна відповідь на питання «де це змінити». Порядок — від головного до технічного.
const SECTIONS: { key: keyof Avatar; title: string; hint: string; rows: number }[] = [
  { key: "bio", title: "Хто вона", hint: "Коротка історія персонажа. Читає Content Manager, коли пише від її імені.", rows: 5 },
  { key: "voiceRules", title: "Голос і характер", hint: "Як пише й говорить: настрій, жарти, питання до аудиторії, що можна й чого не можна. Це читає Content Manager у кожному пості.", rows: 10 },
  { key: "look", title: "Зовнішність: що не змінюється", hint: "За цим її впізнають. Перевіряємо кожне нове фото за цим списком.", rows: 10 },
  { key: "photoRules", title: "Правила нових фото", hint: "Що можна міняти (сцена, одяг, світло), що ні, формула промпта. Читає воронка «Фото аватара».", rows: 10 },
  { key: "videoRules", title: "Правила відео", hint: "Довжина кліпів, рух, структура ролика. Усі відео будуються від фото аватара.", rows: 8 },
  { key: "basePrompt", title: "Опис для генератора зображень (англійською)", hint: "Технічний опис персонажа для нейромережі.", rows: 6 },
  { key: "disclosure", title: "Позначка «створено ШІ»", hint: "Текст для біо профілів і нагадування про позначку в публікаціях.", rows: 3 },
];

export function AvatarView({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<Avatar>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const key = ["avatar", projectId];

  const { data, isLoading } = useQuery<{ avatar: Avatar | null; photos: Photo[] }>({
    queryKey: key,
    queryFn: () => fetch(`/api/avatar?projectId=${projectId}`).then((r) => r.json()),
    staleTime: 10_000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const avatar = data?.avatar || null;
  const photos = data?.photos || [];
  const refs = photos.filter((p) => p.folder === "avatar");
  const generated = photos.filter((p) => p.folder === "avatar-generated" && !/\.(mp4|mov|webm|m4v)$/i.test(p.path)); // відео в галереї фото не показуємо
  const order = avatar?.refPhotoIds || [];
  const primaryId = order[0] || refs.find((p) => p.tags.includes("ref"))?.id;

  async function create(preset?: string) {
    await fetch("/api/avatar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, preset }) });
    refresh();
  }

  async function put(body: Record<string, unknown>) {
    const res = await fetch("/api/avatar", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, ...body }) });
    if (!res.ok) { setMsg((await res.json().catch(() => ({}))).error || "Не вдалося зберегти"); return false; }
    return true;
  }

  async function save() {
    setSaving(true); setMsg("");
    if (await put(draft)) { setDraft({}); setMsg("Збережено"); refresh(); }
    setSaving(false);
  }

  async function setPrimary(id: string) {
    const next = [id, ...order.filter((x) => x !== id)];
    if (await put({ refPhotoIds: next })) refresh();
  }

  async function upload(files: FileList) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file); fd.append("projectId", projectId); fd.append("folder", "avatar"); fd.append("tags", JSON.stringify(["ref"]));
        await fetch("/api/media", { method: "POST", body: fd });
      }
    } finally { setUploading(false); refresh(); }
  }

  const val = (k: keyof Avatar) => (k in draft ? (draft[k] as string) : ((avatar?.[k] as string | null) ?? "")) || "";
  const dirty = Object.keys(draft).length > 0;
  const input = "w-full mt-1 bg-canvas-subtle border border-border rounded px-2 py-1.5 text-sm text-fg";

  if (isLoading) return <div className="p-4"><div className="h-24 skeleton rounded-xl max-w-3xl" /></div>;

  if (!avatar) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="text-5xl mb-3">🧑‍🎤</div>
        <p className="text-sm font-medium text-fg">Аватара ще немає</p>
        <p className="text-xs text-fg-subtle mt-1 max-w-md">Аватар — обличчя бренду: платформа знає, як він виглядає, як говорить, і робить усі нові фото й відео саме з нього.</p>
        <div className="flex gap-2 mt-4">
          <button onClick={() => create("kira")} className="btn-primary text-xs px-3 py-1.5">Створити Кіру (заготовка KIRO)</button>
          <button onClick={() => create()} className="btn-ghost text-xs px-3 py-1.5">Створити порожнього</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-40px)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-canvas-subtle shrink-0">
        <div>
          <p className="text-sm font-semibold text-fg">Аватар: {avatar.name}</p>
          <p className="text-xs text-fg-muted">{avatar.tagline || "Обличчя бренду: від її імені пишемо пости, з неї робимо всі нові фото й відео"}</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-fg-muted">{msg}</span>}
          <button onClick={save} disabled={!dirty || saving} className={cn("btn-primary text-xs px-3 py-1", (!dirty || saving) && "opacity-50")}>{saving ? "Зберігаю…" : "Зберегти зміни"}</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-4xl space-y-6">
        <section>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-fg-muted">Фото-референси ({refs.length})</p>
              <p className="text-[11px] text-fg-subtle">З них нейромережа робить нові фото й кадри для відео. Позначене ★ — основне (береться першим). Клік по фото відкриває його, ★ ставить основним.</p>
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-ghost text-xs px-3 py-1">{uploading ? "Завантажую…" : "+ Додати фото"}</button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2 mt-2">
            {refs.map((p) => (
              <div key={p.id} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.path} alt={p.fileName} onClick={() => setLightbox(p)} className={cn("w-full aspect-[3/4] object-cover rounded-lg border cursor-pointer", p.id === primaryId ? "border-accent ring-2 ring-accent/40" : "border-border")} />
                <button onClick={() => setPrimary(p.id)} title="Зробити основним" className={cn("absolute top-1 left-1 text-xs rounded px-1 bg-black/60", p.id === primaryId ? "text-yellow-300" : "text-white/70 opacity-0 group-hover:opacity-100")}>★</button>
                {p.tags.filter((t) => t !== "ref").slice(0, 1).map((t) => <span key={t} className="absolute bottom-1 left-1 text-[9px] px-1 rounded bg-black/60 text-white">{t.replace(/^(shot|scene):/, "")}</span>)}
              </div>
            ))}
            {refs.length === 0 && <p className="text-xs text-fg-subtle col-span-full">Фото ще немає. Додайте колаж або окремі кадри.</p>}
          </div>
        </section>

        {generated.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-fg-muted">Створені нові фото ({generated.length})</p>
            <p className="text-[11px] text-fg-subtle">Їх зробила воронка «Фото аватара». Усі ваші фото й відео також лежать у Сховищі.</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2 mt-2">
              {generated.slice().reverse().map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={p.path} alt={p.fileName} onClick={() => setLightbox(p)} className="w-full aspect-[3/4] object-cover rounded-lg border border-border cursor-pointer" />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-xs text-fg-muted">Імʼя
              <input value={val("name")} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={input} />
            </label>
            <label className="block text-xs text-fg-muted">Фраза-візитівка
              <input value={val("tagline")} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} className={input} />
            </label>
          </div>
          {SECTIONS.map((s) => (
            <label key={s.key} className="block text-xs text-fg-muted">
              <span className="font-semibold">{s.title}</span> <span className="text-fg-subtle">— {s.hint}</span>
              <textarea value={val(s.key)} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })} rows={s.rows} className={cn(input, "font-mono text-[12px] leading-snug")} />
            </label>
          ))}
        </section>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.path} alt={lightbox.fileName} className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
