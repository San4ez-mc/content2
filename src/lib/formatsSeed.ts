import { prisma } from "@/lib/prisma";

// Канонічні формати по мережах (контейнер на платформі + дозволені медіа-типи + aspect).
// platformKey — консолідована мережа (instagram, threads, telegram, tiktok, linkedin, youtube).
export type FormatSeed = { platform: string; key: string; name: string; mediaTypes: string[]; aspect: string; settings?: Record<string, unknown> };

export const DEFAULT_FORMATS: FormatSeed[] = [
  // Instagram
  { platform: "instagram", key: "post", name: "Пост", mediaTypes: ["image", "video", "carousel", "text_on_image"], aspect: "4:5" },
  { platform: "instagram", key: "story", name: "Сторіз", mediaTypes: ["image", "video", "text_on_image"], aspect: "9:16" },
  { platform: "instagram", key: "reel", name: "Рілс", mediaTypes: ["video"], aspect: "9:16", settings: { subtitles: true } },
  { platform: "instagram", key: "carousel", name: "Карусель", mediaTypes: ["carousel"], aspect: "4:5" },
  // Threads
  { platform: "threads", key: "post", name: "Пост", mediaTypes: ["text", "image", "video", "carousel"], aspect: "1:1" },
  { platform: "threads", key: "thread", name: "Тред-ланцюг", mediaTypes: ["text", "image"], aspect: "1:1" },
  // Telegram
  { platform: "telegram", key: "post", name: "Пост", mediaTypes: ["text", "image", "video", "carousel", "file"], aspect: "1:1" },
  // LinkedIn
  { platform: "linkedin", key: "post", name: "Пост", mediaTypes: ["text", "image", "video"], aspect: "1:1" },
  { platform: "linkedin", key: "carousel", name: "Карусель-документ", mediaTypes: ["carousel"], aspect: "4:5" },
  // TikTok
  { platform: "tiktok", key: "video", name: "Відео", mediaTypes: ["video"], aspect: "9:16", settings: { subtitles: true } },
  { platform: "tiktok", key: "slideshow", name: "Слайдшоу", mediaTypes: ["image_music"], aspect: "9:16" },
  // YouTube
  { platform: "youtube", key: "short", name: "Shorts", mediaTypes: ["video"], aspect: "9:16", settings: { subtitles: true } },
];

// Куди йде CTA-лінк (пост-лінки активні лише де можна: коментар/inline/опис).
export const DEFAULT_LINK_PLACEMENT: Record<string, string> = {
  instagram: "bio", threads: "comment", linkedin: "comment", telegram: "inline",
  tiktok: "bio", youtube: "description", youtube_shorts: "description", facebook: "inline",
};

// Засів форматів для мереж проєкту (ідемпотентно за socialNetworkId+key).
export async function seedDefaultFormats(projectId: string): Promise<{ created: number; skipped: number }> {
  const nets = await prisma.socialNetwork.findMany({ where: { projectId }, select: { id: true, platformKey: true } });
  const byPlatform = new Map(nets.map((n) => [n.platformKey, n.id]));
  const existing = await prisma.format.findMany({ where: { projectId }, select: { socialNetworkId: true, key: true } });
  const have = new Set(existing.map((e) => `${e.socialNetworkId}:${e.key}`));
  let created = 0, skipped = 0, order = 0;
  for (const f of DEFAULT_FORMATS) {
    const nid = byPlatform.get(f.platform);
    if (!nid) { skipped++; continue; }
    if (have.has(`${nid}:${f.key}`)) { skipped++; continue; }
    await prisma.format.create({
      data: { projectId, socialNetworkId: nid, key: f.key, name: f.name, mediaTypes: f.mediaTypes as any, aspect: f.aspect, settings: (f.settings || {}) as any, sortOrder: order++ },
    });
    created++;
  }
  return { created, skipped };
}
