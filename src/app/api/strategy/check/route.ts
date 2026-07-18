import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_INTENT: Record<string, number> = { educate: 0.3, sell: 0.2, trust: 0.2, storytelling: 0.15, entertainment: 0.15 };

// Ф3.6 Rule-based перевірка сітки контенту проти intent-квот стратегії за період.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const strategy = await prisma.smmStrategy.findFirst({ where: { projectId }, orderBy: { version: "desc" } });
  const target: Record<string, number> = (strategy?.intentDistribution && typeof strategy.intentDistribution === "object" && !Array.isArray(strategy.intentDistribution))
    ? (strategy.intentDistribution as Record<string, number>) : DEFAULT_INTENT;

  const posts = await prisma.postGroup.findMany({
    where: {
      projectId,
      ...(from || to ? { postDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    },
    select: { intent: true },
  });

  const counts: Record<string, number> = {};
  let total = 0;
  for (const p of posts) {
    const k = p.intent || "unset";
    counts[k] = (counts[k] || 0) + 1;
    total++;
  }

  const distribution = Object.keys(target).map((k) => {
    const actual = total ? (counts[k] || 0) / total : 0;
    const t = Number(target[k]) || 0;
    const deviation = Math.round((actual - t) * 100) / 100;
    return {
      intent: k,
      target: t,
      actual: Math.round(actual * 100) / 100,
      count: counts[k] || 0,
      deviation,
      status: Math.abs(deviation) <= 0.07 ? "ok" : deviation > 0 ? "over" : "under",
    };
  });

  return NextResponse.json({ total, unset: counts["unset"] || 0, strategyVersion: strategy?.version || 0, distribution });
}
