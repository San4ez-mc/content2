// Замовлення рекламних креативів від платформи реклами (ads-sync action=order).
// Раніше будь-яке замовлення йшло контент-менеджеру (content-manager-web): його диспетчер і генератор постів не знають мережі meta_ads,
// тому «рекламні креативи» ставали ЗВИЧАЙНИМИ постами Instagram (текст = лише тема, картинка через fal recraft).
// Тепер замовлення на рекламу йде прямо у воронки реклами (ads-creative-image / -photo / -video): вони самі пишуть креативи
// за правилами adRules, ставлять у мережу meta_ads і рендерять картинки. Усе інше (звичайні пости) лишається за контент-менеджером.

export type AdsOrderPlan = {
  funnel: "ads-creative-image" | "ads-creative-photo" | "ads-creative-video";
  params: Record<string, unknown>;
  summary: string;
  needsPhotos: boolean;
};

// Ознаки замовлення саме РЕКЛАМНОГО креатива (не поста).
const AD_RE = /(реклам[а-яіїєґ]*\s+креатив|креатив[а-яіїєґ]*\s+(?:для\s+)?(?:реклам|meta|facebook|instagram)|meta[_\s-]?ads|ad[_\s-]image|ad[_\s-]video|ad[_\s-]story|реклама\s+fb\/?ig|реклама\s+facebook)/i;

export function isAdsOrder(b: { text?: unknown; kind?: unknown; funnel?: unknown }): boolean {
  if (String(b.kind || "").toLowerCase() === "creatives" || String(b.kind || "").toLowerCase() === "ads") return true;
  if (/^ads-creative-(image|photo|video)$/.test(String(b.funnel || ""))) return true;
  return AD_RE.test(String(b.text || ""));
}

const ASPECTS = ["4:5", "9:16", "1:1"];
function clampInt(v: unknown, lo: number, hi: number, d: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
}

/** Розбирає замовлення. Явні поля (count, aspects, angles, pains, photoUrls, note, landingUrl, date, render) мають пріоритет над текстом. */
export function planAdsOrder(b: Record<string, any>, today: string): AdsOrderPlan | null {
  if (!isAdsOrder(b)) return null;
  const text = String(b.text || "");
  const wantsVideo = /ad[_\s-]video|відео[\s-]?креатив|реклам[а-яіїєґ]*\s+відео|ads-creative-video/i.test(text) || b.funnel === "ads-creative-video";
  const photoUrls: string[] = Array.isArray(b.photoUrls) ? b.photoUrls.map(String).filter((u: string) => /^https:\/\//i.test(u)).slice(0, 12) : [];
  const wantsPhoto = b.funnel === "ads-creative-photo" || photoUrls.length > 0 || /(^|[^а-яіїєґa-z])фото(графі[а-яіїєґ]*)?([^а-яіїєґa-z]|$)/i.test(text); // \b не працює з кирилицею
  const funnel: AdsOrderPlan["funnel"] = wantsVideo ? "ads-creative-video" : wantsPhoto ? "ads-creative-photo" : "ads-creative-image";

  // кількість: «7 рекламних креативів», «зроби 5 креативів»; інакше число рядків-тем із «·», інакше 4
  let count = b.count != null ? clampInt(b.count, 1, 8, 4) : 0;
  if (!count) {
    const m = text.match(/(\d{1,2})\s*(?:реклам[а-яіїєґ]*\s+)?(?:відео[-\s]?)?(?:креатив|баннер|оголошен)/i);
    if (m) count = clampInt(m[1], 1, 8, 4);
  }
  if (!count) {
    const topics = text.split("\n").filter((l) => /·/.test(l)).length;
    count = topics ? clampInt(topics, 1, 8, 4) : 4;
  }
  if (funnel === "ads-creative-video") count = Math.min(count, 5);

  const aspectsFound = Array.isArray(b.aspects) ? b.aspects.map(String).filter((a: string) => ASPECTS.includes(a)) : (text.match(/\b(4:5|9:16|1:1)\b/g) || []);
  const aspects = Array.from(new Set(aspectsFound.length ? aspectsFound : ["4:5", "9:16"]));

  const angles: string[] = Array.isArray(b.angles) ? b.angles.map(String) : [];
  const params: Record<string, unknown> = {
    projectId: String(b.projectId || ""),
    count,
    date: typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : today,
    ...(funnel !== "ads-creative-video" ? { aspects } : {}),
    ...(angles.length ? { angles } : {}),
    ...(Array.isArray(b.pains) && b.pains.length ? { pains: b.pains } : {}),
    ...(typeof b.landingUrl === "string" && /^https:\/\//i.test(b.landingUrl) ? { landingUrl: b.landingUrl } : {}),
    ...(b.productId ? { productId: String(b.productId) } : {}),
    ...(b.leadMagnet !== undefined ? { leadMagnet: b.leadMagnet } : {}),
    ...(b.render === false ? { render: false } : {}),
    // повний текст замовлення (теми, варіанти, побажання) іде копірайтеру воронки як вказівка власника
    note: String(b.note || text).slice(0, 3500),
  };
  if (funnel === "ads-creative-photo") params.photoUrls = photoUrls;
  const asp = funnel === "ads-creative-video" ? "9:16" : aspects.join(" + ");
  return { funnel, params, needsPhotos: funnel === "ads-creative-photo" && photoUrls.length === 0, summary: `${count} × ${funnel === "ads-creative-video" ? "відео-креативів" : "креативів"} (${asp}), воронка ${funnel}` };
}
