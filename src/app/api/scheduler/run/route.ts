import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SCHEDULER_TOKEN = process.env.SCHEDULER_TOKEN || "fnk_scheduler_2026";
const TG_FLOWS_URL = "https://flows.fineko.space/webhook/bot/content-scheduler";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-scheduler-token") || req.nextUrl.searchParams.get("token");
  if (token !== SCHEDULER_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Get Kyiv time
  const now = new Date();
  const kyivMs = now.getTime() + (3 * 60 - now.getTimezoneOffset()) * 60000;
  const kyivNow = new Date(kyivMs);
  const todayStr = kyivNow.toISOString().slice(0, 10);
  const currentTime = `${String(kyivNow.getHours()).padStart(2, "0")}:${String(kyivNow.getMinutes()).padStart(2, "0")}`;

  // Find all active projects with schedule settings
  const schedules = await prisma.scheduleSettings.findMany({
    where: { OR: [{ sendToTelegram: true }, { digestTime: { not: null } }] },
    include: { project: true },
  });

  const results = [];

  for (const schedule of schedules) {
    const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][kyivNow.getDay()];

    // Check morning digest — skip if already sent today (idempotent against double-fire in the ±5 window)
    if (schedule.digestTime && schedule.digestChatId && schedule.lastDigestDate !== todayStr) {
      const [dh, dm] = schedule.digestTime.split(":").map(Number);
      const digestMin = dh * 60 + dm;
      const currentMin = kyivNow.getHours() * 60 + kyivNow.getMinutes();
      if (Math.abs(currentMin - digestMin) <= 5) {
        const todayPosts = await prisma.postGroup.findMany({
          where: { projectId: schedule.projectId, postDate: new Date(todayStr) },
          include: { items: { orderBy: { orderIndex: "asc" } }, socialNetwork: true },
          orderBy: { scheduleTime: "asc" },
        });

        if (todayPosts.length > 0) {
          // Mark as sent BEFORE delivery so a concurrent/repeated run in the window can't duplicate
          await prisma.scheduleSettings.update({
            where: { id: schedule.id },
            data: { lastDigestDate: todayStr },
          });
          try {
            const res = await fetch(TG_FLOWS_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mode: "digest",
                projectId: schedule.projectId,
                telegramChatId: schedule.digestChatId,
                posts: todayPosts.map((g) => ({
                  id: g.id,
                  platform: g.socialNetwork.platformKey,
                  scheduleTime: g.scheduleTime,
                  items: g.items.map((i) => ({
                    content: i.content,
                    imagePath: i.imagePath,
                  })),
                })),
                today: todayStr,
              }),
            });
            // Delivery failed — revert the marker so the next cron tick can retry today
            if (!res.ok) {
              await prisma.scheduleSettings.update({
                where: { id: schedule.id },
                data: { lastDigestDate: schedule.lastDigestDate },
              });
            }
            results.push({ projectId: schedule.projectId, mode: "digest", posts: todayPosts.length, ok: res.ok });
          } catch (e: any) {
            await prisma.scheduleSettings.update({
              where: { id: schedule.id },
              data: { lastDigestDate: schedule.lastDigestDate },
            });
            results.push({ projectId: schedule.projectId, mode: "digest", error: e.message });
          }
        }
      }
    }

    // Check regular scheduled publishing
    if (!schedule.sendToTelegram) continue;

    const dayTimes = (schedule as any)[dayName] as string[] || [];
    const shouldRun = dayTimes.some((t: string) => {
      const [h, m] = t.split(":").map(Number);
      const scheduledMin = h * 60 + m;
      const currentMin = kyivNow.getHours() * 60 + kyivNow.getMinutes();
      return Math.abs(currentMin - scheduledMin) <= 5;
    });

    if (!shouldRun) continue;

    // Find scheduled posts for today in this project
    const posts = await prisma.postGroup.findMany({
      where: {
        projectId: schedule.projectId,
        postDate: new Date(todayStr),
        status: "scheduled",
      },
      include: {
        items: { orderBy: { orderIndex: "asc" } },
        socialNetwork: true,
      },
    });

    if (posts.length === 0) continue;

    // Send to Flows for Telegram delivery
    try {
      const res = await fetch(TG_FLOWS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "publish",
          projectId: schedule.projectId,
          telegramChatId: schedule.telegramChatId,
          posts: posts.map((g) => ({
            id: g.id,
            platform: g.socialNetwork.platformKey,
            type: g.type,
            items: g.items.map((i) => ({
              content: i.content,
              imagePath: i.imagePath,
              isCta: i.isCta,
            })),
          })),
          today: todayStr,
          callbackUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/scheduler-done`,
        }),
      });

      results.push({ projectId: schedule.projectId, mode: "publish", posts: posts.length, ok: res.ok });
    } catch (e: any) {
      results.push({ projectId: schedule.projectId, mode: "publish", error: e.message });
    }
  }

  return NextResponse.json({ ok: true, todayStr, currentTime, results });
}
