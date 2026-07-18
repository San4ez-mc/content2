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

  // Ф2.3 (#303): власник-алерт про падіння генерацій
  const OWNER_CHAT = process.env.FINEKO_OWNER_CHAT || null;
  const OWNER_BOT = process.env.FINEKO_OWNER_BOT_TOKEN || process.env.OWNER_BOT_TOKEN || null;

  let failed = 0, retried = 0, notified = 0;
  const ownerAlerts: string[] = [];

  for (const item of stuck) {
    const fp = (item.funnelParams && typeof item.funnelParams === "object") ? (item.funnelParams as any) : {};
    const stored = fp._deliver || {};
    const projectId = item.group?.projectId;
    const networkName = item.group?.socialNetwork?.name ?? "Мережа";
    const d = item.group?.postDate;
    const dateLabel = d
      ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`
      : "";

    // Ф2.3: перший таймаут → один авто-retry (перезапуск воронки) + скидання таймера.
    if (!fp._wdRetried && item.funnelSlug) {
      try {
        await fetch(`https://flows.fineko.space/webhook/bot/${item.funnelSlug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...(fp._request || {}), postItemId: item.id, projectId, retry: true }),
        });
      } catch { /* best-effort */ }
      // позначаємо повтор; @updatedAt автоматично скине таймер завислості
      await prisma.postItem.update({ where: { id: item.id }, data: { funnelParams: { ...fp, _wdRetried: true } } }).catch(() => {});
      retried++;
      continue; // не фейлимо на першому проході
    }

    // Другий таймаут (або нема воронки для повтору) → failed.
    const errText = `Таймаут генерації — не завершилось за ${minutes} хв (після повтору).`;
    await prisma.postItem.update({
      where: { id: item.id },
      data: { generationStatus: "failed", generationError: errText },
    }).catch(() => {});
    failed++;
    ownerAlerts.push(`#${item.group?.number ?? item.id} (${networkName}${dateLabel ? ", " + dateLabel : ""})`);

    if (projectId) {
      broadcastToProject(projectId, {
        type: "generation_update",
        postItemId: item.id,
        postGroupId: item.groupId,
        status: "failed",
        errorMessage: errText,
      });
    }

    // Push у чат проєкту (платформа — єдиний нотифаєр)
    if (stored.chatId && stored.botToken) {
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

  // Алерт власнику системи, якщо були падіння
  if (ownerAlerts.length && OWNER_CHAT && OWNER_BOT) {
    try {
      await fetch(`https://api.telegram.org/bot${OWNER_BOT}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: OWNER_CHAT, text: `⚠️ Watchdog: впало ${ownerAlerts.length} генерацій після повтору:\n${ownerAlerts.join("\n")}` }),
      });
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ ok: true, checked: stuck.length, retried, failed, notified, minutes });
}
