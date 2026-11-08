import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

// Рекламні креативи компанії (мережа «Реклама FB/IG») для галереї в календарі: усі місяці, з текстом для Ads Manager.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const network = await prisma.socialNetwork.findFirst({ where: { projectId: projectId!, platformKey: "meta_ads" }, select: { id: true } });
  if (!network) return NextResponse.json({ rows: [] });

  const groups = await prisma.postGroup.findMany({
    where: { projectId: projectId!, socialNetworkId: network.id },
    include: { items: { orderBy: { orderIndex: "asc" }, take: 1 } },
    orderBy: { number: "desc" },
    take: 300,
  });

  const rows = groups.map((g) => {
    const it = g.items[0];
    const fp = ((it?.funnelParams as any) || {}) as any;
    return {
      id: g.id,
      number: g.number,
      date: g.postDate.toISOString().slice(0, 10),
      status: g.status as string,
      format: g.formatKey || "",
      imagePath: it?.imagePath || null,
      generationStatus: it?.generationStatus || null,
      generationError: (it as any)?.generationError || null,
      content: it?.content || "",
      ad: fp.ad || null,
      violations: Array.isArray(fp.adViolations) ? (fp.adViolations as string[]) : [],
    };
  });
  return NextResponse.json({ rows });
}
