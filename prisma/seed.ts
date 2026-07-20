import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "olexandrmatsuk@gmail.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "change_me_immediately";
  const name = process.env.SEED_ADMIN_NAME || "Олександр Мацук";

  // Create superadmin
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash: hash, name, role: "superadmin" },
    });

    // Create initial project
    const project = await prisma.project.create({
      data: {
        name: "FINEKO — Контент",
        isActive: true,
        projectUsers: { create: { userId: user.id, role: "owner" } },
      },
    });

    // Default social networks
    const networks = [
      { name: "Threads Posts", platformKey: "threads", color: "#9333ea", icon: "🧵", sortOrder: 1 },
      { name: "Instagram Posts", platformKey: "instagram_posts", color: "#ec4899", icon: "📸", sortOrder: 2 },
      { name: "Instagram Stories", platformKey: "instagram_stories", color: "#f97316", icon: "📱", sortOrder: 3 },
      { name: "Instagram Reels", platformKey: "instagram_reels", color: "#ec4899", icon: "🎬", sortOrder: 4 },
      { name: "LinkedIn", platformKey: "linkedin", color: "#3b82f6", icon: "💼", sortOrder: 5 },
      { name: "TikTok", platformKey: "tiktok", color: "#06b6d4", icon: "🎵", sortOrder: 6 },
    ];

    const netByPlatform = new Map<string, string>();
    for (const net of networks) {
      const created = await prisma.socialNetwork.create({
        data: { ...net, projectId: project.id },
      });
      netByPlatform.set(net.platformKey, created.id);
    }

    // #313 Дефолтні категорії (рубрики) при створенні проєкту — маплячи на соцмережі.
    const defaultCategories: { platform: string; name: string }[] = [
      { platform: "threads", name: "Ситуація з практики" },
      { platform: "threads", name: "Корисний факт" },
      { platform: "threads", name: "Питання до аудиторії" },
      { platform: "threads", name: "Кейс з практики" },
      { platform: "threads", name: "Легка провокація" },
      { platform: "threads", name: "Лід-магніт" },
      { platform: "instagram_posts", name: "Розгорнутий кейс" },
      { platform: "instagram_posts", name: "Особиста історія автора" },
      { platform: "instagram_posts", name: "Практичний інструмент" },
      { platform: "instagram_posts", name: "Продажний пост / анонс" },
      { platform: "instagram_posts", name: "Біль власника" },
      { platform: "instagram_stories", name: "Сторіз — анонс рілсу" },
      { platform: "instagram_stories", name: "Сторіз — питання" },
      { platform: "instagram_reels", name: "Рілс — кейс" },
      { platform: "instagram_reels", name: "Рілс — лайфхак" },
      { platform: "linkedin", name: "Кейс з цифрами" },
      { platform: "linkedin", name: "Експертна думка" },
      { platform: "linkedin", name: "Продажний пост" },
      { platform: "tiktok", name: "Кейс з практики" },
      { platform: "tiktok", name: "Автоматизація і ШІ" },
    ];
    for (const cat of defaultCategories) {
      const socialNetworkId = netByPlatform.get(cat.platform);
      if (!socialNetworkId) continue;
      await prisma.category.create({ data: { projectId: project.id, socialNetworkId, name: cat.name, color: "#5a6c7d" } });
    }

    // Default schedule (09:00, 12:00, 18:00 every weekday)
    const times = ["09:00", "12:00", "18:00"];
    await prisma.scheduleSettings.create({
      data: {
        projectId: project.id,
        monday: times,
        tuesday: times,
        wednesday: times,
        thursday: times,
        friday: times,
        saturday: [],
        sunday: [],
        sendToTelegram: true,
        telegramChatId: "",
      },
    });

    console.log(`✅ Created superadmin: ${email}`);
    console.log(`✅ Created project: ${project.name}`);
  } else {
    console.log(`ℹ️  Admin already exists: ${email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
