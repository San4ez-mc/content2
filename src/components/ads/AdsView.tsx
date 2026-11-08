"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Ad = {
  pain?: string; angle?: string; primary?: string; headline?: string; description?: string; cta?: string; link?: string;
  audience?: string; overlayTitle?: string; accent?: string; overlaySub?: string; points?: string[]; aspect?: string;
};
type Row = {
  id: string; number: number; date: string; status: string; format: string; imagePath: string | null;
  generationStatus: string | null; generationError: string | null; content: string; ad: Ad | null; violations: string[];
};

const isVideo = (p: string | null) => !!p && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(p);

function CopyBtn({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* без доступу до буфера */ }
      }}
      className="text-[11px] px-2 py-1 rounded border border-border text-fg-muted hover:text-fg hover:bg-border/40 transition-colors"
      title={text}
    >
      {done ? "✓ Скопійовано" : "Копіювати: " + label}
    </button>
  );
}

function Card({ r }: { r: Row }) {
  const ad = r.ad || {};
  const video = isVideo(r.imagePath);
  const aspect = video ? "відео 9:16" : (ad.aspect || (r.format === "ad_story" ? "9:16" : "4:5"));
  const statusLabel = r.status === "draft" ? "Чернетка" : "Готово";
  const generating = r.generationStatus === "generating" || r.generationStatus === "pending";
  return (
    <div className="rounded-lg border border-border bg-canvas-subtle overflow-hidden flex flex-col">
      <div className={cn("bg-black flex items-center justify-center", aspect.startsWith("9:16") || video ? "aspect-[9/16]" : "aspect-[4/5]")}>
        {r.imagePath ? (
          video ? (
            <video src={r.imagePath} controls playsInline preload="metadata" className="w-full h-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.imagePath} alt={ad.overlayTitle || ad.headline || "креатив"} className="w-full h-full object-contain" loading="lazy" />
          )
        ) : (
          <span className="text-xs text-fg-subtle px-3 text-center">
            {generating ? "Генерується…" : r.generationStatus === "failed" ? "Не згенерувалось" + (r.generationError ? ": " + r.generationError.slice(0, 80) : "") : "Немає зображення"}
          </span>
        )}
      </div>
      <div className="p-2.5 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-fg">#{r.number} · {aspect}</span>
          <span className={cn("px-1.5 py-0.5 rounded text-[10px]", r.status === "draft" ? "bg-yellow-500/15 text-yellow-400" : "bg-emerald-500/15 text-emerald-400")}>{statusLabel}</span>
        </div>
        {r.violations.length > 0 && (
          <ul className="text-[11px] text-danger list-disc pl-4 space-y-0.5">
            {r.violations.map((v, i) => <li key={i}>{v}</li>)}
          </ul>
        )}
        <div className="flex flex-wrap gap-1.5">
          <CopyBtn label="основний текст" text={ad.primary || ""} />
          <CopyBtn label="заголовок" text={ad.headline || ""} />
          <CopyBtn label="опис" text={ad.description || ""} />
          <CopyBtn label="все" text={r.content} />
          {r.imagePath && (
            <a href={r.imagePath} download className="text-[11px] px-2 py-1 rounded border border-border text-fg-muted hover:text-fg hover:bg-border/40 transition-colors">⬇ Файл</a>
          )}
        </div>
        <div className="text-fg-muted leading-snug">
          {ad.primary && <p className="whitespace-pre-line line-clamp-4">{ad.primary}</p>}
          <p className="mt-1"><span className="text-fg-subtle">Кнопка:</span> {ad.cta || "—"}</p>
        </div>
      </div>
    </div>
  );
}

export function AdsView({ projectName, hasNetwork, rows }: { projectName: string; hasNetwork: boolean; rows: Row[] }) {
  const [filter, setFilter] = useState<"all" | "45" | "916" | "video" | "draft">("all");

  const filtered = useMemo(() => rows.filter((r) => {
    const video = isVideo(r.imagePath);
    const asp = r.ad?.aspect || (r.format === "ad_story" ? "9:16" : "4:5");
    if (filter === "video") return video || r.format === "ad_video";
    if (filter === "45") return !video && r.format !== "ad_video" && asp === "4:5";
    if (filter === "916") return !video && r.format !== "ad_video" && asp === "9:16";
    if (filter === "draft") return r.status === "draft";
    return true;
  }), [rows, filter]);

  // Групуємо за болем (A2, B1…) і датою: у кожній групі всі формати одного креатива поруч.
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of filtered) {
      const key = (r.ad?.pain || r.ad?.angle || "інше") + "|" + r.date;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    }
    return Array.from(m.entries()).map(([key, items]) => ({ key, items }));
  }, [filtered]);

  const chips: { id: typeof filter; label: string }[] = [
    { id: "all", label: `Усі (${rows.length})` }, { id: "45", label: "4:5 стрічка" }, { id: "916", label: "9:16 Stories/Reels" }, { id: "video", label: "Відео" }, { id: "draft", label: "Чернетки (потребують правок)" },
  ];

  return (
    <div className="p-4 max-w-[1500px] mx-auto">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-fg">🎯 Реклама FB/IG: креативи</h1>
        <p className="text-xs text-fg-muted mt-1">
          Компанія: <b>{projectName}</b>. Креативи не публікуються самі: завантажте файл в Ads Manager і скопіюйте текст (посилання додається в кабінеті Meta).
        </p>
      </div>
      {!hasNetwork ? (
        <p className="text-sm text-fg-muted">У цій компанії ще немає рекламних креативів. Запустіть воронку «Реклама FB/IG» для цієї компанії.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {chips.map((c) => (
              <button key={c.id} type="button" onClick={() => setFilter(c.id)}
                className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors", filter === c.id ? "bg-accent text-white border-accent" : "border-border text-fg-muted hover:text-fg hover:bg-border/40")}>
                {c.label}
              </button>
            ))}
          </div>
          {groups.length === 0 && <p className="text-sm text-fg-muted">Нічого не знайдено за цим фільтром.</p>}
          <div className="space-y-6">
            {groups.map((g) => {
              const first = g.items[0].ad || {};
              return (
                <section key={g.key}>
                  <h2 className="text-sm font-semibold text-fg mb-2">
                    {first.pain ? <span className="text-accent mr-2">{first.pain}</span> : null}
                    {first.overlayTitle || first.headline || "Креатив"} <span className="text-fg-subtle font-normal text-xs ml-2">{g.items[0].date}</span>
                  </h2>
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                    {g.items.map((r) => <Card key={r.id} r={r} />)}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
