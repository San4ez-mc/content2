import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Old system category data (from content.fineko.space MySQL)
const OLD_CATEGORIES: { platform: string; name: string }[] = [
  // Threads Posts (old id=1)
  { platform: "threads", name: "Ситуація з практики" },
  { platform: "threads", name: "Думка вголос" },
  { platform: "threads", name: "Легка провокація" },
  { platform: "threads", name: "Корисний факт" },
  { platform: "threads", name: "Питання до аудиторії" },
  { platform: "threads", name: "Кейс з практики" },
  { platform: "threads", name: "Спостереження / думка" },
  { platform: "threads", name: "Інструмент / лайфхак" },
  { platform: "threads", name: "Провокація / думка вголос" },
  { platform: "threads", name: "Особисте" },
  { platform: "threads", name: "Питання / обговорення" },
  { platform: "threads", name: "Соціальний доказ" },
  { platform: "threads", name: "Лід-магніт" },
  { platform: "threads", name: "Фільтр-офер" },
  // Instagram Posts (old id=2)
  { platform: "instagram_posts", name: "Розгорнутий кейс" },
  { platform: "instagram_posts", name: "Особиста історія автора" },
  { platform: "instagram_posts", name: "Практичний інструмент" },
  { platform: "instagram_posts", name: "Провокація / думка вголос" },
  { platform: "instagram_posts", name: "Огляд ШІ-інструменту" },
  { platform: "instagram_posts", name: "Продажний пост / анонс" },
  { platform: "instagram_posts", name: "Особиста історія" },
  { platform: "instagram_posts", name: "Кейс клієнта" },
  { platform: "instagram_posts", name: "Промпт — збережи собі" },
  { platform: "instagram_posts", name: "Біль власника" },
  { platform: "instagram_posts", name: "Інструмент або ШІ" },
  { platform: "instagram_posts", name: "Провокація" },
  { platform: "instagram_posts", name: "Лід-магніт" },
  // Instagram Stories (old id=3)
  { platform: "instagram_stories", name: "Сторіз — анонс рілсу" },
  { platform: "instagram_stories", name: "Сторіз — закулісся" },
  { platform: "instagram_stories", name: "Сторіз — питання" },
  { platform: "instagram_stories", name: "Сторіз — лід-магніт" },
  // TikTok (old id=6)
  { platform: "tiktok", name: "Кейс з практики" },
  { platform: "tiktok", name: "Операційка і системи" },
  { platform: "tiktok", name: "Автоматизація і ШІ" },
  { platform: "tiktok", name: "Особисте і спостереження" },
  // LinkedIn (old id=7)
  { platform: "linkedin", name: "Дзеркало болю" },
  { platform: "linkedin", name: "Кейс з цифрами" },
  { platform: "linkedin", name: "Фінансова освіта просто" },
  { platform: "linkedin", name: "Непопулярна думка" },
  { platform: "linkedin", name: "Продажний пост" },
];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { projectId } = await req.json();
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const networks = await prisma.socialNetwork.findMany({ where: { projectId } });
  const networkByPlatform = new Map(networks.map((n) => [n.platformKey, n]));

  // Get existing categories to avoid duplicates
  const existing = await prisma.category.findMany({ where: { projectId }, select: { name: true } });
  const existingNames = new Set(existing.map((c) => c.name));

  let created = 0;
  let skipped = 0;

  for (const cat of OLD_CATEGORIES) {
    if (existingNames.has(cat.name)) { skipped++; continue; }

    const network = networkByPlatform.get(cat.platform);
    if (!network) { skipped++; continue; }

    await prisma.category.create({
      data: {
        projectId,
        socialNetworkId: network.id,
        name: cat.name,
        color: "#5a6c7d",
      },
    });
    existingNames.add(cat.name);
    created++;
  }

  return NextResponse.json({ ok: true, created, skipped });
}
