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

    for (const net of networks) {
      await prisma.socialNetwork.create({
        data: { ...net, projectId: project.id },
      });
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
