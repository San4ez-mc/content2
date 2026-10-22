// Бриф ШІ-продавця експерта: чиста логіка без БД (тести — sellerBrief.test.ts).
// Воронка Flows нічого про експерта не зберігає: на початку розмови бере цей бриф і підставляє блоки в промпт.
// Джерела: SellerConfig (правила продажу) + Product/Case/Persona/FounderProfile + документи «Продавець — …»
// (їх пише нода «Записати в content2» онбордингу) + актуальні факти з датами.
import { factsPromptBlock, type FactLike } from "./facts";

export const DOC_PREFIX = "Продавець — ";
// Назви документів = ті, що пише онбординг (platform/scripts/patch-onboard-seller-edit-2026-10-22.js, DOCS).
export const DOC = {
  qualify: "Що з’ясувати про клієнта",
  booking: "Цільова дія і запис",
  never: "Заборонені обіцянки",
  handoff: "Коли передавати розмову людині",
  style: "Мови і стиль спілкування",
  path: "Шлях заявки і головний біль",
  faq: "Часті запитання і відповіді експерта",
  claims: "Кейс і дозволені формулювання",
  name: "Імʼя продавця",
  sensitive: "Чутлива тема",
  notify: "Сповіщення про ліди",
} as const;

// Оплата вперед: нода «connector» двигуна Flows поки ігнорує connectorId і бере ПЕРШИЙ активний WayForPay-конектор платформи (мерчант власника),
// тож клієнт експерта платив би на чужий рахунок. Увімкнути (true) лише після виправлення двигуна (data.connectorId + strictConnector).
export const PAID_MODE_SUPPORTED = false;

export type SellerStatus = "draft" | "testing" | "live" | "paused";
export type SellerMode = "book_consult" | "paid_consult";

export interface ConfigLike {
  status: string; mode: string; sellerName: string; sellerTitle: string;
  primaryProductId?: string | null; bookingUrl?: string | null; bookingNote?: string | null;
  handoffTelegramId?: string | null; allowedContacts?: string | null;
  priceAmount?: number | null; currency?: string | null; paymentConnectorId?: string | null;
  monthlyDialogLimit?: number | null; testAllowlist?: unknown; texts?: unknown;
  funnelBotId?: string | null; templateVersion?: string | null; goLiveAt?: Date | string | null;
}
export interface ProductLike { id: string; name: string; description?: string | null; price?: string | null; audience?: string | null; pains?: string | null; transformation?: string | null; benefits?: string | null; priority?: number | null; isActive?: boolean }
export interface CaseLike { title: string; niche?: string | null; problem?: string | null; solution?: string | null; allowedClaims?: string | null }
export interface PersonaLike { name: string; pains?: string | null; goals?: string | null; tone?: string | null; forbiddenWords?: string | null; objections?: string | null; language?: string | null }
export interface FounderLike { core?: string | null; interactionStyle?: string | null; differentiators?: unknown; selfPresentation?: unknown }
export interface DocLike { title: string; content: string }

export interface BriefInput {
  project: { id: string; name: string };
  config: ConfigLike | null;
  products: ProductLike[];
  cases: CaseLike[];
  personas: PersonaLike[];
  founder: FounderLike | null;
  docs: DocLike[];
  facts: FactLike[];
}

export interface ParsedDoc { value: string; confirmed: boolean; hasUnconfirmed: boolean }

/** «Заголовок поля: значення [підтверджено експертом]» (по рядку на поле) → значення без службових позначок. */
export function parseDoc(text: string | null | undefined): ParsedDoc {
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const values: string[] = [];
  let confirmed = lines.length > 0;
  let hasUnconfirmed = false;
  for (const l of lines) {
    const m = l.match(/\s*\[([^\]]+)\]\s*$/);
    const mark = m ? m[1] : "";
    const body = (m ? l.slice(0, l.length - m[0].length) : l).trim();
    const colon = body.indexOf(": ");
    const value = (colon > 0 && colon < 70 ? body.slice(colon + 2) : body).trim();
    if (value) values.push(value);
    if (mark && !/підтверджено/i.test(mark)) { confirmed = false; hasUnconfirmed = true; }
    if (!mark) confirmed = false;
  }
  if (!values.length) confirmed = false;
  return { value: values.join("\n"), confirmed, hasUnconfirmed };
}

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x == null ? "" : x).trim()).filter(Boolean) : []);
const clip = (s: string | null | undefined, n: number) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

export function docMap(docs: DocLike[]): Record<string, ParsedDoc> {
  const out: Record<string, ParsedDoc> = {};
  for (const d of docs) {
    if (!d.title.startsWith(DOC_PREFIX)) continue;
    const key = d.title.slice(DOC_PREFIX.length).trim();
    if (/^прибрано експертом\.?$/i.test(String(d.content).trim())) continue; // експерт прибрав це поле
    out[key] = parseDoc(d.content);
  }
  return out;
}

export function pickProduct(products: ProductLike[], primaryId?: string | null): ProductLike | null {
  const active = products.filter((p) => p.isActive !== false);
  if (primaryId) { const hit = active.find((p) => p.id === primaryId); if (hit) return hit; }
  return [...active].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))[0] || null;
}

export interface Readiness { ready: boolean; missing: string[]; warnings: string[] }

export function computeReadiness(i: BriefInput, docs: Record<string, ParsedDoc>, product: ProductLike | null, paidSupported: boolean = PAID_MODE_SUPPORTED): Readiness {
  const c = i.config;
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!c) missing.push("не заповнено налаштування продавця");
  if (c && !c.sellerName.trim()) missing.push("імʼя продавця");
  if (c && (!c.sellerTitle.trim() || /^ші-продавець$/i.test(c.sellerTitle.trim()))) missing.push("як продавець представляє експерта (напр. «ШІ-продавець Олександра Мацука»)");
  if (!product) missing.push("послуга (продукт) не знайдена");
  else {
    if (!String(product.price || "").trim()) missing.push("ціна послуги");
    if (!String(product.description || "").trim()) warnings.push("немає опису послуги");
    if (!String(product.audience || "").trim() && !i.personas.length) warnings.push("не описано, кому підходить послуга");
  }
  if (c && c.mode === "paid_consult" && !paidSupported) missing.push("оплата вперед поки недоступна (гроші йшли б на рахунок власника платформи): оберіть режим «запис на консультацію»");
  if (c && c.mode === "paid_consult") {
    if (!c.priceAmount) missing.push("сума оплати (число)");
    if (!c.paymentConnectorId) missing.push("платіжний конектор");
  }
  if (c && !c.handoffTelegramId?.trim()) missing.push("Telegram ID, куди слати гарячих лідів");
  const noBooking = !c?.bookingUrl?.trim() && !c?.bookingNote?.trim() && !docs[DOC.booking]?.value;
  // у платному режимі після оплати експерт сам домовляється про час, тож опис запису не блокує, а лише нагадує
  if (c && noBooking) (c.mode === "paid_consult" ? warnings : missing).push("як записуються (посилання або опис)");
  if (!docs[DOC.never]?.value) missing.push("що бот ніколи не має обіцяти");
  if (!docs[DOC.handoff]?.value) missing.push("коли передавати розмову людині");
  for (const k of [DOC.never, DOC.handoff]) if (docs[k]?.value && !docs[k].confirmed) warnings.push(`«${k}» не підтверджено експертом`);
  if (!docs[DOC.qualify]?.value) warnings.push("не описано, що з’ясовувати про клієнта");
  if (!i.cases.length) warnings.push("немає кейсів: продавець не наводитиме прикладів");
  else if (!i.cases.some((x) => String(x.allowedClaims || "").trim())) warnings.push("у кейсах не вказано дозволені формулювання: цифр і результатів бот не називатиме");
  return { ready: missing.length === 0, missing, warnings };
}

export interface Access { allowed: boolean; reason: string }

export function computeAccess(status: string, readiness: Readiness, allowlist: string[], telegramId?: string | null): Access {
  const tg = String(telegramId || "").trim();
  const listed = !!tg && allowlist.includes(tg);
  if (status === "live") {
    if (!readiness.ready) return listed ? { allowed: true, reason: "live-не-готово, але ти в списку тестерів" } : { allowed: false, reason: "не готово: " + readiness.missing.join("; ") };
    return { allowed: true, reason: "live" };
  }
  if (status === "testing") return listed ? { allowed: true, reason: "testing: тестер" } : { allowed: false, reason: "тестовий режим: доступ лише для тестерів" };
  if (status === "paused") return { allowed: false, reason: "призупинено" };
  return listed ? { allowed: true, reason: "draft: тестер" } : { allowed: false, reason: "ще не запущено" };
}

export function defaultTexts(name: string, title: string, serviceName: string, contacts = ""): Record<string, string> {
  const who = title.trim() || "ШІ-продавець";
  return {
    greeting: `Привіт! Я ${name || "помічник"}, ${who}. Допомагаю з питаннями про «${serviceName || "послугу"}» та записом. Розкажи коротко, що тебе привело?`,
    notRelevant: "Зрозумів, тоді не на часі. Якщо щось зміниться, пиши, завжди радий допомогти.",
    softExit: "Зрозуміло, не поспішаю. Коли буде зручно, просто напиши будь-що в чат, я на місці.",
    nudge: "Привіт! Не набридаю, лише одне запитання: що саме лишилось незрозумілим? Якщо сумнів у ціні, форматі чи в тому, чи це підійде, напиши, розберемось.",
    unavailable: "Зараз я не можу відповісти. Напиши трохи пізніше або звернись до експерта напряму.",
    direct: "Схоже на конкретний запит, його краще обговорити напряму з експертом. Я передав твою заявку, він напише найближчим часом." + (contacts ? " Якщо зручніше самому: " + contacts + "." : ""),
    paid: "Оплату отримано, дякую! Експерт напише тобі найближчим часом і домовиться про час.",
  };
}

export interface Brief {
  ok: true;
  projectId: string; projectName: string;
  status: string; mode: string; paymentSupported: boolean;
  readiness: Readiness; access: Access;
  expert: { sellerName: string; sellerTitle: string; disclosure: "honest_ai"; handoffTelegramId: string; contacts: string; monthlyDialogLimit: number | null };
  offer: { productId: string; name: string; price: string; priceAmount: number | null; currency: string; description: string; audience: string; transformation: string };
  booking: { url: string; note: string };
  payment: { connectorId: string };
  texts: Record<string, string>;
  blocks: { offer: string; proof: string; rules: string; tone: string; facts: string; faq: string; qualify: string; booking: string; all: string };
  funnel: { botId: string; templateVersion: string };
}

export function compileBrief(i: BriefInput, telegramId?: string | null, opts: { paidSupported?: boolean } = {}): Brief {
  const paidSupported = opts.paidSupported ?? PAID_MODE_SUPPORTED;
  const c = i.config;
  const docs = docMap(i.docs);
  const product = pickProduct(i.products, c?.primaryProductId);
  const readiness = computeReadiness(i, docs, product, paidSupported);
  const allowlist = asStrings(c?.testAllowlist);
  const status = c?.status || "draft";
  const access = computeAccess(status, readiness, allowlist, telegramId);
  const sellerName = (c?.sellerName || docs[DOC.name]?.value || "").trim();
  const sellerTitle = (c?.sellerTitle || "").trim();
  const dt = defaultTexts(sellerName, sellerTitle, product?.name || "", (c?.allowedContacts || "").trim());
  const overrides = (c?.texts && typeof c.texts === "object" ? (c.texts as Record<string, unknown>) : {});
  const texts: Record<string, string> = { ...dt };
  for (const [k, v] of Object.entries(overrides)) if (typeof v === "string" && v.trim()) texts[k] = v.trim();

  // ── блоки для промпту ──
  const never = docs[DOC.never]?.value || "";
  const handoff = docs[DOC.handoff]?.value || "";
  const contacts = (c?.allowedContacts || "").trim();
  const sensitive = docs[DOC.sensitive]?.value || "";

  const offer = [
    "━━━ ПРО ПОСЛУГУ (єдине джерело: ціна, формат, що входить) ━━━",
    product ? `Назва: ${product.name}` : "",
    product?.description ? `Що це: ${clip(product.description, 900)}` : "",
    product?.price ? `Ціна: ${product.price}` : "",
    product?.audience ? `Кому підходить: ${clip(product.audience, 600)}` : "",
    product?.transformation ? `Результат для клієнта: ${clip(product.transformation, 400)}` : "",
    `Режим: ${c?.mode === "paid_consult" ? "запис з оплатою вперед" : "запис на консультацію"}`,
  ].filter(Boolean).join("\n");

  const proof = i.cases.length
    ? "━━━ КЕЙСИ ЕКСПЕРТА ━━━\nНаводь цифри й результати ТІЛЬКИ в дозволених формулюваннях. Якщо дозволених формулювань нема, не називай цифр і результатів із цього кейсу.\n" +
      i.cases.map((x, n) => [
        `${n + 1}. ${x.title}${x.niche ? ` (${x.niche})` : ""}`,
        x.problem ? `   Ситуація: ${clip(x.problem, 300)}` : "",
        x.solution ? `   Що зроблено: ${clip(x.solution, 400)}` : "",
        String(x.allowedClaims || "").trim() ? `   ДОЗВОЛЕНО казати: ${clip(x.allowedClaims, 400)}` : "   ДОЗВОЛЕНИХ ФОРМУЛЮВАНЬ НЕМАЄ: розкажи лише загальну ситуацію, без цифр і результатів.",
      ].filter(Boolean).join("\n")).join("\n")
    : "━━━ КЕЙСИ ЕКСПЕРТА ━━━\nКейсів немає. Не вигадуй прикладів, клієнтів і результатів.";

  const rules = [
    "━━━ ФАКТИ — НІЧОГО НЕ ВИГАДУЙ ━━━",
    contacts ? `• Контакти, які можна називати: ${clip(contacts, 300)}. Інших телефонів, пошт, нікнеймів і сайтів не називай, навіть якщо просять.` : "• Жодних контактів експерта не називай. Просять контакт → запропонуй залишити свій, експерт напише сам.",
    "• Ціна, формат, що входить у послугу: лише з блоку «ПРО ПОСЛУГУ». Знижки, розстрочки, гарантії, терміни, «зарахування суми» не обіцяй і не вигадуй: питання про це → «це до експерта».",
    "• Цифри й кейси лише з блоку «КЕЙСИ ЕКСПЕРТА» у дозволених формулюваннях. Не додавай відсотків, кількості клієнтів, відгуків, яких там немає.",
    never ? `• ЗАБОРОНЕНО обіцяти/стверджувати: ${clip(never, 700)}` : "",
    sensitive ? `• ЧУТЛИВА ТЕМА: ${clip(sensitive, 500)}` : "",
    handoff ? `• Негайно передай розмову експерту (скажи, що він напише сам), якщо: ${clip(handoff, 700)}` : "",
    "• Ти ШІ-продавець: не видавай себе за людину. Питають, хто ти → чесно скажи.",
    "• Розрахунки: спершу переведи валюту, перевір множення; не впевнений, називай «приблизно» і діапазон.",
  ].filter(Boolean).join("\n");

  const founderBits = [i.founder?.core ? `Хто експерт: ${clip(i.founder.core, 500)}` : "", i.founder?.interactionStyle ? `Як працює з клієнтом: ${clip(i.founder.interactionStyle, 300)}` : ""].filter(Boolean);
  const persona = i.personas[0];
  const tone = [
    "━━━ ГОЛОС І СТИЛЬ ━━━",
    sellerName ? `Тебе звати ${sellerName}${sellerTitle ? `, ${sellerTitle}` : ""}.` : "",
    docs[DOC.style]?.value ? `Мова і стиль за словами експерта: ${clip(docs[DOC.style].value, 500)}` : "Відповідай мовою клієнта; за замовчуванням на «ти», якщо клієнт пише на «Ви», то «Ви» до кінця розмови.",
    persona?.forbiddenWords ? `Слова, яких не вживати: ${clip(persona.forbiddenWords, 200)}` : "",
    ...founderBits,
    "Формат кожного повідомлення: максимум 2-3 речення, одне запитання наприкінці, ніколи два питання разом.",
  ].filter(Boolean).join("\n");

  const factsBlock = factsPromptBlock(i.facts);
  const faq = docs[DOC.faq]?.value ? "━━━ ЧАСТІ ЗАПИТАННЯ ТА ВІДПОВІДІ ЕКСПЕРТА ━━━\n" + clip(docs[DOC.faq].value, 1800) : "";
  const qualify = docs[DOC.qualify]?.value ? "━━━ ЩО З’ЯСОВУВАТИ ПРО ЛЮДИНУ (до пропозиції запису) ━━━\n" + clip(docs[DOC.qualify].value, 800) : "";
  const bookingText = [c?.bookingUrl ? `Посилання на запис: ${c.bookingUrl}` : "", (c?.bookingNote || docs[DOC.booking]?.value || "") && `Запис: ${clip(c?.bookingNote || docs[DOC.booking]?.value, 500)}`].filter(Boolean).join("\n");
  const booking = bookingText ? "━━━ ЯК ЗАПИСАТИСЬ ━━━\n" + bookingText : "";

  const all = [offer, qualify, proof, faq, rules, tone, factsBlock, booking].filter(Boolean).join("\n\n");
  return {
    ok: true, projectId: i.project.id, projectName: i.project.name,
    status, mode: c?.mode || "book_consult", paymentSupported: paidSupported, readiness, access,
    expert: { sellerName, sellerTitle, disclosure: "honest_ai", handoffTelegramId: (c?.handoffTelegramId || "").trim(), contacts: (c?.allowedContacts || "").trim(), monthlyDialogLimit: c?.monthlyDialogLimit ?? null },
    offer: {
      productId: product?.id || "", name: product?.name || "", price: String(product?.price || ""), priceAmount: c?.priceAmount ?? null, currency: c?.currency || "UAH",
      description: String(product?.description || ""), audience: String(product?.audience || ""), transformation: String(product?.transformation || ""),
    },
    booking: { url: (c?.bookingUrl || "").trim(), note: (c?.bookingNote || docs[DOC.booking]?.value || "").trim() },
    payment: { connectorId: (c?.paymentConnectorId || "").trim() },
    texts,
    blocks: { offer, proof, rules, tone, facts: factsBlock, faq, qualify, booking, all },
    funnel: { botId: c?.funnelBotId || "", templateVersion: c?.templateVersion || "" },
  };
}
