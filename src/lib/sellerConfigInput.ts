// Перевірка вхідних даних налаштувань ШІ-продавця (чиста логіка, тести — sellerConfigInput.test.ts).
export const STATUSES = ["draft", "testing", "live", "paused"] as const;
export const MODES = ["book_consult", "paid_consult"] as const;
export const CURRENCIES = ["UAH", "USD", "EUR"] as const;
export const TEXT_KEYS = ["greeting", "notRelevant", "softExit", "nudge", "unavailable", "direct", "paid", "afterEnd"] as const;

export type ConfigPatch = Partial<{
  status: string; mode: string; sellerName: string; sellerTitle: string; primaryProductId: string | null;
  bookingUrl: string | null; bookingNote: string | null; handoffTelegramId: string | null; allowedContacts: string | null;
  priceAmount: number | null; currency: string; paymentConnectorId: string | null; monthlyDialogLimit: number | null;
  testAllowlist: string[]; texts: Record<string, string>;
}>;

type Result = { ok: true; data: ConfigPatch } | { ok: false; error: string };

const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const str = (v: unknown) => (v == null ? "" : String(v)).trim();

export function sanitizeConfigInput(body: Record<string, unknown>): Result {
  const d: ConfigPatch = {};
  const fail = (error: string): Result => ({ ok: false, error });

  if (has(body, "status")) { const v = str(body.status); if (!(STATUSES as readonly string[]).includes(v)) return fail("status має бути: " + STATUSES.join(" | ")); d.status = v; }
  if (has(body, "mode")) { const v = str(body.mode); if (!(MODES as readonly string[]).includes(v)) return fail("mode має бути: " + MODES.join(" | ")); d.mode = v; }
  if (has(body, "sellerName")) { const v = str(body.sellerName); if (v.length > 60) return fail("Імʼя продавця задовге (до 60 символів)"); d.sellerName = v; }
  if (has(body, "sellerTitle")) { const v = str(body.sellerTitle); if (v.length > 120) return fail("Титул продавця задовгий (до 120 символів)"); d.sellerTitle = v; }
  if (has(body, "primaryProductId")) d.primaryProductId = str(body.primaryProductId) || null;
  if (has(body, "bookingUrl")) {
    const v = str(body.bookingUrl);
    if (v && !/^https?:\/\/[^\s]+$/i.test(v)) return fail("Посилання на запис має починатися з http:// або https://");
    if (v.length > 500) return fail("Посилання на запис задовге");
    d.bookingUrl = v || null;
  }
  if (has(body, "bookingNote")) { const v = str(body.bookingNote); if (v.length > 1500) return fail("Опис запису задовгий (до 1500 символів)"); d.bookingNote = v || null; }
  if (has(body, "handoffTelegramId")) {
    const v = str(body.handoffTelegramId);
    if (v && !/^\d{5,15}$/.test(v)) return fail("Telegram ID має бути числом (5-15 цифр), а не @нікнеймом");
    d.handoffTelegramId = v || null;
  }
  if (has(body, "allowedContacts")) { const v = str(body.allowedContacts); if (v.length > 500) return fail("Контакти задовгі (до 500 символів)"); d.allowedContacts = v || null; }
  if (has(body, "priceAmount")) {
    const raw = body.priceAmount;
    if (raw === null || raw === "" || raw === undefined) d.priceAmount = null;
    else { const n = Number(raw); if (!Number.isInteger(n) || n < 0 || n > 10_000_000) return fail("Сума оплати має бути цілим числом"); d.priceAmount = n; }
  }
  if (has(body, "currency")) { const v = str(body.currency).toUpperCase(); if (!(CURRENCIES as readonly string[]).includes(v)) return fail("Валюта: " + CURRENCIES.join(" | ")); d.currency = v; }
  if (has(body, "paymentConnectorId")) {
    const v = str(body.paymentConnectorId);
    if (v && !/^[A-Za-z0-9-]{8,64}$/.test(v)) return fail("Ідентифікатор платіжного конектора виглядає некоректно");
    d.paymentConnectorId = v || null;
  }
  if (has(body, "monthlyDialogLimit")) {
    const raw = body.monthlyDialogLimit;
    if (raw === null || raw === "" || raw === undefined) d.monthlyDialogLimit = null;
    else { const n = Number(raw); if (!Number.isInteger(n) || n < 1 || n > 100_000) return fail("Ліміт діалогів на місяць: ціле число 1-100000"); d.monthlyDialogLimit = n; }
  }
  if (has(body, "testAllowlist")) {
    const raw = body.testAllowlist;
    const list = Array.isArray(raw) ? raw : String(raw || "").split(/[\s,;]+/);
    const ids = Array.from(new Set(list.map((x) => str(x)).filter(Boolean)));
    if (ids.some((x) => !/^\d{5,15}$/.test(x))) return fail("Тестери: лише числові Telegram ID через кому");
    if (ids.length > 50) return fail("Забагато тестерів (максимум 50)");
    d.testAllowlist = ids;
  }
  if (has(body, "texts")) {
    const raw = body.texts;
    if (raw && typeof raw !== "object") return fail("texts має бути обʼєктом");
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries((raw as Record<string, unknown>) || {})) {
      if (!(TEXT_KEYS as readonly string[]).includes(k)) return fail("Невідомий ключ тексту: " + k);
      const t = str(v);
      if (t.length > 1500) return fail("Текст «" + k + "» задовгий");
      if (t) out[k] = t;
    }
    d.texts = out;
  }
  return { ok: true, data: d };
}

// Підказки від онбордингу заповнюють ЛИШЕ порожні поля й лише ці. Статус, режим, оплату, тестерів, тексти не чіпають:
// ними керує власник у адмінці. Невалідне поле пропускається, не блокуючи решту.
export const PREFILL_KEYS = ["sellerName", "sellerTitle", "bookingUrl", "bookingNote", "allowedContacts", "handoffTelegramId"] as const;

export function prefillPatch(existing: Record<string, unknown> | null | undefined, incoming: Record<string, unknown>): ConfigPatch {
  const out: ConfigPatch = {};
  for (const k of PREFILL_KEYS) {
    const cur = existing ? existing[k] : "";
    if (cur != null && String(cur).trim() !== "") continue; // вже заповнено людиною
    const v = incoming ? incoming[k] : "";
    if (v == null || String(v).trim() === "") continue;
    const one = sanitizeConfigInput({ [k]: v });
    if (one.ok) Object.assign(out, one.data);
  }
  return out;
}
