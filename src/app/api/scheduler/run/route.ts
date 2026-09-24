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

  // Projects that publish directly to a network must run even without a schedule row / Telegram.
  const autopostNetworks = await prisma.socialNetwork.findMany({
    where: { postDirectly: true, isEnabled: true },
    select: { projectId: true },
    distinct: ["projectId"],
  });
  const autopostProjectIds = new Set(autopostNetworks.map((n) => n.projectId));

  // Find all active projects with schedule settings
  const schedules: any[] = await prisma.scheduleSettings.findMany({
    where: {
      OR: [
        { sendToTelegram: true },
        { digestTime: { not: null } },
        { projectId: { in: Array.from(autopostProjectIds) } },
      ],
    },
    include: { project: true },
  });
  for (const pid of Array.from(autopostProjectIds)) {
    if (!schedules.some((s) => s.projectId === pid)) {
      schedules.push({
        id: null, projectId: pid,
        monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
        sendToTelegram: false, telegramChatId: null, digestTime: null, digestChatId: null, lastDigestDate: null,
      });
    }
  }

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
    const hasAutopost = autopostProjectIds.has(schedule.projectId);
    if (!schedule.sendToTelegram && !hasAutopost) continue;

    const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const slotsOf = (k: string): string[] => (Array.isArray((schedule as any)[k]) ? ((schedule as any)[k] as string[]) : []);
    const currentMin = kyivNow.getHours() * 60 + kyivNow.getMinutes();
    const withinWindow = (t?: string | null) => {
      if (!t) return false;
      const [h, m] = t.split(":").map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return false;
      return Math.abs(currentMin - (h * 60 + m)) <= 5;
    };

    // Schedule is optional: with explicit project slots, all of today's posts go out at a slot
    // (as before); with no slots at all, every post goes out at its own scheduleTime.
    const hasAnySlots = dayKeys.some((k) => slotsOf(k).length > 0);
    const slotHit = slotsOf(dayName).some(withinWindow);

    // Find scheduled posts for today in this project
    const candidates = await prisma.postGroup.findMany({
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

    const due = hasAnySlots ? (slotHit ? candidates : []) : candidates.filter((g) => withinWindow(g.scheduleTime));
    if (due.length === 0) continue;

    // Per-network delivery: Telegram digest and/or direct autopost. Direct posts are claimed in
    // publication_queue first (unique per post) so a repeated cron tick can never post twice.
    const toSend: { g: (typeof due)[number]; auto: boolean; tg: boolean }[] = [];
    for (const g of due) {
      const auto = g.socialNetwork.postDirectly && !!g.socialNetwork.autopostSlug;
      const tg = !!schedule.sendToTelegram && g.socialNetwork.sendToTelegram;
      if (!auto && !tg) continue;
      if (auto) {
        try {
          await prisma.publicationQueue.create({
            data: { postGroupId: g.id, platform: g.socialNetwork.platformKey, scheduledAt: new Date(), status: "pending" },
          });
        } catch (e: any) {
          if (e?.code === "P2002") continue; // already dispatched
          throw e;
        }
      }
      toSend.push({ g, auto, tg });
    }
    if (toSend.length === 0) continue;

    // Send to Flows: Telegram delivery + direct publishing (the Content Scheduler funnel decides per post)
    try {
      const res = await fetch(TG_FLOWS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "publish",
          projectId: schedule.projectId,
          telegramChatId: schedule.telegramChatId,
          posts: toSend.map(({ g, auto, tg }) => ({
            id: g.id,
            platform: g.socialNetwork.platformKey,
            type: g.type,
            scheduleTime: g.scheduleTime,
            sendToTelegram: tg,
            postDirectly: auto,
            autopostSlug: auto ? g.socialNetwork.autopostSlug : null,
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

      if (!res.ok) {
        await prisma.publicationQueue.updateMany({
          where: { postGroupId: { in: toSend.filter((x) => x.auto).map((x) => x.g.id) } },
          data: { status: "failed", errorMessage: `Flows content-scheduler HTTP ${res.status}` },
        });
      }
      results.push({ projectId: schedule.projectId, mode: "publish", posts: toSend.length, ok: res.ok });
    } catch (e: any) {
      await prisma.publicationQueue.updateMany({
        where: { postGroupId: { in: toSend.filter((x) => x.auto).map((x) => x.g.id) } },
        data: { status: "failed", errorMessage: String(e?.message || e).slice(0, 500) },
      });
      results.push({ projectId: schedule.projectId, mode: "publish", error: e.message });
    }
  }

  return NextResponse.json({ ok: true, todayStr, currentTime, results });
}
