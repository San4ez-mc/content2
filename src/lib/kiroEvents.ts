// Найближчі події з додатку KIRO (публічна афіша) для анонсів Кіри в постах і сторіз.
// Джерело: публічний фід kiro.fineko.space/api/v1/discovery (без авторизації, до 50 за сторінку). Нічого не вигадуємо: лише те, що є в афіші.
// Картка події для сторіз (1080x1920) генерується самим KIRO: /api/v1/events/<id>/share-image.

const KIRO_SITE = process.env.KIRO_SITE_BASE || "https://kiro.fineko.space";
const TZ = "Europe/Kyiv";

export type KiroEvent = {
  id: string; title: string; date: string; time: string; startsAt: string; city: string; place: string;
  priceText: string; category: string; slug: string; link: string; storyImage: string;
};

const CARD_PREFIX = KIRO_SITE + "/api/v1/events/";
/** Чи це готова картка події KIRO (дозволений зовнішній imagePath для поста). */
export const isKiroEventCard = (u: string) => String(u || "").startsWith(CARD_PREFIX);

const fmtDate = (d: Date) => new Intl.DateTimeFormat("uk-UA", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(d);
const fmtTime = (d: Date) => new Intl.DateTimeFormat("uk-UA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

export function mapKiroEvent(e: any): KiroEvent {
  const d = new Date(e.startsAt);
  const free = String(e.priceType || "").toUpperCase() === "FREE" || Number(e.price) === 0;
  const place = String(e.addressText || "").split(",").slice(0, 2).join(",").trim();
  return {
    id: e.id, title: String(e.title || "").trim(), date: fmtDate(d), time: fmtTime(d), startsAt: e.startsAt,
    city: e.city?.nameUk || "", place, priceText: free ? "безкоштовно" : e.price ? `від ${Math.round(Number(e.price))} грн` : "ціну уточнюйте",
    category: e.category?.nameUk || "", slug: e.slug,
    link: `${KIRO_SITE}/events/${e.slug}?utm_source=instagram&utm_medium=story`,
    storyImage: `${CARD_PREFIX}${e.id}/share-image?variant=1`,
  };
}

let cache: { at: number; items: any[] } | null = null;

async function fetchFeed(): Promise<any[]> {
  if (cache && Date.now() - cache.at < 5 * 60 * 1000) return cache.items;
  const all: any[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 8; i++) {
    const url = `${KIRO_SITE}/api/v1/discovery?limit=50${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) break;
    const j: any = await r.json();
    all.push(...(j.items || []));
    cursor = j.nextCursor || null;
    if (!j.hasMore || !cursor) break;
  }
  cache = { at: Date.now(), items: all };
  return all;
}

/** Події найближчих `days` днів (за київським часом), за датою; city фільтрує за назвою міста. */
export async function upcomingKiroEvents(days = 7, city?: string, limit = 40): Promise<KiroEvent[]> {
  const feed = await fetchFeed();
  const now = Date.now();
  const to = now + Math.min(Math.max(days, 1), 30) * 86400000;
  const c = String(city || "").trim().toLowerCase();
  return feed
    .filter((e) => { const t = new Date(e.startsAt).getTime(); return t >= now && t <= to && (!c || String(e.city?.nameUk || "").toLowerCase().includes(c)); })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, limit)
    .map(mapKiroEvent);
}

export function eventsText(items: KiroEvent[]): string {
  if (!items.length) return "";
  return (
    "БЛИЖЧІ ПОДІЇ З ДОДАТКУ KIRO (реальна афіша; анонси й сторіз про події бери ТІЛЬКИ звідси, нічого не вигадуй: назва, дата, місто, ціна як є):\n" +
    items.map((e) => `• [${e.id}] ${e.date} ${e.time} · ${e.city} · ${e.title}${e.place ? " · " + e.place : ""} · ${e.priceText} · ${e.category} · картка сторіз: ${e.storyImage} · посилання: ${e.link}`).join("\n")
  );
}
