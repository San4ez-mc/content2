// Рекламний бриф і банк болів для воронок рекламних креативів (meta_ads).
// Чому це окремо: креативи з «загальних болів» («рутина», «хаос») нічого не зачіпали. Креатив тримається на трьох речах,
// які ШІ не може вигадати і які має дати людина: (1) хто саме клієнт і кого не беремо, (2) конкретна сцена болю словами клієнта
// з реальною цифрою, (3) що пропонуємо першим кроком. Усе це живе в базі проєкту як документи (KnowledgeEntry),
// а перед замовленням реклами код перевіряє, чи вони заповнені. Якщо ні, замовлення зупиняється й повертає питання, які треба поставити людині.
//
// Категорії починаються з "onboarding-doc": get_rules їх не віддає в чат контент-менеджера (це службові документи).

export const AD_BRIEF_CATEGORY = "onboarding-doc-ad-brief";
export const AD_PAIN_CATEGORY = "onboarding-doc-ad-pain";
export const AD_BRIEF_PREFIX = "Бриф: ";
export const MIN_PAINS = 5;
const MIN_SECTION_CHARS = 60;

export type BriefSection = { key: string; title: string; questions: string[] };

/** Обовʼязкові розділи брифу. Це ж і є «що питати в людини перед замовленням реклами». */
export const AD_BRIEF_SECTIONS: BriefSection[] = [
  {
    key: "icp", title: "Бриф: хто наш клієнт",
    questions: [
      "З яким клієнтом найприємніше й найвигідніше працювати? 3-5 реальних типів: галузь, скільки людей у команді, приблизний оборот, хто вирішує.",
      "Хто приймає рішення про покупку (власник, директор, керівник відділу, HR)?",
    ],
  },
  {
    key: "anti", title: "Бриф: хто не наш клієнт",
    questions: ["Кого відсікаємо? Які люди й типи бізнесу точно не підходять і чому?"],
  },
  {
    key: "moments", title: "Бриф: що штовхає звернутись",
    questions: ["Що сталося у 2-3 реальних клієнтів за тиждень до звернення? Яка подія їх «дожала»?"],
  },
  {
    key: "words", title: "Бриф: слова клієнтів",
    questions: ["Які фрази клієнти кажуть на першому дзвінку? Дослівно, не маркетинговими словами."],
  },
  {
    key: "objections", title: "Бриф: страхи і відповіді",
    questions: ["Чого бояться клієнти? Що ви їм відповідаєте на кожен страх (факт, а не обіцянка)?"],
  },
  {
    key: "offer", title: "Бриф: сходинки пропозиції",
    questions: [
      "Що людина отримує безкоштовно після кліку (назва, що це за документ)?",
      "Що платний перший крок: що входить, скільки триває, скільки коштує, що на виході?",
      "Що далі після першого кроку?",
    ],
  },
  {
    key: "diff", title: "Бриф: чим відрізняємось",
    questions: ["Чим ви відрізняєтесь від підрядників, після яких «зробили, а воно не працює»? 1-2 реальні відмінності."],
  },
  {
    key: "tone", title: "Бриф: тон, мова, межі",
    questions: [
      "Який тон (спокійний по справі, дружній, різкий)? Приклади реклами, яка подобається, і яка ні.",
      "Мова реклами (українська/російська)? Що не можна писати (слова, обіцянки, теми)?",
      "Чи можна фото й обличчя автора, відгуки, логотипи клієнтів?",
    ],
  },
];

export type Pain = {
  id: string;
  title: string;
  segment: string;       // кому болить
  scene: string;         // конкретний момент із життя, словами клієнта
  hooks: string[];       // варіанти заголовка на картинці (ситуація або цифра)
  evidence: "case" | "hypothesis";
  proof?: string;        // для case: що саме можна стверджувати (дослівно з кейсу)
  caseId?: string;
  angle?: string;        // pain | outcome | objection | proof | curiosity | lead_magnet
  layout?: string;       // headline_illustration | before_after | list
  visual?: string;       // ідея ілюстрації (EN)
  words?: string[];      // як це каже сам клієнт
};

export type BriefEntry = { id?: string; category: string; title: string; content: string; isActive?: boolean };

const asArr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x || "").trim()).filter(Boolean) : []);

/** Розбір одного запису банку болів. Битий JSON або запис без сцени/заголовків повертає null. */
export function parsePain(e: BriefEntry): Pain | null {
  if (!e || e.category !== AD_PAIN_CATEGORY || e.isActive === false) return null;
  let j: any;
  try { j = JSON.parse(e.content); } catch { return null; }
  if (!j || typeof j !== "object") return null;
  const hooks = asArr(j.hooks);
  const scene = String(j.scene || "").trim();
  if (!hooks.length || !scene) return null;
  return {
    id: String(j.id || e.title).trim(),
    title: String(j.title || e.title).trim(),
    segment: String(j.segment || "").trim(),
    scene, hooks,
    evidence: j.evidence === "case" ? "case" : "hypothesis",
    proof: j.proof ? String(j.proof).trim() : undefined,
    caseId: j.caseId ? String(j.caseId) : undefined,
    angle: j.angle ? String(j.angle) : undefined,
    layout: j.layout ? String(j.layout) : undefined,
    visual: j.visual ? String(j.visual) : undefined,
    words: asArr(j.words),
  };
}

export function parsePains(entries: BriefEntry[]): Pain[] {
  return entries.map(parsePain).filter((p): p is Pain => !!p);
}

export type Readiness = { ready: boolean; missing: { key: string; title: string; questions: string[]; reason: string }[]; painCount: number };

/** Чи достатньо в базі, щоб робити якісні креативи. missing = що саме й які питання поставити людині. */
export function briefReadiness(entries: BriefEntry[]): Readiness {
  const missing: Readiness["missing"] = [];
  for (const s of AD_BRIEF_SECTIONS) {
    const e = entries.find((x) => x.category === AD_BRIEF_CATEGORY && x.title === s.title && x.isActive !== false);
    if (!e) missing.push({ ...s, reason: "розділу нема" });
    else if (String(e.content || "").trim().length < MIN_SECTION_CHARS) missing.push({ ...s, reason: "розділ порожній або надто короткий" });
  }
  const painCount = parsePains(entries).length;
  if (painCount < MIN_PAINS) {
    missing.push({
      key: "pains", title: "Банк болів",
      questions: [
        "Назви 5 болів, за вирішення яких платять найохочіше. У кожного: конкретний момент (сцена), слова клієнта, цифра (годин, гривень, хвилин).",
        "Дай 3-5 реальних кейсів: що було, що зробили, що стало, за який строк. Чи можна називати галузь?",
      ],
      reason: `у банку ${painCount} болів із сценою і заголовками, потрібно щонайменше ${MIN_PAINS}`,
    });
  }
  return { ready: missing.length === 0, missing, painCount };
}

/** Текст брифу для запиту копірайтеру: розділи в порядку AD_BRIEF_SECTIONS. */
export function briefText(entries: BriefEntry[]): string {
  const parts: string[] = [];
  for (const s of AD_BRIEF_SECTIONS) {
    const e = entries.find((x) => x.category === AD_BRIEF_CATEGORY && x.title === s.title && x.isActive !== false);
    if (e && e.content.trim()) parts.push(`${s.title.replace(AD_BRIEF_PREFIX, "").toUpperCase()}:\n${e.content.trim()}`);
  }
  return parts.length ? `РЕКЛАМНИЙ БРИФ (від власника, головніший за загальні дані нижче):\n\n${parts.join("\n\n")}` : "";
}

export type PrevAd = { pain?: string | null; angle?: string | null };

/** Які болі брати для нового замовлення: найменш використані спершу, у стабільному порядку банку; кути чергуємо, щоб набір не був однотонним. */
export function pickPains(bank: Pain[], previous: PrevAd[], count: number): Pain[] {
  const used = new Map<string, number>();
  for (const p of previous) if (p.pain) used.set(String(p.pain), (used.get(String(p.pain)) || 0) + 1);
  const order = bank.map((p, i) => ({ p, i, u: used.get(p.id) || 0 })).sort((a, b) => a.u - b.u || a.i - b.i);
  const out: Pain[] = [];
  const angleCount = new Map<string, number>();
  const rest = order.slice();
  while (out.length < count && rest.length) {
    // перший у черзі, чий кут ще не переважає (макс. 2 однакових кути в наборі, поки є інші)
    let idx = rest.findIndex((r) => (angleCount.get(r.p.angle || "pain") || 0) < 2);
    if (idx < 0) idx = 0;
    const [r] = rest.splice(idx, 1);
    out.push(r.p);
    angleCount.set(r.p.angle || "pain", (angleCount.get(r.p.angle || "pain") || 0) + 1);
  }
  return out;
}

/** Формат, який очікує воронка (поле pains[] у ads-creative-*). */
export function painForFunnel(p: Pain, i = 0) {
  return {
    id: p.id,
    pain: `${p.title}. Сцена: ${p.scene}${p.words && p.words.length ? ` Як це кажуть самі: ${p.words.map((w) => `«${w}»`).join("; ")}.` : ""}${p.segment ? ` Кому болить: ${p.segment}.` : ""}`,
    hook: p.hooks[i % p.hooks.length],
    evidence: p.evidence,
    proof: p.evidence === "case" ? p.proof || "" : "",
    ...(p.layout ? { layout: p.layout } : {}),
    ...(p.angle ? { angle: p.angle } : {}),
    ...(p.visual ? { visual: p.visual } : {}),
  };
}
