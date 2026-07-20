import { prisma } from "@/lib/prisma";

// #243/#313 Джерело категорій постів: канонічна таксономія рубрик по платформах
// (перенесена зі старої системи content.fineko.space). Використовується і адмін-
// міграцією, і автосідом при створенні проєкту.
export const DEFAULT_CATEGORY_RUBRICS: { platform: string; name: string }[] = [
  // Threads
  { platform: "threads", name: "Ситуація з практики" },
  { platform: "threads", name: "Думка вголос" },
  { platform: "threads", name: "Легка провокація" },
  { platform: "threads", name: "Корисний факт" },
  { platform: "threads", name: "Питання до аудиторії" },
  { platform: "threads", name: "Кейс з практики" },
  { platform: "threads", name: "Спостереження / думка" },
  { platform: "threads", name: "Інструмент / лайфхак" },
  { platform: "threads", name: "Особисте" },
  { platform: "threads", name: "Соціальний доказ" },
  { platform: "threads", name: "Лід-магніт" },
  { platform: "threads", name: "Фільтр-офер" },
  // Instagram Posts
  { platform: "instagram_posts", name: "Розгорнутий кейс" },
  { platform: "instagram_posts", name: "Особиста історія автора" },
  { platform: "instagram_posts", name: "Практичний інструмент" },
  { platform: "instagram_posts", name: "Провокація / думка вголос" },
  { platform: "instagram_posts", name: "Огляд ШІ-інструменту" },
  { platform: "instagram_posts", name: "Продажний пост / анонс" },
  { platform: "instagram_posts", name: "Кейс клієнта" },
  { platform: "instagram_posts", name: "Промпт — збережи собі" },
  { platform: "instagram_posts", name: "Біль власника" },
  { platform: "instagram_posts", name: "Лід-магніт" },
  // Instagram Stories
  { platform: "instagram_stories", name: "Сторіз — анонс рілсу" },
  { platform: "instagram_stories", name: "Сторіз — закулісся" },
  { platform: "instagram_stories", name: "Сторіз — питання" },
  { platform: "instagram_stories", name: "Сторіз — лід-магніт" },
  // Instagram Reels
  { platform: "instagram_reels", name: "Рілс — кейс" },
  { platform: "instagram_reels", name: "Рілс — лайфхак" },
  { platform: "instagram_reels", name: "Рілс — тренд" },
  // TikTok
  { platform: "tiktok", name: "Кейс з практики" },
  { platform: "tiktok", name: "Операційка і системи" },
  { platform: "tiktok", name: "Автоматизація і ШІ" },
  { platform: "tiktok", name: "Особисте і спостереження" },
  // LinkedIn
  { platform: "linkedin", name: "Дзеркало болю" },
  { platform: "linkedin", name: "Кейс з цифрами" },
  { platform: "linkedin", name: "Експертна думка" },
  { platform: "linkedin", name: "Непопулярна думка" },
  { platform: "linkedin", name: "Продажний пост" },
];

/**
 * Засідити дефолтні категорії для проєкту, маплячи рубрики на його соцмережі
 * за platformKey. Ідемпотентно (пропускає наявні за назвою). Повертає лічильники.
 */
export async function seedDefaultCategories(projectId: string): Promise<{ created: number; skipped: number }> {
  const networks = await prisma.socialNetwork.findMany({ where: { projectId } });
  const byPlatform = new Map(networks.map((n) => [n.platformKey, n]));

  const existing = await prisma.category.findMany({ where: { projectId }, select: { name: true } });
  const existingNames = new Set(existing.map((c) => c.name));

  let created = 0;
  let skipped = 0;
  for (const cat of DEFAULT_CATEGORY_RUBRICS) {
    if (existingNames.has(cat.name)) { skipped++; continue; }
    const network = byPlatform.get(cat.platform);
    if (!network) { skipped++; continue; }
    await prisma.category.create({
      data: { projectId, socialNetworkId: network.id, name: cat.name, color: "#5a6c7d" },
    });
    existingNames.add(cat.name);
    created++;
  }
  return { created, skipped };
}
