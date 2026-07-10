import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw";

// Watchdog for stuck media generations. A funnel can crash/hang and never call
// generation-event back, leaving a post in `generating`/`pending`/`generating_text`
// forever with no feedback. This endpoint (run by cron every few minutes) marks
// such posts as failed after a timeout and — as the platform — notifies the chat.
//
// GET/POST /api/generation-watchdog?token=...&minutes=15
export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  const token = req.headers.get("x-webhook-token") || req.nextUrl.searchParams.get("token");
  if (token !== WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const minutes = Math.max(5, Number(req.nextUrl.searchParams.get("minutes") || 15));
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);

  const stuck = await prisma.postItem.findMany({
    where: {
      generationStatus: { in: ["pending", "generating", "generating_text"] as any },
      updatedAt: { lt: cutoff },
    },
    include: { group: { include: { socialNetwork: true } } },
    take: 200,
  });

  let failed = 0, notified = 0;
  for (const item of stuck) {
    const errText = `Таймаут генерації — не завершилось за ${minutes} хв.`;
    await prisma.postItem.update({
      where: { id: item.id },
      data: { generationStatus: "failed", generationError: errText },
    }).catch(() => {});
    failed++;

    const projectId = item.group?.projectId;
    if (projectId) {
      broadcastToProject(projectId, {
        type: "generation_update",
        postItemId: item.id,
        postGroupId: item.groupId,
        status: "failed",
        errorMessage: errText,
      });
    }

    // Notify the chat (platform is the single notifier)
    const stored = (item.funnelParams && typeof item.funnelParams === "object")
      ? ((item.funnelParams as any)._deliver || {}) : {};
    if (stored.chatId && stored.botToken) {
      const networkName = item.group?.socialNetwork?.name ?? "Мережа";
      const d = item.group?.postDate;
      const dateLabel = d
        ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`
        : "";
      try {
        await fetch(`https://api.telegram.org/bot${stored.botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: stored.chatId,
            text: `❌ Не вдалося згенерувати медіа — пост #${item.group?.number ?? ""} (${networkName}, ${dateLabel}).\nПричина: ${errText}\n\nМожеш попросити перегенерувати.`,
          }),
        });
        notified++;
      } catch { /* best-effort */ }
    }
  }

  return NextResponse.json({ ok: true, checked: stuck.length, failed, notified, minutes });
}
