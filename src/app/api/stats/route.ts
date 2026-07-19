import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    totalGroups,
    draftCount,
    scheduledCount,
    publishedCount,
    archivedCount,
    thisMonthCount,
    prevMonthCount,
    byNetwork,
    recentPosts,
    itemsWithImages,
    totalItems,
  ] = await Promise.all([
    prisma.postGroup.count({ where: { projectId } }),
    prisma.postGroup.count({ where: { projectId, status: "draft" } }),
    prisma.postGroup.count({ where: { projectId, status: "scheduled" } }),
    prisma.postGroup.count({ where: { projectId, status: "published" } }),
    prisma.postGroup.count({ where: { projectId, status: "archived" } }),
    prisma.postGroup.count({ where: { projectId, postDate: { gte: monthStart, lte: monthEnd } } }),
    prisma.postGroup.count({ where: { projectId, postDate: { gte: prevMonthStart, lte: prevMonthEnd } } }),
    prisma.postGroup.groupBy({
      by: ["socialNetworkId"],
      where: { projectId },
      _count: { id: true },
    }),
    prisma.postGroup.findMany({
      where: { projectId },
      include: { socialNetwork: true, items: { take: 1, orderBy: { orderIndex: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.postItem.count({ where: { group: { projectId }, NOT: { imagePath: null } } }),
    prisma.postItem.count({ where: { group: { projectId } } }),
  ]);

  // Enrich byNetwork with names
  const networks = await prisma.socialNetwork.findMany({ where: { projectId } });
  const networkMap = new Map(networks.map((n) => [n.id, n]));

  const byNetworkEnriched = byNetwork.map((row) => ({
    networkId: row.socialNetworkId,
    name: networkMap.get(row.socialNetworkId)?.name || "Unknown",
    platformKey: networkMap.get(row.socialNetworkId)?.platformKey || "",
    color: networkMap.get(row.socialNetworkId)?.color || "#64748b",
    count: row._count.id,
  }));

  // Posts per day last 30 days (for activity chart)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const perDayRaw = await prisma.postGroup.findMany({
    where: { projectId, postDate: { gte: thirtyDaysAgo } },
    select: { postDate: true, status: true },
  });

  const perDay: Record<string, { date: string; total: number; published: number }> = {};
  for (const p of perDayRaw) {
    const d = p.postDate.toISOString().slice(0, 10);
    if (!perDay[d]) perDay[d] = { date: d, total: 0, published: 0 };
    perDay[d].total++;
    if (p.status === "published") perDay[d].published++;
  }

  const growthPct = prevMonthCount === 0
    ? null
    : Math.round(((thisMonthCount - prevMonthCount) / prevMonthCount) * 100);

  return NextResponse.json({
    totals: { total: totalGroups, draft: draftCount, scheduled: scheduledCount, published: publishedCount, archived: archivedCount },
    thisMonth: thisMonthCount,
    prevMonth: prevMonthCount,
    growthPct,
    byNetwork: byNetworkEnriched,
    perDay: Object.values(perDay).sort((a, b) => a.date.localeCompare(b.date)),
    recentPosts,
    mediaStats: { withImages: itemsWithImages, total: totalItems, pct: totalItems > 0 ? Math.round((itemsWithImages / totalItems) * 100) : 0 },
  });
}
