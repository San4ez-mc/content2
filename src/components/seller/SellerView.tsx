"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type Cfg = {
  status: string; mode: string; sellerName: string; sellerTitle: string; primaryProductId: string;
  bookingUrl: string; bookingNote: string; handoffTelegramId: string; allowedContacts: string;
  priceAmount: number | ""; currency: string; paymentConnectorId: string; monthlyDialogLimit: number | "";
  testAllowlist: string[]; texts: Record<string, string>; funnelBotId: string; templateVersion: string; goLiveAt: string | null;
};
interface Resp {
  exists: boolean; config: Cfg; products: { id: string; name: string; price: string }[];
  readiness: { ready: boolean; missing: string[]; warnings: string[] };
  hints: { booking: string; notify: string; name: string };
  defaultTexts: Record<string, string>;
  preview: Record<string, string>;
}

const STATUS: { key: string; label: string; hint: string; cls: string }[] = [
  { key: "draft", label: "Чернетка", hint: "Не відповідає нікому, крім тестерів", cls: "border-border/60" },
  { key: "testing", label: "Тест", hint: "Відповідає лише тестерам зі списку", cls: "border-accent/60 bg-accent/5" },
  { key: "live", label: "У роботі", hint: "Відповідає всім (лише коли все готово)", cls: "border-green-500/60 bg-green-500/5" },
  { key: "paused", label: "Пауза", hint: "Не відповідає нікому", cls: "border-amber-500/60 bg-amber-500/5" },
];
const TEXT_LABELS: Record<string, string> = {
  greeting: "Перше повідомлення", notRelevant: "Якщо не актуально", softExit: "Якщо думає (м'який вихід)", nudge: "Нагадування тому, хто замовк", unavailable: "Якщо продавець недоступний", direct: "Коли людину передаємо експерту напряму", paid: "Після оплати",
};
const PREVIEW_LABELS: Record<string, string> = {
  offer: "Про послугу", qualify: "Що з'ясовувати", proof: "Кейси", faq: "Часті запитання", rules: "Правила (що не вигадувати)", tone: "Голос і стиль", booking: "Запис",
};

export function SellerView({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Resp>({
    queryKey: ["seller", projectId],
    queryFn: () => fetch(`/api/seller/config?projectId=${projectId}`).then((r) => r.json()),
    staleTime: 5_000,
  });
  const [f, setF] = useState<Cfg | null>(null);
  const [allow, setAllow] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => { if (data?.config) { setF({ ...data.config, texts: { ...data.config.texts } }); setAllow((data.config.testAllowlist || []).join(", ")); } }, [data]);

  async function save(extra: Partial<Cfg> = {}) {
    if (!f) return;
    setSaving(true); setMsg(null);
    const body = {
      projectId, mode: f.mode, sellerName: f.sellerName, sellerTitle: f.sellerTitle, primaryProductId: f.primaryProductId,
      bookingUrl: f.bookingUrl, bookingNote: f.bookingNote, handoffTelegramId: f.handoffTelegramId, allowedContacts: f.allowedContacts,
      priceAmount: f.priceAmount, currency: f.currency, paymentConnectorId: f.paymentConnectorId, monthlyDialogLimit: f.monthlyDialogLimit,
      testAllowlist: allow, texts: f.texts, ...extra,
    };
    const res = await fetch("/api/seller/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setMsg({ ok: false, text: j.error || "Не вдалося зберегти" }); return; }
    setMsg({ ok: true, text: "Збережено" });
    qc.invalidateQueries({ queryKey: ["seller", projectId] });
  }

  const input = "w-full mt-1 bg-canvas-subtle border border-border rounded px-2 py-1.5 text-sm text-fg";
  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => f && setF({ ...f, [k]: v });

  if (isLoading || !f || !data) return <div className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>;
  const r = data.readiness;

  return (
    <div className="flex flex-col h-[calc(100vh-40px)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-canvas-subtle shrink-0">
        <div>
          <p className="text-sm font-semibold text-fg">ШІ-продавець</p>
          <p className="text-xs text-fg-muted">Правила продажу цього експерта. Послугу, кейси й профіль експерта продавець бере з розділів «Продукти», «Персони» та «Сховище»; тут лише те, що стосується самого продавця.</p>
        </div>
        <button onClick={() => save()} disabled={saving} className="btn-primary text-xs px-3 py-1">{saving ? "Зберігаю…" : "Зберегти"}</button>
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-4xl space-y-6">
        {msg && <p className={cn("text-xs", msg.ok ? "text-green-600" : "text-red-500")}>{msg.text}</p>}

        <section>
          <p className="text-xs font-semibold text-fg-muted mb-2">Статус</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STATUS.map((s) => (
              <button key={s.key} onClick={() => save({ status: s.key } as Partial<Cfg>)} disabled={saving}
                className={cn("text-left border rounded-lg px-3 py-2", s.cls, f.status === s.key ? "ring-2 ring-accent" : "opacity-80 hover:opacity-100")}>
                <p className="text-sm font-medium text-fg">{f.status === s.key ? "● " : ""}{s.label}</p>
                <p className="text-[11px] text-fg-subtle">{s.hint}</p>
              </button>
            ))}
          </div>
          {f.goLiveAt && <p className="text-[11px] text-fg-subtle mt-1">Вперше запущено {f.goLiveAt.slice(0, 10)}</p>}
        </section>

        <section className={cn("border rounded-lg px-3 py-2", r.ready ? "border-green-500/50 bg-green-500/5" : "border-amber-500/50 bg-amber-500/10")}>
          <p className="text-sm font-medium text-fg">{r.ready ? "✅ Усе потрібне для запуску заповнено" : `⚠️ Для запуску бракує: ${r.missing.length}`}</p>
          {r.missing.length > 0 && <ul className="list-disc ml-5 mt-1 text-xs text-fg-muted">{r.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
          {r.warnings.length > 0 && (<><p className="text-xs font-medium text-fg-muted mt-2">Не блокує, але варто перевірити:</p><ul className="list-disc ml-5 text-xs text-fg-subtle">{r.warnings.map((m) => <li key={m}>{m}</li>)}</ul></>)}
        </section>

        <section className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-fg-muted">Як звати продавця</label>
            <input value={f.sellerName} onChange={(e) => set("sellerName", e.target.value)} placeholder="напр. Ден" className={input} />
            {data.hints.name && <p className="text-[11px] text-fg-subtle mt-0.5">З онбордингу: {data.hints.name}</p>}
          </div>
          <div>
            <label className="text-xs text-fg-muted">Як він представляє експерта</label>
            <input value={f.sellerTitle} onChange={(e) => set("sellerTitle", e.target.value)} placeholder="ШІ-продавець Олександра Мацука" className={input} />
          </div>
          <div>
            <label className="text-xs text-fg-muted">Що продає (послуга)</label>
            <select value={f.primaryProductId} onChange={(e) => set("primaryProductId", e.target.value)} className={input}>
              <option value="">Головна за пріоритетом</option>
              {data.products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.price ? ` · ${p.price}` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-fg-muted">Режим</label>
            <select value={f.mode} onChange={(e) => set("mode", e.target.value)} className={input}>
              <option value="book_consult">Запис на консультацію</option>
              <option value="paid_consult">Запис з оплатою вперед</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-fg-muted">Куди слати гарячих лідів (Telegram ID, цифри)</label>
            <input value={f.handoffTelegramId} onChange={(e) => set("handoffTelegramId", e.target.value)} placeholder="345126254" className={input} />
            {data.hints.notify && <p className="text-[11px] text-fg-subtle mt-0.5">З онбордингу: {data.hints.notify}</p>}
          </div>
          <div>
            <label className="text-xs text-fg-muted">Контакти, які бот може називати</label>
            <input value={f.allowedContacts} onChange={(e) => set("allowedContacts", e.target.value)} placeholder="t.me/nickname" className={input} />
          </div>
          <div>
            <label className="text-xs text-fg-muted">Посилання на запис (Calendly, Cal.com…)</label>
            <input value={f.bookingUrl} onChange={(e) => set("bookingUrl", e.target.value)} placeholder="https://" className={input} />
          </div>
          <div>
            <label className="text-xs text-fg-muted">Як записуються, якщо без посилання</label>
            <textarea value={f.bookingNote} onChange={(e) => set("bookingNote", e.target.value)} rows={2} className={input} />
            {data.hints.booking && <p className="text-[11px] text-fg-subtle mt-0.5 whitespace-pre-wrap">З онбордингу: {data.hints.booking}</p>}
          </div>
          {f.mode === "paid_consult" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-fg-muted">Сума оплати</label>
                  <input value={f.priceAmount} onChange={(e) => set("priceAmount", e.target.value === "" ? "" : Number(e.target.value))} inputMode="numeric" className={input} />
                </div>
                <div>
                  <label className="text-xs text-fg-muted">Валюта</label>
                  <select value={f.currency} onChange={(e) => set("currency", e.target.value)} className={input}><option>UAH</option><option>USD</option><option>EUR</option></select>
                </div>
              </div>
              <div>
                <label className="text-xs text-fg-muted">Платіжний конектор (ID зі «Збережених конекторів» Flows)</label>
                <input value={f.paymentConnectorId} onChange={(e) => set("paymentConnectorId", e.target.value)} className={input} />
              </div>
            </>
          )}
          <div>
            <label className="text-xs text-fg-muted">Ліміт діалогів на місяць (порожньо = без ліміту)</label>
            <input value={f.monthlyDialogLimit} onChange={(e) => set("monthlyDialogLimit", e.target.value === "" ? "" : Number(e.target.value))} inputMode="numeric" className={input} />
          </div>
          <div>
            <label className="text-xs text-fg-muted">Тестери (Telegram ID через кому): їм продавець відповідає в статусі «Тест»</label>
            <input value={allow} onChange={(e) => setAllow(e.target.value)} placeholder="345126254, 123456789" className={input} />
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold text-fg-muted">Тексти продавця</p>
          <p className="text-[11px] text-fg-subtle mb-2">Порожнє поле = стандартний текст (він показаний підказкою).</p>
          <div className="space-y-2">
            {Object.keys(TEXT_LABELS).map((k) => (
              <div key={k}>
                <label className="text-xs text-fg-muted">{TEXT_LABELS[k]}</label>
                <textarea value={f.texts[k] || ""} onChange={(e) => set("texts", { ...f.texts, [k]: e.target.value })} rows={2} placeholder={data.defaultTexts[k]} className={input} />
              </div>
            ))}
          </div>
        </section>

        <section>
          <button onClick={() => setShowPreview(!showPreview)} className="text-xs text-fg-muted hover:text-fg">{showPreview ? "▾" : "▸"} Що саме продавець знає про експерта (перевірка)</button>
          {showPreview && (
            <div className="mt-2 space-y-3">
              {Object.keys(PREVIEW_LABELS).map((k) => data.preview[k] ? (
                <div key={k}><p className="text-[11px] font-semibold text-fg-muted">{PREVIEW_LABELS[k]}</p><pre className="text-xs text-fg whitespace-pre-wrap bg-canvas-subtle border border-border rounded p-2">{data.preview[k]}</pre></div>
              ) : null)}
            </div>
          )}
        </section>

        {(f.funnelBotId || f.templateVersion) && (
          <p className="text-[11px] text-fg-subtle">Воронка: {f.funnelBotId || "—"} · версія шаблону {f.templateVersion || "—"}</p>
        )}
      </div>
    </div>
  );
}
