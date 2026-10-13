import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { kyivOffsetMinutes } from "@/lib/utils";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw";
const HORIZON_DAYS = 3; // скільки найближчих днів мають бути закриті постами

// Сторожок календаря: для кожної мережі з автопублікацією (post_directly) перевіряє, що на найближчі HORIZON_DAYS днів
// (від завтра) є хоч один пост зі статусом «заплановано». Якщо план вичерпався — повертає готове повідомлення для власника.
// Привід (2026-10-13): план Threads закінчився 14.10, і 13.10 автопосту не було — ніхто про це не знав.
// Викликає воронка plan-watch щодня; порожнє message = все гаразд (воронка мовчить).
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== WEBHOOK_SECRET) return NextResponse.json({ ok: false }, { status: 401 });

  const now = new Date();
  const kyiv = new Date(now.getTime() + (kyivOffsetMinutes(now) - now.getTimezoneOffset()) * 60000);
  const todayUtc = Date.UTC(kyiv.getUTCFullYear(), kyiv.getUTCMonth(), kyiv.getUTCDate());

  const networks = await prisma.socialNetwork.findMany({
    where: { isEnabled: true, postDirectly: true },
    include: { project: { select: { name: true } } },
  });

  const gaps: { project: string; network: string; dates: string[] }[] = [];
  for (const n of networks) {
    const missing: string[] = [];
    for (let d = 1; d <= HORIZON_DAYS; d++) {
      const from = new Date(todayUtc + d * 86400000);
      const to = new Date(todayUtc + (d + 1) * 86400000);
      const cnt = await prisma.postGroup.count({ where: { socialNetworkId: n.id, status: "scheduled", postDate: { gte: from, lt: to } } });
      if (cnt === 0) missing.push(`${String(from.getUTCDate()).padStart(2, "0")}.${String(from.getUTCMonth() + 1).padStart(2, "0")}`);
    }
    if (missing.length) gaps.push({ project: n.project.name, network: n.name, dates: missing });
  }

  const message = gaps.length
    ? "⚠️ План публікацій вичерпується. Автопублікація не матиме що виставити:\n" +
      gaps.map((g) => `• ${g.project} / ${g.network}: немає постів на ${g.dates.join(", ")}`).join("\n") +
      "\n\nПопроси контент-менеджера запланувати пости на наступні дні."
    : "";
  return NextResponse.json({ ok: true, horizonDays: HORIZON_DAYS, gaps, message });
}
