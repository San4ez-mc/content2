// Єдиний словник «що сказав генератор/бот → platformKey мережі проєкту».
// Раніше був у трьох копіях (agent-tools, bulk-import, chat-placeholders) і не знав youtube/shorts;
// до того ж у проєктах із консолідованими мережами («instagram» замість instagram_posts/_reels)
// пошук за «instagram_reels» нічого не знаходив і пост мовчки лягав на ПЕРШУ увімкнену мережу —
// наприклад рілс-сценарій потрапляв у Threads.
export const PLATFORM_MAP: Record<string, string> = {
  threads: "threads",
  instagram: "instagram_posts",
  instagram_post: "instagram_posts",
  stories: "instagram_stories",
  instagram_stories: "instagram_stories",
  reels: "instagram_reels",
  instagram_reels: "instagram_reels",
  carousel: "instagram_posts",
  instagram_carousel: "instagram_posts",
  linkedin: "linkedin",
  linkedin_post: "linkedin",
  tiktok: "tiktok",
  tiktok_video: "tiktok",
  tiktok_slideshow: "tiktok",
  youtube: "youtube",
  shorts: "youtube",
  youtube_short: "youtube",
  youtube_shorts: "youtube",
  telegram: "telegram",
  telegram_post: "telegram",
  x: "x",
  twitter: "x",
};

export function resolvePlatformKey(platform: unknown): string {
  const s = String(platform ?? "").trim().toLowerCase();
  return PLATFORM_MAP[s] || s || "instagram_posts";
}

/** Ключі мереж у порядку пріоритету: точний → консолідований («instagram_reels» → «instagram») → як написано. */
export function networkKeyCandidates(platform: unknown): string[] {
  const mapped = resolvePlatformKey(platform);
  const raw = String(platform ?? "").trim().toLowerCase();
  const out = [mapped, mapped.split("_")[0], raw].filter(Boolean);
  return Array.from(new Set(out));
}

export function pickNetwork<T extends { platformKey: string }>(networks: T[], platform: unknown): T | undefined {
  for (const key of networkKeyCandidates(platform)) {
    const n = networks.find((x) => x.platformKey === key);
    if (n) return n;
  }
  return undefined;
}
