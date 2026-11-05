// Рекламні креативи для Facebook / Instagram (Meta Ads) як окремий «тип мережі» content2 (platformKey = "meta_ads").
// Цей файл — єдине джерело правил: текст правил мережі (його читає генератор) + детермінований гейт, який
// перевіряє готовий креатив ДО збереження в план. Модель не вміє точно рахувати символи й сама собі не суддя,
// тож ліміти й заборони перевіряє код (як writingGate для текстових мереж).
//
// Креатив = структура funnel_params.ad (машинне) + content (людський блок для копіювання в Ads Manager).

import { scanWriting, type Violation } from "./writingGate";

export const AD_PLATFORM_KEY = "meta_ads";

/** Дозволені кнопки заклику (українські назви кнопок Ads Manager). */
export const AD_CTA_BUTTONS = ["Дізнатися більше", "Зв'язатися з нами", "Записатися", "Надіслати повідомлення", "Завантажити", "Отримати пропозицію"];

/** Ліміти. Primary: Meta обрізає основний текст після ~125 символів («…ще») — головне має бути до цієї межі. */
export const AD_LIMITS = {
  headlineMax: 40,        // заголовок під картинкою
  descriptionMax: 30,     // опис (часто не показується)
  primaryVisible: 125,    // скільки видно без «ще»
  primaryMax: 500,        // жорстка стеля, щоб не писати простирадла
  overlayTitleWords: 8,   // текст на картинці: заголовок
  overlayTitleChars: 60,
  overlaySubWords: 12,    // текст на картинці: підзаголовок
  emojiMax: 2,
  exclamationMax: 1,
};

/** Розміри й безпечні зони (px для 1080 по ширині). */
export const AD_ASPECTS: Record<string, { w: number; h: number; placement: string; safeTop: number; safeBottom: number }> = {
  "4:5": { w: 1080, h: 1350, placement: "Стрічка Facebook/Instagram", safeTop: 0, safeBottom: 0 },
  "1:1": { w: 1080, h: 1080, placement: "Стрічка, карусель", safeTop: 0, safeBottom: 0 },
  "9:16": { w: 1080, h: 1920, placement: "Stories / Reels", safeTop: 250, safeBottom: 340 },
};

/** Межі слова для кирилиці: JS-шний \b з нею не працює, тому явні перевірки «не літера поруч». */
const L0 = "(?<![\\p{L}])";
const L1 = "(?![\\p{L}])";
const word = (body: string) => new RegExp(L0 + "(?:" + body + ")" + L1, "iu");

/** Слова, що ламають правило «прості слова» (skill landing-conversion §3). */
const JARGON: { re: RegExp; name: string }[] = [
  { re: new RegExp(String.raw`воронк`, "iu"), name: "воронка" },
  { re: word("лід(?:и|ів|а|ом|у)?"), name: "лід" },
  { re: new RegExp(String.raw`конверс`, "iu"), name: "конверсія" },
  { re: new RegExp(String.raw`оптиміз`, "iu"), name: "оптимізація" },
  { re: new RegExp(String.raw`масштабу`, "iu"), name: "масштабування" },
  { re: new RegExp(String.raw`екосистем`, "iu"), name: "екосистема" },
  { re: new RegExp(String.raw`трансформац`, "iu"), name: "трансформація" },
  { re: word("ясність"), name: "ясність" },
  { re: new RegExp(String.raw`контент-план`, "iu"), name: "контент-план" },
];

/** Заборонені Meta обіцянки й тиск на особисті ознаки. */
const POLICY: { re: RegExp; why: string }[] = [
  { re: new RegExp(String.raw`гаранту[єю]м|гарантований результат|гарантія результату|без ризику`, "iu"), why: "гарантія результату (Meta вважає оманливою обіцянкою)" },
  { re: new RegExp(String.raw`100\s?%`, "u"), why: "«100%» (недоказана абсолютна обіцянка)" },
  { re: new RegExp(String.raw`заробля(?:й|єш|ти)\s+\d|\$\s?\d{3,}\s+(?:на|за)\s+(?:день|тиждень|місяць)|пасивн\p{L}* дохід`, "iu"), why: "обіцянка доходу" },
  { re: word("facebook|instagram|фейсбук|інстаграм|meta"), why: "згадка назви Facebook/Instagram/Meta в тексті (заборонено правилами реклами)" },
  { re: new RegExp(L0 + "(?:ти|ви|вас|тебе|тобі|вам)\\s+(?:\\S+\\s+){0,3}(?:втомил|хвор|борг|самотн|товст|збитков|банкрут|безробітн|депресі|тривож|нещасн)", "iu"), why: "натяк, що Meta знає особисту ознаку людини (стан, борги, здоров'я): пиши про ситуацію, а не про людину" },
  { re: new RegExp(String.raw`до і після|до\s*\/\s*після|before\s*\/?\s*after`, "iu"), why: "формулювання «до і після» (дозволено лише для реальних кейсів без обіцянки результату)" },
  { re: new RegExp(String.raw`термінов[оі]|останній шанс|тільки сьогодні|лишилось \d+ місц`, "iu"), why: "вигаданий дефіцит/тиск (дозволено, лише якщо це підтверджений факт)" },
];

export type AdCreative = {
  angle?: string;            // pain | outcome | objection | proof | curiosity | how_it_works | lead_magnet
  primary: string;           // основний текст
  headline: string;          // заголовок
  description?: string;      // опис (до 30)
  cta: string;               // назва кнопки
  link: string;              // посилання призначення (https)
  overlayTitle?: string;     // текст НА картинці: заголовок
  overlaySub?: string;       // текст НА картинці: підзаголовок
  visual?: string;           // опис картинки (EN) для генератора, без тексту й логотипів у кадрі
  aspect?: string;           // 4:5 | 9:16 | 1:1
  leadMagnet?: string | null;
  utm?: string;
};

const words = (s: string) => String(s || "").trim().split(/\s+/).filter(Boolean).length;
const chars = (s: string) => Array.from(String(s || "").trim()).length;
const emojiCount = (s: string) => (String(s || "").match(new RegExp(String.raw`\p{Extended_Pictographic}`, "gu")) || []).length;

/** Перевірка креативу. Порожній масив = можна у план. Порушення повертаються так само, як у writingGate. */
export function scanAd(ad: Partial<AdCreative>, opts: { requireLink?: boolean } = {}): Violation[] {
  const v: Violation[] = [];
  const add = (type: string, detail: string) => v.push({ type, detail });
  const primary = String(ad.primary || "").trim();
  const headline = String(ad.headline || "").trim();
  const description = String(ad.description || "").trim();

  if (!primary) add("no_primary", "нема основного тексту");
  if (!headline) add("no_headline", "нема заголовка");
  if (headline && chars(headline) > AD_LIMITS.headlineMax) add("headline_long", `заголовок ${chars(headline)} символів при ліміті ${AD_LIMITS.headlineMax}`);
  if (description && chars(description) > AD_LIMITS.descriptionMax) add("description_long", `опис ${chars(description)} символів при ліміті ${AD_LIMITS.descriptionMax}`);
  if (primary && chars(primary) > AD_LIMITS.primaryMax) add("primary_long", `основний текст ${chars(primary)} символів при стелі ${AD_LIMITS.primaryMax}`);
  if (primary) {
    // Перший абзац (те, що видно без «ще») має нести думку: не починатися з привітання і вкладатись у 125.
    const firstLine = primary.split(/\n/)[0].trim();
    if (chars(firstLine) > AD_LIMITS.primaryVisible) add("hook_hidden", `перший рядок ${chars(firstLine)} символів: думка обріжеться після ${AD_LIMITS.primaryVisible} (поставь суть у перші ${AD_LIMITS.primaryVisible})`);
  }
  if (!ad.cta || !AD_CTA_BUTTONS.includes(ad.cta)) add("bad_cta", `кнопка «${ad.cta || ""}» не зі списку: ${AD_CTA_BUTTONS.join(", ")}`);
  // Посилання необовʼязкове: його часто додають безпосередньо в кабінеті Meta. Якщо задано, мусить бути https.
  if (ad.link && !/^https?:\/\//i.test(ad.link)) add("bad_link", "посилання має починатися з https://");
  if (opts.requireLink === true && !ad.link) add("no_link", "нема посилання призначення (https://…)");

  const ot = String(ad.overlayTitle || "").trim();
  const os = String(ad.overlaySub || "").trim();
  if (ot && (words(ot) > AD_LIMITS.overlayTitleWords || chars(ot) > AD_LIMITS.overlayTitleChars)) add("overlay_title_long", `текст на картинці: ${words(ot)} слів / ${chars(ot)} символів (макс ${AD_LIMITS.overlayTitleWords} слів і ${AD_LIMITS.overlayTitleChars} символів)`);
  if (os && words(os) > AD_LIMITS.overlaySubWords) add("overlay_sub_long", `підзаголовок на картинці ${words(os)} слів (макс ${AD_LIMITS.overlaySubWords})`);
  if (ad.aspect && !AD_ASPECTS[ad.aspect]) add("bad_aspect", `формат «${ad.aspect}» не підтримується (4:5, 1:1, 9:16)`);

  const all = [primary, headline, description, ot, os].join("\n");
  if (emojiCount(primary) > AD_LIMITS.emojiMax) add("emoji", `емодзі в основному тексті: ${emojiCount(primary)} (макс ${AD_LIMITS.emojiMax})`);
  if ((all.match(/!/g) || []).length > AD_LIMITS.exclamationMax) add("exclamation", `знаків оклику більше ${AD_LIMITS.exclamationMax}`);
  const caps = (all.match(new RegExp(L0 + "[А-ЯІЇЄҐA-Z]{4,}" + L1, "gu")) || []).filter((w) => !/^(CRM|API|GPT|PDF|SMM)$/.test(w));
  if (caps.length >= 2) add("caps", `слова КАПСОМ: ${caps.slice(0, 3).join(", ")}`);
  for (const j of JARGON) if (j.re.test(all)) add("jargon", `складне слово «${j.name}»: поясни простими словами`);
  for (const p of POLICY) if (p.re.test(all)) add("policy", p.why);

  // Стандарт письма (стоп-слова, тире, кліше) — той самий, що й для текстових мереж.
  for (const x of scanWriting([primary, headline, description].join("\n\n"))) add(x.type, x.detail);
  return v;
}

/** Людський блок для поля content (копіюється в Ads Manager). */
export function formatAdContent(ad: Partial<AdCreative>): string {
  return [
    `Основний текст:\n${ad.primary || ""}`,
    `Заголовок: ${ad.headline || ""}`,
    ad.description ? `Опис: ${ad.description}` : "",
    `Кнопка: ${ad.cta || ""}`,
    `Посилання: ${ad.link || "додається в Ads Manager"}`,
    ad.overlayTitle ? `Текст на картинці: ${ad.overlayTitle}${ad.overlaySub ? ` / ${ad.overlaySub}` : ""}` : "",
  ].filter(Boolean).join("\n");
}

/** Правила мережі (читає генератор і людина на сторінці мережі). */
export const AD_NETWORK_RULES = [
  "РЕКЛАМНІ КРЕАТИВИ Facebook / Instagram (Meta Ads). Це НЕ пости для стрічки: креатив купує перегляд у холодної аудиторії і веде до ОДНІЄЇ дії. Публікуємо не ми — креатив вантажиться в Ads Manager вручну.",
  "1) ОДИН креатив = одна аудиторія + одна думка + одна дія. Не змішуй кілька пропозицій. Кожен новий креатив у наборі перевіряє ОДНУ змінну (інший біль, інший вхід, інший доказ).",
  "2) Структура: основний текст (суть у перших 125 символах, бо далі «ще»), заголовок ≤ 40 символів, опис ≤ 30, кнопка зі списку (Дізнатися більше, Зв'язатися з нами, Записатися, Надіслати повідомлення, Завантажити, Отримати пропозицію), посилання https.",
  "3) Текст НА картинці: заголовок ≤ 8 слів (≤ 60 символів), підзаголовок ≤ 12 слів. Великий шрифт, читається на телефоні без зуму. Менше тексту краще: картинка показує ситуацію, слова пояснюють вигоду.",
  "4) Розміри: стрічка 4:5 (1080×1350), карусель 1:1 (1080×1080), Stories/Reels 9:16 (1080×1920). У 9:16 верхні 250 px і нижні 340 px порожні від тексту й логотипів (там інтерфейс Meta).",
  "5) Відео: 9:16, до 15 секунд, суть за перші 3 секунди, субтитри обов'язкові (дивляться без звуку), без обличчя можна. Заклик до дії озвучуй у підписі/кнопці, а не «запікай» у кадр (він змінюється).",
  "6) Прості слова: без «воронка, лід, конверсія, оптимізація, масштабування, екосистема, трансформація». Біль називай словами клієнта, не термінами.",
  "7) Не лякай і не вказуй на людину: пиши про СИТУАЦІЮ («повідомлення губляться»), а не про стан людини («ти виснажений, у боргах»). Meta карає за натяк, що знає особисті ознаки.",
  "8) Заборонено: гарантії результату і «100%», обіцянки доходу, назви Facebook/Instagram/Meta у тексті, «до і після» без реального кейсу, вигаданий дефіцит («лишилось 3 місця»), КАПС, більше одного «!», більше двох емодзі.",
  "9) Чесність: цифри, кейси, відгуки — лише з бази (кейси з дозволеними формулюваннями, актуальні факти). Нема доказу — не вигадуй, роби креатив про біль або про те, як це працює.",
  "10) Ціна: якщо продукт дорожчий за $150 — ціни в рекламі немає, замість неї «що входить» і «як дізнатися суму». До $150 ціну можна показати лише якщо вона є в актуальних фактах.",
  "11) Лід-магніт (якщо використовується): обіцянка креативу = рівно те, що дає магніт; кнопка «Завантажити» або «Отримати пропозицію»; посилання на бота з відстеженням. Без магніту: кнопка «Записатися» / «Надіслати повідомлення» на консультацію.",
  "12) Відстеження: у посилання додається utm (джерело facebook/instagram, medium paid_social, campaign = пропозиція, content = номер креативу і кут). Назва креативу в Ads Manager = номер у плані + кут.",
  "13) Набір для тесту: 4-6 креативів на одну пропозицію з різними кутами (біль, вигода, заперечення, доказ, цікавість, «як це працює»), по 2 формати (4:5 і 9:16). Висновки — після ~100 переходів на креатив, не раніше.",
].join("\n");

/** Структури-скелети рекламного тексту (кути). Кожна — підказка генератору, не шаблон дослівно. */
export const AD_ANGLES: { key: string; name: string; structure: string; rules: string }[] = [
  { key: "ad_pain", name: "Реклама: біль ситуації", structure: "Впізнавана ситуація клієнта (1 речення) → чому так відбувається (1 речення) → що можна зробити просто → кнопка.", rules: "Біль словами клієнта, без лякання і без натяків на особу. Картинка: сама ситуація (екран, чат, стіл), без людей, що страждають." },
  { key: "ad_outcome", name: "Реклама: бажаний результат", structure: "Конкретний результат у числах/діях («5 місць, де втрачається час») → як до нього прийти за один крок → кнопка.", rules: "Результат без гарантій: «побачите», «отримаєте план», а не «заробите»." },
  { key: "ad_objection", name: "Реклама: зняття заперечення", structure: "Сумнів, який кажуть уголос («це дорого / довго / складно») → коротка відповідь фактом → кнопка.", rules: "Заперечення беремо з персон (поле «заперечення»), відповідаємо фактом з бази, не емоцією." },
  { key: "ad_proof", name: "Реклама: доказ (реальний кейс)", structure: "Результат реального кейсу (тільки з дозволених формулювань) → що саме зробили → кнопка.", rules: "Лише якщо в базі є кейс і allowedClaims. Без кейсу цей кут не використовувати." },
  { key: "ad_curiosity", name: "Реклама: цікавість", structure: "Несподіваний факт або питання з бази → один рядок пояснення → кнопка.", rules: "Без клікбейту й нечесної інтриги: відповідь на питання має бути на сторінці призначення." },
  { key: "ad_lead_magnet", name: "Реклама: лід-магніт", structure: "Що людина отримає безкоштовно (назва магніту + що всередині за 1 фразою) → навіщо це їй → кнопка «Завантажити».", rules: "Обіцянка = рівно зміст магніту. Назва магніту як є в базі." },
  { key: "ad_video_hook", name: "Реклама-відео: хук 3 секунди", structure: "0-3с: ситуація/питання на екрані → 3-9с: що змінюється → 9-15с: рішення одним реченням, без запеченого заклику (він у кнопці).", rules: "9:16, до 15 с, субтитри завжди, суть у перших 3 с, без людини в кадрі, один і той самий стиль у всіх сценах." },
];
