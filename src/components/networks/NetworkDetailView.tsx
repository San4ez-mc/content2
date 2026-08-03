"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Network {
  id: string; projectId: string; name: string; platformKey: string;
  icon: string | null; color: string | null; rules: string | null; linkPlacement: string | null;
}
interface Format {
  id: string; key: string; name: string; mediaTypes: string[]; aspect: string | null; settings: Record<string, any>; isActive: boolean; sortOrder: number;
}

// ── Пояснення (щоб було зрозуміло без документації) ──
const LINK_OPTIONS = [
  { value: "comment", label: "У коментар", hint: "Активне посилання в першому коментарі. Threads, LinkedIn — так можна вести прямо на воронку." },
  { value: "inline", label: "У тексті", hint: "Пряме посилання в тілі поста. Telegram." },
  { value: "bio", label: "У шапку профілю", hint: "Пост-лінки НЕактивні — веди в шапку профілю. Instagram, TikTok." },
  { value: "description", label: "В опис", hint: "Посилання в описі відео. YouTube." },
];
const FORMAT_HINTS: Record<string, string> = {
  post: "Один самодостатній допис.",
  thread: "Кілька зв'язаних дописів підряд (1/N) — для довшої теми, що не влазить в один пост.",
  reel: "Коротке вертикальне відео. Перші 3 секунди вирішують, субтитри обов'язкові.",
  story: "Тимчасовий вертикальний допис (24 год): фото/відео + текст на фото.",
  carousel: "Кілька зображень-слайдів: обкладинка-хук → кроки → CTA.",
  video: "Вертикальне відео.",
  slideshow: "Фото-слайди під музику.",
  short: "Коротке вертикальне відео (YouTube Shorts).",
};
const ALL_MEDIA = ["text", "image", "text_on_image", "carousel", "video", "file", "image_music"];
const MEDIA_LABEL: Record<string, string> = { text: "Текст", image: "Фото+текст", text_on_image: "Текст на фото", carousel: "Карусель", video: "Відео", file: "Файл", image_music: "Фото під музику" };
const MEDIA_HINT: Record<string, string> = {
  text: "Тільки текст, без медіа.", image: "Одне зображення + текст.", text_on_image: "Текст накладено на фото (обкладинка).",
  carousel: "Кілька зображень-слайдів.", video: "Відео + текст.", file: "Документ/файл (Telegram).", image_music: "Фото-слайди під музику (TikTok).",
};
const ASPECTS = [
  { v: "9:16", h: "вертикаль — рілс, сторіз, TikTok, Shorts" },
  { v: "4:5", h: "портрет — пост у стрічку" },
  { v: "1:1", h: "квадрат" },
  { v: "16:9", h: "горизонталь" },
];

function Hint({ text }: { text: string }) {
  return <p className="text-[11px] text-fg-subtle mt-1 leading-snug">{text}</p>;
}

export function NetworkDetailView({ network, formats: initialFormats }: { network: Network; formats: Format[] }) {
  const [rules, setRules] = useState(network.rules || "");
  const [linkPlacement, setLinkPlacement] = useState(network.linkPlacement || "");
  const [savedRules, setSavedRules] = useState(false);
  const [formats, setFormats] = useState<Format[]>(initialFormats);

  async function saveNetwork(patch: Record<string, any>) {
    await fetch(`/api/networks/${network.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  }
  async function patchFormat(id: string, patch: Record<string, any>) {
    setFormats((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    await fetch(`/api/formats/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  }
  async function deleteFormat(id: string, name: string) {
    if (!confirm(`Видалити формат «${name}»?`)) return;
    setFormats((prev) => prev.filter((f) => f.id !== id));
    await fetch(`/api/formats/${id}`, { method: "DELETE" });
  }
  function toggleMedia(f: Format, m: string) {
    const next = f.mediaTypes.includes(m) ? f.mediaTypes.filter((x) => x !== m) : [...f.mediaTypes, m];
    patchFormat(f.id, { mediaTypes: next });
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-5">
        {/* Header */}
        <div>
          <Link href="/networks" className="text-xs text-fg-subtle hover:text-fg">← Мережі</Link>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: (network.color || "#64748b") + "22" }}>{network.icon || "🌐"}</div>
            <div>
              <h1 className="text-lg font-semibold text-fg">{network.name}</h1>
              <span className="text-[10px] text-fg-subtle">{network.platformKey}</span>
            </div>
          </div>
          <Hint text="Тут усе про роботу з цією мережею: правила письма + доступні формати з медіа-типами. Правила застосовуються до кожного поста цієї мережі при генерації." />
        </div>

        {/* Правила мережі */}
        <section className="border border-border rounded-xl bg-canvas-subtle p-4">
          <h2 className="text-sm font-semibold text-fg">Як писати для цієї мережі</h2>
          <Hint text="Тон, довжина, хештеги, алгоритм. ШІ застосовує це до КОЖНОГО поста саме цієї мережі." />
          <textarea
            className="input text-xs min-h-[140px] font-mono mt-2"
            value={rules}
            onChange={(e) => { setRules(e.target.value); setSavedRules(false); }}
            onBlur={() => { saveNetwork({ rules: rules || null }); setSavedRules(true); }}
            placeholder="Напр.: Тон «Ви», 800-2000 символів, хук з першого рядка…"
          />
          {savedRules && <span className="text-[11px] text-success">✓ Збережено</span>}
        </section>

        {/* Куди йде посилання */}
        <section className="border border-border rounded-xl bg-canvas-subtle p-4">
          <h2 className="text-sm font-semibold text-fg">Куди йде посилання (CTA)</h2>
          <Hint text="Де розмістити лінк на воронку/лід-магніт. Це важливо: у Instagram посилання в пості НЕактивні, тому їх ведуть у шапку; у Threads/LinkedIn активні лише в коментарі; у Telegram — прямо в тексті." />
          <div className="flex flex-wrap gap-2 mt-2">
            {LINK_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => { setLinkPlacement(o.value); saveNetwork({ linkPlacement: o.value }); }}
                title={o.hint}
                className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors",
                  linkPlacement === o.value ? "bg-accent text-white border-accent" : "text-fg-muted border-border hover:border-accent/50")}
              >
                {o.label}
              </button>
            ))}
          </div>
          {linkPlacement && <Hint text={LINK_OPTIONS.find((o) => o.value === linkPlacement)?.hint || ""} />}
        </section>

        {/* Формати */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-fg">Формати цієї мережі</h2>
            <Hint text="Формат — у якому вигляді допис (пост, сторіз, рілс, карусель, тред…). Кожен формат дозволяє свої медіа-типи. Генератор бере лише формати цієї мережі." />
          </div>

          {formats.length === 0 && <p className="text-xs text-fg-subtle">Форматів ще нема.</p>}

          {formats.map((f) => (
            <div key={f.id} className="border border-border rounded-xl bg-canvas-subtle p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-fg">{f.name}</h3>
                    <span className="text-[10px] text-fg-subtle px-1.5 py-0.5 bg-border/40 rounded">{f.key}</span>
                  </div>
                  {FORMAT_HINTS[f.key] && <Hint text={FORMAT_HINTS[f.key]} />}
                </div>
                <button onClick={() => deleteFormat(f.id, f.name)} className="text-fg-subtle hover:text-danger text-sm p-1">🗑</button>
              </div>

              {/* Медіа-типи */}
              <div className="mt-3">
                <label className="block text-[11px] font-medium text-fg-muted mb-1">Дозволені медіа-типи</label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_MEDIA.map((m) => (
                    <button
                      key={m}
                      onClick={() => toggleMedia(f, m)}
                      title={MEDIA_HINT[m]}
                      className={cn("text-xs px-2.5 py-0.5 rounded-full border transition-colors",
                        f.mediaTypes.includes(m) ? "bg-accent text-white border-accent" : "text-fg-muted border-border hover:border-accent/50")}
                    >
                      {MEDIA_LABEL[m]}
                    </button>
                  ))}
                </div>
                <Hint text="Кожен медіа-тип запускає свою воронку генерації зі своїми полями (промпт фото/відео, палітра, слайди…). Текст → застосовуються текст-структури." />
              </div>

              {/* Aspect */}
              <div className="mt-3">
                <label className="block text-[11px] font-medium text-fg-muted mb-1">Співвідношення сторін</label>
                <div className="flex flex-wrap gap-1.5">
                  {ASPECTS.map((a) => (
                    <button
                      key={a.v}
                      onClick={() => patchFormat(f.id, { aspect: a.v })}
                      title={a.h}
                      className={cn("text-xs px-2.5 py-0.5 rounded-full border transition-colors",
                        f.aspect === a.v ? "bg-accent text-white border-accent" : "text-fg-muted border-border hover:border-accent/50")}
                    >
                      {a.v}
                    </button>
                  ))}
                </div>
                {f.aspect && <Hint text={ASPECTS.find((a) => a.v === f.aspect)?.h || ""} />}
              </div>

              {/* Відео-налаштування (якщо є відео) */}
              {(f.mediaTypes.includes("video") || f.mediaTypes.includes("image_music")) && (
                <div className="mt-3">
                  <label className="block text-[11px] font-medium text-fg-muted mb-1">Налаштування відео</label>
                  <label className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!f.settings?.subtitles}
                      onChange={(e) => patchFormat(f.id, { settings: { ...f.settings, subtitles: e.target.checked } })}
                    />
                    Субтитри
                  </label>
                  <Hint text="Тривалість, музику й обкладинку задаватимеш при генерації конкретного поста (це поля воронки). Тут — дефолти формату." />
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
