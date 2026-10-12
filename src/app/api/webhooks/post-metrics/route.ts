import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw";

// Автоматичний збір метрик ефективності постів (Threads та інші мережі з офіційним API).
// Викликає воронка-збирач у Flows (threads-insights) раз на добу:
//   GET  ?token=…&platform=threads&days=30   → які опубліковані пости опитувати: [{ postGroupId, number, externalId, publishedAt }]
//   POST ?token=…  body { metrics: [{ postGroupId, views, likes, replies, reposts, quotes, shares }] }
//        → записує у PostGroup.scores (overwrite, бо API віддає накопичені lifetime-значення).
//
// scores уже використовує ручний ввід (/api/analytics/manual: likes/comments/subscribes/sales + total, що НАКОПИЧУЄТЬСЯ)
// і /api/patterns (середній total по інтенту/структурі/доказу). Щоб не зіпсувати ручні бали й не рахувати двічі:
// автоматичні дані лежать під ключами th_*, а total = (те, що було до авто) + auto_total (перераховується щоразу).
const AUTO_WEIGHTS: Record<string, number> = { likes: 1, replies: 2, reposts: 3, quotes: 3, shares: 2 };
const FIELDS = ["views", "likes", "replies", "reposts", "quotes", "shares"] as const;

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== WEBHOOK_SECRET) return NextResponse.json({ ok: false }, { status: 401 });
  const platform = (req.nextUrl.searchParams.get("platform") || "threads").toLowerCase();
  const days = Math.min(120, Math.max(1, parseInt(req.nextUrl.searchParams.get("days") || "30", 10) || 30));
  const since = new Date(Date.now() - days * 86400000);

  const rows = await prisma.publicationQueue.findMany({
    where: {
      status: "published",
      externalId: { not: null },
      platform: { startsWith: platform },
      postGroup: { postDate: { gte: since } },
    },
    select: { postGroupId: true, externalId: true, postGroup: { select: { number: true, postDate: true } } },
    orderBy: { postGroup: { postDate: "desc" } },
    take: 500,
  });
  return NextResponse.json({
    ok: true,
    posts: rows.map((r) => ({ postGroupId: r.postGroupId, number: r.postGroup.number, externalId: r.externalId, postDate: r.postGroup.postDate })),
  });
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== WEBHOOK_SECRET) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const metrics: any[] = Array.isArray(body.metrics) ? body.metrics : [];
  let updated = 0;
  const projects = new Set<string>();

  for (const m of metrics) {
    const id = String(m.postGroupId || "");
    if (!id) continue;
    const g = await prisma.postGroup.findUnique({ where: { id }, select: { id: true, projectId: true, scores: true } });
    if (!g) continue;

    const prev: Record<string, any> = g.scores && typeof g.scores === "object" && !Array.isArray(g.scores) ? (g.scores as Record<string, any>) : {};
    const n = (k: string) => Math.max(0, Number(m[k]) || 0);
    const auto = { views: n("views"), likes: n("likes"), replies: n("replies"), reposts: n("reposts"), quotes: n("quotes"), shares: n("shares") };
    const autoTotal = Object.keys(AUTO_WEIGHTS).reduce((s, k) => s + (auto as any)[k] * AUTO_WEIGHTS[k], 0);
    const manualBase = Number(prev.total || 0) - Number(prev.auto_total || 0); // ручна частина балів без попереднього авто-внеску
    const interactions = auto.likes + auto.replies + auto.reposts + auto.quotes;

    const next: Record<string, any> = { ...prev };
    for (const f of FIELDS) next["th_" + f] = auto[f];
    next.auto_total = autoTotal;
    next.total = Math.max(0, manualBase) + autoTotal;
    next.er = auto.views > 0 ? Number((interactions / auto.views).toFixed(4)) : 0; // залученість = взаємодії / перегляди
    next.metrics_at = new Date().toISOString();

    await prisma.postGroup.update({ where: { id }, data: { scores: next } });
    projects.add(g.projectId);
    updated++;
  }
  Array.from(projects).forEach((pid) => broadcastToProject(pid, { type: "post_updated", source: "metrics" }));
  return NextResponse.json({ ok: true, updated });
}
